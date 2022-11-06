// import gu from '../utils/gravityUtils';
const logger = require('../utils/logger').default(module)
const { FeeManager } = require('../services/FeeManager')
const { GravityAccountProperties } = require('../gravity/gravityAccountProperties')
const { jupiterTransactionsService } = require('./jupiterTransactionsService')
const { transactionUtils } = require('../gravity/transactionUtils')
const gu = require('../utils/gravityUtils')

class GravityService {
  constructor(jupiterTransactionsService, transactionUtils) {
    this.jupiterTransactionsService = jupiterTransactionsService
    this.messageService = jupiterTransactionsService.messageService
    this.transactionUtils = transactionUtils
  }

  /**
   *
   * @param recordJson
   * @param gravityAccountProperties
   * @param listTag
   * @param recordTag
   * @param metisEncrypt
   * @param feeType
   * @returns {Promise<Transaction>}
   */
  async addNewRecordToReferencedDataSet(
    recordJson,
    gravityAccountProperties,
    listTag,
    recordTag,
    metisEncrypt = true,
    feeType = FeeManager.feeTypes.account_record
  ) {
    logger.verbose(
      '#### addNewRecordToReferencedDataSet(recordJson,gravityAccountProperties,listTag,recordTag,metisEncrypt = true,feeType)'
    )
    if (!recordJson) {
      throw new Error('recordJson is not valid')
    }
    if (!(gravityAccountProperties instanceof GravityAccountProperties)) {
      throw new Error('gravityAccountProperties is invalid')
    }
    if (!listTag) {
      throw new Error('listTag is invalid')
    }
    if (!recordTag) {
      throw new Error('recordTag is invalid')
    }
    logger.sensitive(`recordJson= ${JSON.stringify(recordJson)}`)
    try {
      let payload = recordJson
      if (metisEncrypt) {
        payload = gravityAccountProperties.crypto.encryptJsonGCM(recordJson)
      }
      const response = await this.messageService.sendTaggedAndEncipheredMetisMessage(
        gravityAccountProperties.passphrase,
        gravityAccountProperties.address,
        payload,
        recordTag,
        feeType,
        gravityAccountProperties.publicKey
      )

      if (!transactionUtils.isValidEncryptedMessageTransactionResponse(response)) {
        throw new Error('Response.data is not a valid transaction response object')
      }

      const transaction = response.transactionJSON
      const responseTransactionId = transactionUtils.extractTransactionId(transaction)
      // Update the List.
      const messageContainers = await this.jupiterTransactionsService.getReadableTaggedMessageContainers(
        gravityAccountProperties,
        listTag
      )
      const firstMessageContainer = gu.arrayShiftOrNull(messageContainers)
      let updatedList = []
      if (firstMessageContainer) {
        updatedList = firstMessageContainer.message
      }

      if (!transactionUtils.areWellFormedJupiterTransactionIds(updatedList)) {
        throw new Error('Not list of transaction ids')
      }
      updatedList.push(responseTransactionId)
      if (metisEncrypt) {
        updatedList = gravityAccountProperties.crypto.encryptJsonGCM(updatedList)
      }
      return this.messageService.sendTaggedAndEncipheredMetisMessage(
        gravityAccountProperties.passphrase,
        gravityAccountProperties.address,
        updatedList,
        listTag,
        feeType,
        gravityAccountProperties.publicKey
      )
    } catch (error) {
      logger.error('****************************************************************')
      logger.error('** addNewRecordToReferencedDataSet().catch(error)')
      logger.error('****************************************************************')
      logger.error(`error= ${error}`)
      throw error
    }
  }

  /**
   *
   * @param gravityAccountProperties
   * @param newItem
   * @param listTag
   * @param feeType
   * @returns {Promise<TransactionResponse | null>}
   */
  addItemToTransactionsReferenceList(
    gravityAccountProperties,
    newItem,
    listTag,
    feeType = FeeManager.feeTypes.account_record,
    isMetisEncrypted = true
  ) {
    // return this.jupiterTransactionsService.getReadableTaggedMessageContainers(gravityAccountProperties, listTag)
    return this.getLatestListByTag(gravityAccountProperties, listTag, isMetisEncrypted).then(async (list) => {
      // first: make sure its not already in the list
      if (list.some((item) => item === newItem)) {
        return null
      }
      // Second: Update the list
      list.push(newItem)
      let encryptedList = list
      if (isMetisEncrypted) {
        encryptedList = gravityAccountProperties.crypto.encryptJsonGCM(list)
      }
      // Third: Send the updated list.
      // if (gravityAccountProperties.isMinimumProperties) {
      //     await refreshGravityAccountProperties(gravityAccountProperties);
      // }
      return this.messageService.sendTaggedAndEncipheredMetisMessage(
        gravityAccountProperties.passphrase,
        gravityAccountProperties.address,
        encryptedList,
        listTag,
        feeType,
        gravityAccountProperties.publicKey
      )
    })
  }

  /**
   *
   * @param gravityAccountProperties
   * @param itemToRemove
   * @param listTag
   * @param feeType
   * @param isMetisEncrypted
   * @return {Promise<{signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}>}
   */
  removeItemFromTransactionsReferenceList(
    gravityAccountProperties,
    itemToRemove,
    listTag,
    feeType = FeeManager.feeTypes.account_record,
    isMetisEncrypted = true
  ) {
    return this.getLatestListByTag(gravityAccountProperties, listTag, isMetisEncrypted).then(async (list) => {
      // first: filter out the item
      const newList = list.filter((item) => item !== itemToRemove)
      let encryptedNewList = newList
      if (isMetisEncrypted) {
        encryptedNewList = gravityAccountProperties.crypto.encryptJsonGCM(newList)
      }
      // Second: Send the updated list.
      return this.messageService.sendTaggedAndEncipheredMetisMessage(
        gravityAccountProperties.passphrase,
        gravityAccountProperties.address,
        encryptedNewList,
        listTag,
        feeType,
        gravityAccountProperties.publicKey
      )
    })
  }

  /**
   *
   * @param {GravityAccountProperties} accountProperties
   * @param {string} tag
   * @returns {Promise<[string]>}
   */
  async getLatestListByTag(accountProperties, tag, isMetisEncrypted = true) {
    logger.verbose('#### getLatestListByTag(accountProperties, tag)')
    if (!tag) {
      throw new Error('empty tag')
    }
    logger.sensitive(`tag= ${JSON.stringify(tag)}`)
    if (!(accountProperties instanceof GravityAccountProperties)) {
      throw new Error('invalid accountProperties')
    }

    return this.jupiterTransactionsService
      .getReadableTaggedMessageContainers(accountProperties, tag, isMetisEncrypted)
      .then((messageContainers) => {
        if (messageContainers.length === 0) {
          return []
        }
        const messageContainer = messageContainers.shift()
        const listOfTransactions = messageContainer.message
        return listOfTransactions
      })
    // const transactions = await this.jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(accountProperties.address, tag);
    // const mostRecentTransaction = this.jupiterTransactionsService.getMostRecentTransactionOrNull(transactions);
    // if(!mostRecentTransaction) {return []}
    // const mostRecentTransactionId = this.transactionUtils.extractTransactionId(mostRecentTransaction);
    // const transactionMessage = await this.jupiterTransactionsService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
    //     mostRecentTransactionId,
    //     accountProperties.crypto,
    //     accountProperties.passphrase
    // );
    //
    // if(!Array.isArray(transactionMessage.message)){throw new Error('transaction message is not an array')}
    // return transactionMessage.message;
  }

  /**
   *
   * @param accountProperties
   * @param recordTag
   * @param listTag
   * @param isMetisEncrypted
   * @returns {Promise<[{message, transactionId}]>}
   */
  getAllMessageContainersReferencedByList(accountProperties, recordTag, listTag, isMetisEncrypted = true) {
    return this.getLatestListByTag(accountProperties, listTag).then((transactions) => {
      return this.messageService.getReadableMessageContainersFromTransactions(
        transactions,
        accountProperties,
        isMetisEncrypted
      )
    })
  }
}

module.exports.gravityService = new GravityService(jupiterTransactionsService, transactionUtils)
