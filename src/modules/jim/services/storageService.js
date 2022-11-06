const mError = require('../../../errors/metisError')
const { chanService } = require('../../../services/chanService')
const { localFileCacheService } = require('./localFileCacheService')
const { GravityCrypto } = require('../../../services/gravityCrypto')
const { metisConfig } = require('../../../config/constants')
const { isString } = require('lodash')
const logger = require('../../../utils/logger').default(module)
const gu = require('../../../utils/gravityUtils')
const { GravityAccountProperties } = require('../../../gravity/gravityAccountProperties')
const zlib = require('zlib')
const { jupiterAPIService, JupiterAPIService } = require('../../../services/jupiterAPIService')
const { jupiterFundingService, JupiterFundingService } = require('../../../services/jupiterFundingService')
const { jupiterAccountService, JupiterAccountService } = require('../../../services/jupiterAccountService')
const { transactionTags } = require('../config/transactionTags')
const { FeeManager, feeManagerSingleton } = require('../../../services/FeeManager')
const {
  jupiterTransactionsService,
  JupiterTransactionsService
} = require('../../../services/jupiterTransactionsService')
const { jimConfig } = require('../config/jimConfig')
const { transactionUtils } = require('../../../gravity/transactionUtils')

const FileCategory = {
  PublicProfile: 'public-profile',
  ChannelProfile: 'channel-profile',
  Raw: 'raw',
  Thumbnail: 'thumbnail'
}

/**
 *
 */
class StorageService {
  /**
   *
   * @param jupiterAPIService
   * @param jupiterTransactionsService
   * @param jupiterFundingService
   * @param jupiterAccountService
   * @param jimConfig
   * @param transactionUtils
   * @param chanService
   * @param fileCacheService
   */
  constructor(
    jupiterAPIService,
    jupiterTransactionsService,
    jupiterFundingService,
    jupiterAccountService,
    jimConfig,
    transactionUtils,
    chanService,
    fileCacheService
  ) {
    if (!(jupiterAPIService instanceof JupiterAPIService)) {
      throw new Error('missing jupiterAPIService')
    }
    if (!(jupiterTransactionsService instanceof JupiterTransactionsService)) {
      throw new Error('missing jupiterTransactionsService')
    }
    if (!(jupiterFundingService instanceof JupiterFundingService)) {
      throw new Error('missing jupiterFundingService')
    }
    if (!(jupiterAccountService instanceof JupiterAccountService)) {
      throw new Error('missing jupiterAccountService')
    }
    this.jupiterAPIService = jupiterAPIService
    this.jupiterTransactionsService = jupiterTransactionsService
    this.jupiterFundingService = jupiterFundingService
    this.jupiterAccountService = jupiterAccountService
    this.jimConfig = jimConfig
    this.transactionUtils = transactionUtils
    this.chanService = chanService
    this.fileCacheService = fileCacheService
  }

  /**
   *
   * @param memberAccountProperties
   * @param channelAddress
   * @return {Promise<*[]>}
   */
  async fetchChannelFilesList(memberAccountProperties, channelAddress) {
    logger.debug('#### fetchChannelFilesList(memberAccountProperties, channelAddress)')
    logger.info(`- Getting ready to get the files for ${channelAddress}`)
    const channelAccountProperties =
      await this.chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(
        memberAccountProperties,
        channelAddress
      )
    if (channelAccountProperties === null) {
      throw new mError.MetisErrorNoChannelAccountFound(
        `User ${memberAccountProperties.address} doesnt have ${channelAddress} channel account`
      )
    }
    logger.info('- Confirmed user has permission to access this channel')
    // const binaryAccountProperties = await this.fetchBinaryAccountPropertiesOrNull(channelAccountProperties);
    // if(binaryAccountProperties === null) throw new mError.MetisErrorNoBinaryAccountFound(`${channelAccountProperties.address} doesnt have a binary account`);
    if (!gu.isWellFormedJupiterAddress(channelAddress)) {
      throw new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)
    }
    const blackListTag = `${transactionTags.jimServerTags.binaryFileBlackList}`
    const blackList = await this.jupiterTransactionsService.fetchLatestReferenceList(
      channelAccountProperties,
      blackListTag
    )
    const fileTag = `${transactionTags.jimServerTags.binaryFileRecord}`
    const allFileRecordTransactions =
      await this.jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(
        channelAccountProperties.address,
        fileTag
      )
    logger.info(`- Queried binary account for files. Found a total of ${allFileRecordTransactions.length}`)
    if (allFileRecordTransactions.length === 0) {
      return []
    }
    const filteredFileRecordTransactions = this.transactionUtils.filterTransactionsByTransactionIds(
      allFileRecordTransactions,
      blackList
    )
    logger.info(`- Applied the blacklist resulting in  ${filteredFileRecordTransactions.length}`)
    if (filteredFileRecordTransactions.length === 0) {
      return []
    }
    // @info The message was mEncrypted using the owner(ie channel) password.
    const messageContainers =
      await this.jupiterTransactionsService.messageService.getReadableMessageContainersFromTransactions(
        filteredFileRecordTransactions,
        channelAccountProperties
      )
    return messageContainers.map((containers) => containers.message)
  }

  /**
   *
   * @param ownerAccountProperties - The account that the file was sent to.
   * @param fileUuid
   * @param tag
   * @return {Promise<{bufferDataPath: string, fileName: *, fileCategory: ("raw"|"thumbnail"), fileSizeInBytes, mimeType: *, originalSenderAddress}>}
   */
  async fetchFileInfo(ownerAccountProperties, fileUuid, tag = null) {
    logger.verbose('#### fetchFile(ownerAccountProperties, fileUuid)')
    if (!(ownerAccountProperties instanceof GravityAccountProperties)) {
      throw new mError.MetisErrorBadGravityAccountProperties('ownerAccountProperties')
    }
    if (!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid: ${fileUuid}`)
    let bufferData = null
    let fileRecord = null
    try {
      // const binaryAccountProperties = await this.fetchBinaryAccountPropertiesOrNull(ownerAccountProperties);
      // if (binaryAccountProperties === null) {
      //     throw new mError.MetisError(`No Binary Account Found for ${ownerAccountProperties.address} `);
      // }
      if (this.fileCacheService.cachedFileExists(fileUuid)) {
        // GETTING FILE FROM CACHE
        console.log('\n')
        logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--')
        logger.info(' GETTING FILE FROM CACHE')
        logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n')
        const encryptedFileRecord = this.fileCacheService.getFileRecord(fileUuid)
        fileRecord =
          isString(tag) && tag.includes(`.${metisConfig.evm}`)
            ? ownerAccountProperties.crypto.decryptAndParseGCM(encryptedFileRecord)
            : ownerAccountProperties.crypto.decryptAndParse(encryptedFileRecord)
      } else {
        // GETTING FILE FROM BLOCKCHAIN
        console.log('\n')
        logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--')
        logger.info(' GETTING FILE FROM BLOCKCHAIN')
        logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n')
        const fetchFileFromBlockChainResponse = await this.fetchFileFromBlockChain(ownerAccountProperties, fileUuid)
        bufferData = fetchFileFromBlockChainResponse.bufferData
        fileRecord = fetchFileFromBlockChainResponse.fileRecord
        const encryptedFileRecord =
          isString(tag) && tag.includes(`.${metisConfig.evm}`)
            ? ownerAccountProperties.crypto.encryptJsonGCM(fileRecord)
            : ownerAccountProperties.crypto.encryptJson(fileRecord)
        this.fileCacheService.sendBufferDataToCache(fileUuid, bufferData)
        this.fileCacheService.sendFileRecordToCache(fileUuid, encryptedFileRecord)
      }
      if (!this.fileCacheService.bufferDataExists(fileUuid)) throw new mError.MetisError('Buffer Data does not exist!')
      const bufferDataPath = this.fileCacheService.generateBufferDataPath(fileUuid)
      return {
        bufferDataPath,
        mimeType: fileRecord.mimeType,
        fileName: fileRecord.fileName,
        fileCategory: fileRecord.fileCat,
        createdBy: fileRecord.createdBy,
        sizeInBytes: fileRecord.sizeInBytes
      }
    } catch (error) {
      console.log('\n')
      logger.error('************************* ERROR ***************************************')
      logger.error('* ** fetchFile(ownerAccountProperties, fileUuid).catch(error)')
      logger.error('************************* ERROR ***************************************\n')
      logger.error(`error= ${error}`)
      throw error
    }
  }

  /**
   *
   * @param ownerAccountProperties  - this is the account that the file was sent to.
   * @param fileUuid
   * @return {Promise<{fileRecord: *, bufferData: Buffer}>}
   */
  async fetchFileFromBlockChain(ownerAccountProperties, fileUuid) {
    logger.verbose('#### fetchFileFromBlockChain()')
    if (!(ownerAccountProperties instanceof GravityAccountProperties)) {
      throw new mError.MetisErrorBadGravityAccountProperties('ownerAccountProperties')
    }
    if (!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid: ${fileUuid}`)
    try {
      // const binaryAccountProperties = await this.fetchBinaryAccountPropertiesOrNull(ownerAccountProperties);
      // if(!(binaryAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`binaryAccountProperties`);
      const fileRecordTag = `${transactionTags.jimServerTags.binaryFileRecord}.${fileUuid}`
      const fileRecordMessageContainers = await this.jupiterTransactionsService.getReadableTaggedMessageContainers(
        ownerAccountProperties,
        fileRecordTag
      )
      if (fileRecordMessageContainers.length === 0) {
        throw new mError.MetisErrorNoBinaryFileFound('', fileUuid)
      }
      // GET THE LATEST FILE RECORD TRANSACTION FOR THIS UUID
      console.log('\n')
      logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--')
      logger.info(' GET THE LATEST FILE RECORD TRANSACTION FOR THIS UUID')
      logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n')
      const fileRecordMessageContainer = fileRecordMessageContainers[0]
      const fileRecord = fileRecordMessageContainer.message
      const chunkTransactionIds = fileRecordMessageContainer.message.chunkTransactionIds
      // GET ALL THE CHUNKS
      console.log('\n')
      logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--')
      logger.info(' GET ALL THE CHUNKS')
      logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n')
      const chunkContainers =
        await this.jupiterTransactionsService.messageService.getReadableMessageContainersFromMessageTransactionIds(
          chunkTransactionIds,
          ownerAccountProperties.passphrase
        )
      if (chunkContainers.length === 0) {
        throw new mError.MetisErrorNoBinaryFileFound('No Chunks found', fileUuid)
      }
      const compressedFile = chunkContainers.reduce((reduced, chunkContainer) => {
        reduced += chunkContainer.message
        return reduced
      }, '')
      const bufferData = zlib.inflateSync(Buffer.from(compressedFile, 'base64')) // @TODO compressing might be worthless since the files are encrypted. Usually encryted files cant be compressed much.
      return {
        bufferData,
        fileRecord
      }
    } catch (error) {
      console.log('\n')
      logger.error('************************* ERROR ***************************************')
      logger.error('* ** fetchFileFromBlockChain(ownerAccountProperties, fileUuid).catch(error)')
      logger.error('************************* ERROR ***************************************\n')
      logger.error(`error= ${error}`)
      throw error
    }
  }

  async fetchFileInfoBySharedKey(transactionId, sharedKey, fileUuid, tag) {
    logger.verbose('#### fetchFileInfoBySharedKey(transactionId, sharedKey, fileUuid)')
    if (!gu.isNonEmptyString(transactionId)) throw new mError.MetisErrorBadUuid(`transactionId: ${transactionId}`)
    if (!gu.isNonEmptyString(sharedKey)) throw new mError.MetisErrorBadUuid(`transactionId: ${sharedKey}`)
    if (!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid: ${fileUuid}`)
    if (!tag) throw new mError.MetisErrorBadUuid(`tag: ${tag}`)
    let bufferData = null
    let fileRecord = null
    try {
      const crypto = new GravityCrypto(process.env.ENCRYPT_ALGORITHM, sharedKey)
      if (this.fileCacheService.cachedFileExists(fileUuid)) {
        // GETTING FILE FROM CACHE
        console.log('\n')
        logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--')
        logger.info(' GETTING FILE FROM CACHE')
        logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n')
        const encryptedFileRecord = this.fileCacheService.getFileRecord(fileUuid)
        fileRecord = tag.includes(`.${metisConfig.evm}`)
          ? crypto.decryptAndParseGCM(encryptedFileRecord)
          : crypto.decryptAndParse(encryptedFileRecord)
      } else {
        // GETTING FILE FROM BLOCKCHAIN
        console.log('\n')
        logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--')
        logger.info(' GETTING FILE FROM BLOCKCHAIN')
        logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n')
        const fetchFileFromBlockChainResponse = await this.fetchFileFromBlockChainBySharedKey(
          transactionId,
          sharedKey,
          tag
        )
        bufferData = fetchFileFromBlockChainResponse.bufferData
        fileRecord = fetchFileFromBlockChainResponse.fileRecord
        const encryptedFileRecord = tag.includes(`.${metisConfig.evm}`)
          ? crypto.decryptAndParseGCM(fileRecord)
          : crypto.decryptAndParse(fileRecord)
        this.fileCacheService.sendBufferDataToCache(fileUuid, bufferData)
        this.fileCacheService.sendFileRecordToCache(fileUuid, encryptedFileRecord)
      }
      if (!this.fileCacheService.bufferDataExists(fileUuid)) throw new mError.MetisError('Buffer Data does not exist!')
      const bufferDataPath = this.fileCacheService.generateBufferDataPath(fileUuid)
      return {
        bufferDataPath,
        mimeType: fileRecord.mimeType,
        fileName: fileRecord.fileName,
        fileCategory: fileRecord.fileCat,
        createdBy: fileRecord.createdBy,
        sizeInBytes: fileRecord.sizeInBytes
      }
    } catch (error) {
      console.log('\n')
      logger.error('************************* ERROR ***************************************')
      logger.error('* ** fetchFileInfoBySharedKey(transactionId, sharedKey, fileUuid).catch(error)')
      logger.error('************************* ERROR ***************************************\n')
      logger.error(`error= ${error}`)
      throw error
    }
  }

  /**
   *
   * @return {Promise<{fileRecord: *, bufferData: Buffer}>}
   * @param transactionId
   * @param sharedKey
   */
  async fetchFileFromBlockChainBySharedKey(transactionId, sharedKey, tag) {
    logger.verbose('#### fetchFileFromBlockChainBySharedKey()')
    if (!gu.isNonEmptyString(transactionId)) throw new mError.MetisErrorBadUuid('transactionId is missing')
    if (!gu.isNonEmptyString(sharedKey)) throw new mError.MetisErrorBadUuid('sharedKey is missing')
    try {
      const fileRecord = await jupiterTransactionsService.getReadableMessageContainersBySharedKey(
        transactionId,
        sharedKey,
        tag
      )

      const chunkTransactionIds = fileRecord.chunkTransactionIds
      // GET ALL THE CHUNKS
      console.log('\n')
      logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--')
      logger.info(' GET ALL THE CHUNKS')
      logger.info('-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n')
      const readableMessageContainer$ = chunkTransactionIds.map((chunkTransactionId) =>
        jupiterTransactionsService.getReadableMessageContainersBySharedKey(
          chunkTransactionId.transactionId,
          chunkTransactionId.sharedKey,
          tag
        )
      )
      const chunkContainers = await Promise.all(readableMessageContainer$)
      if (chunkContainers.length < 1) throw new mError.MetisErrorNoBinaryFileFound('No Chunks found')
      const compressedFile = chunkContainers.reduce((reduced, chunkContainer) => {
        reduced += chunkContainer
        return reduced
      }, '')

      const bufferData = zlib.inflateSync(Buffer.from(compressedFile, 'base64')) // @TODO compressing might be worthless since the files are encrypted. Usually encryted files cant be compressed much.
      return { bufferData, fileRecord }
    } catch (error) {
      console.log('\n')
      logger.error('************************* ERROR ***************************************')
      logger.error('* ** fetchFileFromBlockChainBySharedKey(transactionId, sharedKey).catch(error)')
      logger.error('************************* ERROR ***************************************\n')
      logger.error(`error= ${error}`)
      throw error
    }
  }

  /**
     Push a file into the Jupiter blockchain
     The file is splitted into chunks of CHUNK_SIZE_PATTERN
     and pushed by the binary client

     * @param fileName
     * @param mimeType
     * @param fileUuid
     * @param bufferData
     * @param fromAccountProperties
     * @param toAccountProperties
     * @param {FileCategory} fileCat
     * @return {Promise<{fileRecord: {fileName, fileCat, recordType: string, chunkTransactionIds, mimeType, sizeInKb, originalSenderAddress, linkedFileRecord, version: number, fileUuid, url: string, status: string}}>}
     */
  async sendFileToBlockchain(
    fileName,
    mimeType,
    fileUuid,
    bufferData,
    fromAccountProperties,
    toAccountProperties,
    fileCat
  ) {
    console.log('\n\n\n')
    logger.info('======================================================================================')
    logger.info('== sendFileToBlockchain(fileName,mimeType,bufferData,ownerAccountProperties,originalSenderAddress)')
    logger.info('======================================================================================\n\n\n')
    if (!gu.isNonEmptyString(fileName)) throw new mError.MetisError('fileName')
    if (!gu.isNonEmptyString(mimeType)) throw new mError.MetisError('mimeType')
    if (!gu.isNonEmptyString(fileUuid)) throw new mError.MetisError('fileUuid')
    if (!gu.isNonEmptyString(fileCat)) throw new mError.MetisError('fileCat')
    if (!bufferData) throw new mError.MetisError('bufferData is invalid')
    if (!(fromAccountProperties instanceof GravityAccountProperties)) {
      throw new mError.MetisErrorBadGravityAccountProperties('fromAccountProperties')
    }
    if (!(toAccountProperties instanceof GravityAccountProperties)) {
      throw new mError.MetisErrorBadGravityAccountProperties('toAccountProperties')
    }
    try {
      const CHUNK_SIZE_PATTERN = /.{1,40000}/g
      const fileSizeInBytes = bufferData.length
      const fileSizeInKiloBytes = fileSizeInBytes / 1000
      const fileSizeInMegaBytes = fileSizeInKiloBytes / 1000
      if (fileSizeInMegaBytes > jimConfig.maxMbSize) {
        throw new Error(`File size too large ( ${fileSizeInMegaBytes} MBytes) limit is: ${jimConfig.maxMbSize} MBytes`)
      }
      // compress the binary data before to convert to base64
      const encodedFileData = zlib.deflateSync(Buffer.from(bufferData)).toString('base64')

      const encodedFileDataSize = encodedFileData.length

      // Confirm user has enough funding!!!
      const fileFee = feeManagerSingleton.calculateFileFee(encodedFileDataSize)
      const userBalance = +(await jupiterFundingService.getBalance(fromAccountProperties.address))
      if (userBalance < fileFee) {
        throw new Error(
          `User ${fromAccountProperties.address} does not have enough funding for file fee ${fileFee}. user balance: ${userBalance}`
        )
      }

      const chunks = encodedFileData.match(CHUNK_SIZE_PATTERN)
      logger.sensitive(`chunks.length=${JSON.stringify(chunks.length)}`)
      // Send Each Chunk as a transaction.
      const sendMessageResponsePromises = chunks.map((chunk) => {
        // @INFO chunks will not be encrypted. Not necessary for e2e
        logger.info(`sending chunk (${chunk.length})....`)
        return this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
          fromAccountProperties.passphrase,
          toAccountProperties.address,
          chunk,
          `${transactionTags.jimServerTags.binaryFileChunk}.${fileUuid}`,
          FeeManager.feeTypes.metisMessage,
          toAccountProperties.publicKey
        )
      })
      const sendMessageResponses = await Promise.all(sendMessageResponsePromises)
      logger.sensitive(`sendMessageResponses.length=${JSON.stringify(sendMessageResponses.length)}`)
      const linkedFileRecords = null
      let allChunkTransactionsData = null
      if (fileCat === FileCategory.PublicProfile || fileCat === FileCategory.ChannelProfile) {
        const allChunkTransactionsInfo = this.transactionUtils.extractTransactionInfoFromTransactionResponses(
          sendMessageResponses,
          ['transactionId', 'nonce']
        )
        allChunkTransactionsData = await allChunkTransactionsInfo.reduce(async (reduced, tInfo) => {
          const sharedKey = await this.jupiterTransactionsService.getSharedKey(
            toAccountProperties.address,
            toAccountProperties.passphrase,
            tInfo.nonce
          )
          const data = await reduced
          return [...data, { ...tInfo, sharedKey }]
        }, Promise.resolve([]))
      } else {
        const allChunkTransactionsInfo = this.transactionUtils.extractTransactionInfoFromTransactionResponses(
          sendMessageResponses,
          ['transactionId']
        )
        allChunkTransactionsData = allChunkTransactionsInfo.map((info) => info.transactionId)
      }
      console.log('\n')
      logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
      logger.info(`++ allChunkTransactionsData: ${JSON.stringify(allChunkTransactionsData)}`)
      logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n')

      const fileUrl = fileCat === FileCategory.PublicProfile ? `v1/jim/files/${fileUuid}` : `v1/jim/files/${fileUuid}`

      const fileRecord = this.generateFileRecordJson(
        fileUuid,
        fileCat,
        fileName,
        mimeType,
        fileSizeInBytes,
        allChunkTransactionsData,
        fromAccountProperties.address,
        linkedFileRecords,
        fileUrl
      )

      const _fileRecord =
        fileCat === FileCategory.PublicProfile || fileCat === FileCategory.ChannelProfile
          ? JSON.stringify(fileRecord)
          : toAccountProperties.crypto.encryptJsonGCM(fileRecord)
      if (!this.fileCacheService.bufferDataExists(fileUuid)) {
        this.fileCacheService.sendBufferDataToCache(fileUuid, bufferData)
      }
      const sendMessageResponseFileRecord =
        await this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
          toAccountProperties.passphrase,
          toAccountProperties.address,
          _fileRecord,
          `${transactionTags.jimServerTags.binaryFileRecord}.${fileUuid}`,
          FeeManager.feeTypes.metisMessage,
          toAccountProperties.publicKey
        )

      const [xInfo] = this.transactionUtils.extractTransactionInfoFromTransactionResponses(
        [sendMessageResponseFileRecord],
        ['transactionId', 'nonce']
      )
      const nonce = xInfo.nonce
      const xSharedKey = await this.jupiterTransactionsService.getSharedKey(
        toAccountProperties.address,
        toAccountProperties.passphrase,
        nonce
      )

      if (fileCat === FileCategory.PublicProfile || fileCat === FileCategory.ChannelProfile) {
        const crypto = new GravityCrypto(process.env.ENCRYPT_ALGORITHM, xSharedKey)
        const encryptedFileRecord = crypto.encryptJsonGCM(fileRecord)
        this.fileCacheService.sendFileRecordToCache(fileUuid, encryptedFileRecord)
        // const sendMessageResponsePublicFileSharedKey =
        //   await this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
        //     toAccountProperties.passphrase,
        //     toAccountProperties.address,
        //     _fileRecord,
        //     `${transactionTags.jimServerTags.binaryFilePublicProfileSharedKey}.${fileUuid}.${xInfo.transactionId}.${xSharedKey}.${metisConfig.evm}`,
        //     FeeManager.feeTypes.metisMessage,
        //     toAccountProperties.publicKey
        //   )
        return { fileRecord: encryptedFileRecord, sharedKey: xSharedKey }
      }

      const encryptedFileRecord = toAccountProperties.crypto.encryptJsonGCM(fileRecord)
      this.fileCacheService.sendFileRecordToCache(fileUuid, encryptedFileRecord)

      return { fileRecord: _fileRecord }
    } catch (error) {
      logger.error('****************************************************************')
      logger.error('** sendFileToBlockchain.catch(error)')
      logger.error('****************************************************************')
      logger.error(`error= ${error}`)
      throw error
    }
  }

  /**
   * @param {string} fileUuid
   * @param {('raw'|'thumbnail')} fileCat
   * @param {string} fileName
   * @param {string} mimeType
   * @param {number} sizeInBytes
   * @param chunkTransactionIds
   * @param {string} createdByAddress
   * @param {null|object[]} linkedFileRecords
   * @return {{fileName, fileCat, recordType: string, chunkTransactionIds, mimeType, sizeInKb, originalSenderAddress, linkedFileRecord, version: number, fileUuid, url: string, status: string}}
   */
  generateFileRecordJson(
    fileUuid,
    fileCat,
    fileName,
    mimeType,
    sizeInBytes,
    chunkTransactionIds,
    createdByAddress,
    linkedFileRecords,
    fileUrl
  ) {
    logger.verbose('#### generateFileRecordJson()')
    if (!gu.isNonEmptyString(fileUuid)) throw new mError.MetisError('empty fileUuid')
    if (!gu.isNonEmptyString(fileName)) throw new mError.MetisError('empty fileName')
    if (!gu.isNonEmptyString(mimeType)) throw new mError.MetisError('empty mimeType')
    if (!gu.isNumberGreaterThanZero(sizeInBytes)) throw new mError.MetisError(`size is invalid: ${sizeInBytes}`)
    if (!gu.isNonEmptyArray(chunkTransactionIds)) throw new mError.MetisError('chunkTransactionIds is not valid.')
    if (!gu.isWellFormedJupiterAddress(createdByAddress)) {
      throw new mError.MetisErrorBadJupiterAddress('originalSenderAddress')
    }
    // const _transactionIdOfPreviousVersion = (transactionIdOfPreviousVersion===null)?'':transactionIdOfPreviousVersion;
    return {
      fileUuid,
      recordType: 'fileRecord',
      status: 'active',
      fileCat,
      fileName,
      mimeType,
      sizeInBytes,
      url: fileUrl,
      createdAt: Date.now(),
      createdBy: createdByAddress,
      linkedFileRecords,
      chunkTransactionIds,
      version: 1
    }
  }
}

module.exports.StorageService = StorageService
module.exports.storageService = new StorageService(
  jupiterAPIService,
  jupiterTransactionsService,
  jupiterFundingService,
  jupiterAccountService,
  jimConfig,
  transactionUtils,
  chanService,
  localFileCacheService
)
