const gu = require('../utils/gravityUtils')
const { channelConfig, metisConfig, userConfig } = require('../config/constants')
const gravity = require('../gravity/instantiateGravityAccountProperties')
const { gravityService } = require('./gravityService')
const { transactionUtils } = require('../gravity/transactionUtils')
const {
  BadGravityAccountPropertiesError,
  BadJupiterAddressError,
  MetisError,
  MetisErrorPublicKeyExists
} = require('../errors/metisError')
const { FeeManager, feeManagerSingleton } = require('./FeeManager')
const mError = require(`../errors/metisError`)
const {
  GravityAccountProperties,
  metisGravityAccountProperties,
  myTest
} = require('../gravity/gravityAccountProperties')
const { jupiterAPIService } = require('./jupiterAPIService')
const { tableService } = require('./tableService')
const { jupiterTransactionsService } = require('./jupiterTransactionsService')
const logger = require('../utils/logger')(module)

class JupiterAccountService {
  constructor(
    jupiterAPIService,
    applicationProperties,
    tableService,
    jupiterTransactionsService,
    gravityService,
    transactionUtils
  ) {
    if (!jupiterAPIService) {
      throw new Error('missing jupiterAPIService')
    }
    if (!applicationProperties) {
      throw new Error('missing applicationProperties')
    }
    if (!tableService) {
      throw new Error('missing tableService')
    }
    if (!jupiterTransactionsService) {
      throw new Error('missing jupiterTransactionsService')
    }

    this.jupiterAPIService = jupiterAPIService
    this.applicationProperties = applicationProperties
    this.tableService = tableService
    this.jupiterTransactionsService = jupiterTransactionsService
    this.gravityService = gravityService
    this.transactionUtils = transactionUtils
  }

  /**
   *
   * @param accountProperties
   * @param metisUsersTableProperties
   * @return {Promise<{data: *, transactionsReport: [{name: string, id: *}]}>}
   */
  // addRecordToMetisUsersTable(accountProperties, metisUsersTableProperties) {
  //     logger.verbose('###########################################################################');
  //     logger.verbose('## addRecordToMetisUsersTable(accountProperties, metisUsersTableProperties)');
  //     logger.verbose('##');
  //     if(!(accountProperties instanceof GravityAccountProperties)){throw new Error('accountProperties is not valid')}
  //     if(!(metisUsersTableProperties instanceof GravityAccountProperties)){throw new Error('metisUsersTableProperties is not valid')}
  //     logger.verbose(`  accountProperties.address= ${accountProperties.address}`);
  //     logger.verbose(`  metisUsersTableProperties.address= ${metisUsersTableProperties.address}`);
  //
  //     return this.generateId(accountProperties, metisUsersTableProperties)
  //         .then(async (transactionId) => {
  //             logger.verbose('---------------------------------------------------------------------------------');
  //             logger.verbose(`--- addRecordToMetisUsersTable()generateId().then(transactionId= ${transactionId})`);
  //             logger.verbose('--');
  //             const tag = `${userConfig.metisUserRecord}.${accountProperties.address}`;
  //             const userRecord = accountProperties.generateUserRecord(transactionId);
  //             const encryptedUserRecord = metisUsersTableProperties.crypto.encryptJson(userRecord);
  //
  //             return this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
  //                 metisUsersTableProperties.passphrase,
  //                 accountProperties.address,
  //                 encryptedUserRecord,
  //                 tag,
  //                 FeeManager.feeTypes.account_record,
  //                 accountProperties.publicKey
  //             )
  //                 .then(response => {
  //                     return {
  //                         data: response,
  //                         transactionsReport: [{name: 'users-table-record', id: response.transaction}]
  //                     }
  //                 })
  //         });
  // }

  /**
   *
   * @param userAccountProperties
   * @return {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
   */
  async addUserRecordToUserAccount(userAccountProperties) {
    const tag = `${userConfig.userRecord}.${userAccountProperties.address}.${metisConfig.evm}`
    const createdDate = Date.now()
    const userRecord = {
      recordType: 'userRecord',
      password: userAccountProperties.password,
      email: userAccountProperties.email,
      firstName: userAccountProperties.firstName,
      lastName: userAccountProperties.lastName,
      status: 'active',
      createdAt: createdDate,
      updatedAt: createdDate,
      version: 1
    }
    const encryptedUserRecord = userAccountProperties.crypto.encryptJsonGCM(userRecord)
    return this.jupiterTransactionsService.messageService
      .sendTaggedAndEncipheredMetisMessage(
        userAccountProperties.passphrase,
        userAccountProperties.address,
        encryptedUserRecord,
        tag,
        FeeManager.feeTypes.account_record,
        userAccountProperties.publicKey
      )
      .then((response) => {
        return response.transactionJSON
      })
  }

  /**
   *
   * @param accountProperties
   * @param metisUsersTableProperties
   * @returns {Promise<unknown>}
   */
  async generateId(accountProperties, metisUsersTableProperties) {
    logger.verbose('### generateId()')
    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record)
    const { subtype } = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record) //{type:1, subtype:12}

    return new Promise((resolve, reject) => {
      this.jupiterAPIService
        .sendSimpleNonEncipheredMetisMessage(
          metisUsersTableProperties,
          accountProperties,
          'Generating Id for record',
          fee,
          subtype,
          false
        )
        .then((response) => {
          return resolve(response.data.transaction)
        })
        .catch((error) => {
          return reject(error)
        })
    })
  }

  /**
   * @example {"unconfirmedBalanceNQT": "4999920","accountRS": "JUP-BSFE-VJKA-7HSM-DK2HZ","forgedBalanceNQT": "0",
   * "balanceNQT": "4999920","publicKey": "8e545ea2919fb3ec68879ac3afed497ae4d28e8441002175a7595456a8a4a62c",
   * "requestProcessingTime": 6372,"account": "13815937394035450284"}
   *
   * @param address
   * @returns {Promise<{unconfirmedBalanceNQT,accountRS,forgedBalanceNQT,balanceNQT,publicKey, requestProcessingTime, account}>}
   */
  async fetchAccountOrNull(address) {
    if (!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address`)

    return await this.jupiterAPIService
      .getAccount(address)
      .then((response) => {
        return response.data
      })
      .catch((error) => {
        if (error === 'Unknown account') {
          return null
        }
        if (error === 'Incorrect \\"account\\"') {
          return null
        }

        throw error
      })
  }

  /**
   *
   * @param address
   * @param passphrase
   * @param password
   * @param statementId
   * @param accountType
   * @param params
   * @returns {Promise<{GravityAccountProperties, balance, records,  attachedTables: []}>}
   */
  async fetchAccountStatement(passphrase, password, statementId = '', accountType = '', params = {}) {
    logger.verbose(
      `#### fetchAccountStatement(passphrase, password, statementId=${statementId}, accountType=${accountType})`
    )
    if (!gu.isWellFormedPassphrase(passphrase)) {
      throw new Error('problem with passphrase')
    }
    if (!gu.isNonEmptyString(password)) {
      throw new Error('password is not valid')
    }
    logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
    logger.sensitive(`passphrase=${passphrase}`)
    logger.sensitive(`password=${JSON.stringify(password)}`)
    logger.sensitive(`statementId=${JSON.stringify(statementId)}`)
    logger.sensitive(`accountType=${JSON.stringify(accountType)}`)
    logger.sensitive(`params=${JSON.stringify(params)}`)
    logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')

    try {
      const accountProperties = await gravity.instantiateGravityAccountProperties(passphrase, password)
      logger.sensitive(`address= ${accountProperties.address}`)
      const allBlockChainTransactions =
        await this.jupiterTransactionsService.getAllConfirmedAndUnconfirmedBlockChainTransactions(
          accountProperties.address
        )
      logger.sensitive(`allBlockChainTransactions.length= ${allBlockChainTransactions.length}`)
      const promises = []
      promises.push(this.fetchAccountOrNull(accountProperties.address))
      promises.push(
        this.jupiterTransactionsService.messageService.extractMessagesBySender(
          accountProperties,
          allBlockChainTransactions
        )
      )
      const [account, _transactionMessages] = await Promise.all(promises)
      const transactionMessages = _transactionMessages.map((message) => message.message)
      logger.sensitive(`transactionMessages.length= ${transactionMessages.length}`)
      let accountBalance = null
      let accountUnconfirmedBalance = null
      if (account && account.data) {
        accountProperties.accountId = account.data.account
        accountBalance = account.data.balanceNQT
        accountUnconfirmedBalance = account.data.unconfirmedBalanceNQT
      }
      const records = this.tableService.extractRecordsFromMessages(transactionMessages)
      logger.sensitive(`records.length= ${records.length}`)
      const attachedTablesProperties = this.tableService.extractTablesFromMessages(transactionMessages)
      logger.sensitive(`attachedTablesProperties.length= ${attachedTablesProperties.length}`)
      const attachedTablesStatementsPromises = []
      for (let i = 0; i < attachedTablesProperties.length; i++) {
        const tableAccountProperties = attachedTablesProperties[i]
        // console.log(tableAccountProperties);
        attachedTablesStatementsPromises.push(
          this.fetchAccountStatement(
            tableAccountProperties.passphrase,
            password,
            `table-${tableAccountProperties.name}`,
            'table',
            {
              tableName: tableAccountProperties.name
            }
          )
        )
      }
      const attachedTablesStatements = await Promise.all(attachedTablesStatementsPromises)
      logger.debug(`statementId= ${statementId}`)
      logger.debug(`attachedTables.length= ${attachedTablesStatements.length}`)

      const statement = {
        statementId: statementId,
        properties: accountProperties,
        balance: accountBalance,
        unconfirmedBalance: accountUnconfirmedBalance,
        records: records,
        messages: transactionMessages,
        attachedTables: attachedTablesStatements,
        blockchainTransactionCount: allBlockChainTransactions.length,
        transactions: allBlockChainTransactions
      }

      if (accountType === 'table') {
        statement.tableName = params.tableName
      }
      return statement
    } catch (error) {
      logger.sensitive('*****************************ERROR**************************************')
      logger.sensitive(`** fetchAccountStatement( passphrase, password, statementId = '', accountType, params = {})`)
      logger.sensitive(`** passphrase= ${passphrase} `)
      logger.sensitive(`** password= ${password} `)
      logger.sensitive(`** statementId= ${statementId} `)
      throw error
    }
  }

  /**
   *
   * @param accountProperties
   * @return {Promise<{allRecords: *, accountProperties, allMessages: *, attachedTables: *[]}>}
   */
  async fetchAccountData(accountProperties) {
    logger.verbose(`#### fetchAccountData(accountProperties): accountProperties.address=${accountProperties.address}`)
    const transactionMessagesContainers = await this.jupiterTransactionsService.fetchAllMessagesBySender(
      accountProperties
    )
    const transactionMessages = transactionMessagesContainers.map((messageContainer) => messageContainer.message)
    const attachedTables = this.tableService.extractTablesFromMessages(transactionMessages)
    logger.sensitive(`attachedTables= ${JSON.stringify(attachedTables)}`)
    const records = this.tableService.extractRecordsFromMessages(transactionMessages)
    const accountInformationResponse = await this.fetchAccountInfo(accountProperties.passphrase)
    accountProperties.publicKey = accountInformationResponse.publicKey
    return {
      attachedTables: attachedTables,
      allMessages: transactionMessagesContainers,
      allRecords: records,
      accountProperties: accountProperties
    }
  }

  /**
   * Retrieves all public keys associated to an address
   * @param {GravityAccountProperties} accountProperties
   * @returns {Promise<unknown>}
   */
  async getPublicKeysFromUserAccount(accountProperties) {
    logger.verbose(`#### getPublicKeysFromUserAccount(accountProperties)`)
    // logger.sensitive(`accountProperties= ${JSON.stringify(accountProperties)}`);
    if (!(accountProperties instanceof GravityAccountProperties)) {
      throw new Error('invalid accountProperties')
    }
    try {
      const publicKeyContainers =
        await this.jupiterTransactionsService.dereferenceListAndGetReadableTaggedMessageContainers(
          accountProperties,
          userConfig.userPublicKeyList
        )
      return publicKeyContainers.map((pkc) => {
        const { e2ePublicKey } = pkc.message
        if (!gu.isWellFormedE2EPublicKey(e2ePublicKey)) {
          throw new mError.MetisErrorBadJupiterPublicKey(e2ePublicKey)
        }
        return e2ePublicKey
      })
      // return  await this.gravityService.getLatestListByTag(accountProperties, userConfig.userPublicKeyList);
    } catch (error) {
      error.message = `getPublicKeysFromUserAccount: ${error.message}`
      logger.error(`${error}`)
      throw error
    }
  }


  /**
   *
   * @param e2ePublicKey
   * @param gravityAccountProperties
   * @param userAddress
   * @param userAlias
   * @param accountType
   * @return {Promise<void>}
   */
  async addE2EPublicKeyToJupiterAccount(
    e2ePublicKey,
    gravityAccountProperties,
    userAddress = null,
    userAlias = '',
    accountType = 'UserAccount'
  ) {
    logger.verbose(`#### addE2EPublicKeyToJupiterAccount(publicKey, gravityAccountProperties, accountType)`)
    if (!gu.isWellFormedE2EPublicKey(e2ePublicKey))
      throw new mError.MetisErrorBadJupiterPublicKey(`publicKey: ${e2ePublicKey}`)
    if (!(gravityAccountProperties instanceof GravityAccountProperties))
      throw new mError.MetisErrorBadGravityAccountProperties(`gravityAccountProperties`)
    if (!(accountType === 'UserAccount' || accountType === 'ChannelAccount'))
      throw new mError.MetisError(`invalid accountType: ${accountType}`)

    try {
      const checksumPublicKey = gu.generateChecksum(e2ePublicKey)
      let listTag = ''
      let recordTag = `${userConfig.userPublicKey}.${checksumPublicKey}.${metisConfig.evm}`
      let payload = ''

      if (accountType === 'UserAccount') {
        listTag = `${userConfig.userPublicKeyList}`
        payload = {
          recordType: 'e2eUserPublicKeyRecord',
          e2ePublicKey: e2ePublicKey,
          createdAt: Date.now(),
          version: 1
        }
      } else {
        if (!gu.isWellFormedJupiterAddress(userAddress))
          throw new mError.MetisErrorBadJupiterAddress(`userAddress: ${userAddress}`)
        listTag = `${channelConfig.channelMemberPublicKeyList}`
        recordTag = `${channelConfig.channelMemberPublicKey}.${userAddress}.${checksumPublicKey}.${metisConfig.evm}`
        payload = {
          recordType: 'e2eChannelMemberPublicKeyRecord',
          memberAccountAddress: userAddress,
          memberAccountAlias: userAlias,
          e2ePublicKey: e2ePublicKey,
          createdAt: Date.now(),
          version: 1
        }
      }
      const latestE2EPublicKeysContainers =
        await this.jupiterTransactionsService.dereferenceListAndGetReadableTaggedMessageContainers(
          gravityAccountProperties,
          listTag
        )

      const latestUserE2EPublicKeys = latestE2EPublicKeysContainers.map((containers) => containers.message)
      const latestUserE2ETransactionIds = latestE2EPublicKeysContainers.map((containers) => containers.transactionId)
      if (latestUserE2EPublicKeys.some((pk) => pk.e2ePublicKey === e2ePublicKey)) {
        throw new mError.MetisErrorPublicKeyExists('', e2ePublicKey)
      }
      //Send A New PublicKey Transaction
      const encryptedMessage = gravityAccountProperties.crypto.encryptJsonGCM(payload)
      const userE2EPublicKeyResponse =
        await jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
          gravityAccountProperties.passphrase,
          gravityAccountProperties.address,
          encryptedMessage,
          recordTag,
          FeeManager.feeTypes.account_record,
          gravityAccountProperties.publicKey
        )
      //Update the PublicKeys List
      latestUserE2ETransactionIds.push(userE2EPublicKeyResponse.transaction)
      const encryptedLatestUserE2ETransactionIds =
        gravityAccountProperties.crypto.encryptJsonGCM(latestUserE2ETransactionIds)
      await jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
        gravityAccountProperties.passphrase,
        gravityAccountProperties.address,
        encryptedLatestUserE2ETransactionIds,
        `${listTag}.${metisConfig.evm}`,
        FeeManager.feeTypes.account_record,
        gravityAccountProperties.publicKey
      )
    } catch (error) {
      if (error instanceof mError.MetisErrorPublicKeyExists) {
        logger.warn(`The PublicKey is already associated: ${e2ePublicKey}`)
        throw error
      }
      console.log('\n')
      logger.error(`************************* ERROR ***************************************`)
      logger.error(
        `* ** addE2EPublicKeyToJupiterAccount(publicKey, gravityAccountProperties, userAddress = null ,accountType = 'UserAccount').catch(error)`
      )
      logger.error(`************************* ERROR ***************************************\n`)

      logger.error(`error= ${error}`)
      throw error
    }
  }

  /**
   *
   * @param {string} passphrase
   * @returns {Promise<{address,accountId,publicKey,passphrase}>}
   */
  async fetchAccountInfo(passphrase) {
    logger.verbose(`#### fetchAccountInfo(passphrase)`)
    if (!gu.isWellFormedPassphrase(passphrase)) {
      throw new Error('passphrase is not valid')
    }
    return this.jupiterAPIService
      .getAccountId(passphrase)
      .then((response) => {
        return {
          address: response.data.accountRS,
          accountId: response.data.account,
          publicKey: response.data.publicKey,
          passphrase: passphrase
        }
      })
      .catch((error) => {
        logger.error(`********************************************`)
        logger.error('** fetchAccountInfo().fetchAccountId(passphrase).catch(error)')
        logger.error(`********************************************`)
        logger.error(`${error}`)
        throw error
      })
  }

  /**
   *
   * @param address
   * @returns {Promise<{aliasURI, aliasName, accountRS, alias, account, timestamp}[] | *[]>}
   */
  getAliasesOrEmptyArray(address) {
    logger.verbose(`##### getAliasesOrEmptyArray(address= ${address})`)
    if (!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address: ${address}`)
    // if(!gu.isWellFormedJupiterAddress(address)){throw new BadJupiterAddressError(address)}
    // if(!gu.isWellFormedJupiterAddress(address)){throw new Error(`Jupiter Address is not valid: ${address}`)}

    return this.jupiterAPIService
      .getAliases(address)
      .then((getAliasesResponse) => {
        logger.verbose(`---- getAliasesOrEmptyArray(address).jupiterAPI().getAliases().then()`)
        logger.debug(`address= ${address}`)
        if (getAliasesResponse.hasOwnProperty('data') && getAliasesResponse.data.hasOwnProperty('aliases')) {
          logger.debug(`aliases= ${getAliasesResponse.data.aliases}`)
          return getAliasesResponse.data.aliases
        }
        return []
      })
      .catch((error) => {
        if (error.message === 'Unknown account') {
          logger.warn('This account has no aliases')
          return []
        }

        logger.error(`***********************************************************************************`)
        logger.error(`*** getAliasesOrEmptyArray(address=${address}).catch(error)`)
        logger.error(`***********************************************************************************`)
        // console.log(error);
        logger.error(`${error}`)
        throw error
        // return [];
      })
  }

  /**
   *
   * @param aliasName
   * @returns {Promise<boolean>}
   */
  isAliasAvailable(aliasName) {
    logger.verbose(`#### isAliasAvailable(aliasName=${aliasName})`)
    return this.jupiterAPIService
      .getAlias(aliasName)
      .then((response) => {
        logger.verbose(`---- isAliasAvailable(aliasName=${aliasName}).then() : false`)
        return false
      })
      .catch((error) => {
        if (error instanceof mError.MetisErrorUnknownAlias) {
          return true
        }
        // if(error.name === "UnknownAliasError"){
        //     return true;
        // }

        logger.error(`***********************************************************************************`)
        logger.error(`** isAliasAvailable(aliasName).catch(error)`)
        logger.error(`** `)
        logger.error(`error=${error}`)
        console.log(error)
        throw error
      })
  }

  /**
   *
   * @param accountProperties
   * @returns {Promise<unknown>}
   */
  async getStatement(accountProperties) {
    logger.verbose('##############################################################')
    logger.verbose('## getStatement()')
    logger.verbose('##############################################################')
    return new Promise((resolve, reject) => {
      this.jupiterAPIService
        .getBalance(accountProperties.address)
        .then((response) => {
          let accountStatement = {}
          accountStatement.balanceNQT = response.data.balanceNQT
          accountStatement.hasMinimumAppBalance = null
          accountStatement.hasMinimumTableBalance = null

          if (this.applicationProperties.isApp()) {
            logger.info(
              `Balance: ${parseFloat(response.data.balanceNQT) / 10 ** this.applicationProperties.moneyDecimals} JUP.`
            )
            accountStatement.hasMinimumAppBalance =
              response.data.balanceNQT >= this.applicationProperties.minimumAppBalance
            accountStatement.hasMinimumTableBalance =
              response.data.balanceNQT >= this.applicationProperties.minimumTableBalance
          }

          return resolve(accountStatement)
        })
        .catch((error) => {
          logger.error(`${error}`)
          reject(error)
        })
    })
  }

  /**
   *
   * @param {string} memberPassphrase
   * @param {string} memberPassword
   * @return {Promise<null|GravityAccountProperties>}
   */
  async getMemberAccountPropertiesFromPersistedUserRecordOrNull(memberPassphrase, memberPassword) {
    logger.verbose(`##### getMemberAccountPropertiesFromPersistedUserRecordOrNull(memberPassphrase, memberPassword)`)
    if (!gu.isWellFormedPassphrase(memberPassphrase)) {
      throw new MetisError('memberPassphrase is invalid')
    }
    if (!gu.isNonEmptyString(memberPassword)) {
      throw new MetisError('memberPassword is empty')
    }
    console.log('aaa')
    console.log(typeof gravity.instantiateGravityAccountProperties)
    const memberAccountProperties = await gravity.instantiateGravityAccountProperties(memberPassphrase, memberPassword)
    console.log('FF')
    const messageContainers = await jupiterTransactionsService.getReadableTaggedMessageContainers(
      memberAccountProperties,
      `${userConfig.userRecord}.${memberAccountProperties.address}`,
      true,
      null,
      null,
      (transaction) => transaction.senderRS === memberAccountProperties.address
    )
    if (messageContainers.length === 0) {
      return null
    }
    const messageContainer = messageContainers[0] //{recordType, password, email, firstName, lastName, status, createdAt, updatedAt, version}
    memberAccountProperties.email = messageContainer.message.email
    memberAccountProperties.firstName = messageContainer.message.firstName
    memberAccountProperties.lastName = messageContainer.message.lastName
    memberAccountProperties.status = messageContainer.message.status
    memberAccountProperties.createdAt = messageContainer.message.createdAt
    memberAccountProperties.updatedAt = messageContainer.message.updatedAt

    return memberAccountProperties //get latest userRecord version
  }

  /**
   *
   * @param {string} aliasOrAddress
   * @return {Promise<{unconfirmedBalanceNQT, address: (string|*), publicKey, account}>}
   */
  async fetchAccountInfoFromAliasOrAddress(aliasOrAddress) {
    if (!gu.isNonEmptyString(aliasOrAddress)) throw new MetisError(`empty: aliasOrAddress`)
    let fetchAccountResponse = null
    if (gu.isWellFormedJupiterAddress(aliasOrAddress)) {
      fetchAccountResponse = await this.fetchAccountOrNull(aliasOrAddress).catch((error) => console.log(error))
    } else if (gu.isWellFormedJupiterAlias(aliasOrAddress)) {
      // It's an alias so lets get the address
      const getAliasResponse = await jupiterAPIService.getAlias(aliasOrAddress)
      const address = getAliasResponse.data.accountRS
      if (address) {
        fetchAccountResponse = await this.fetchAccountOrNull(address)
      }
    } else {
      throw new MetisError(`Account Not Found`)
    }

    if (fetchAccountResponse === null) {
      throw new MetisError(`Account Not Found`)
    }

    return {
      address: fetchAccountResponse.accountRS,
      publicKey: fetchAccountResponse.publicKey,
      account: fetchAccountResponse.account,
      unconfirmedBalanceNQT: fetchAccountResponse.unconfirmedBalanceNQT
    }
  }

}

module.exports.JupiterAccountService = JupiterAccountService

module.exports.jupiterAccountService = new JupiterAccountService(
  jupiterAPIService,
  metisGravityAccountProperties,
  tableService,
  jupiterTransactionsService,
  gravityService,
  transactionUtils
)
