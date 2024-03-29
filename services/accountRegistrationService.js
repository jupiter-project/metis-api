const logger = require('../utils/logger')(module)
const gu = require('../utils/gravityUtils')
const { metisGravityAccountProperties, GravityAccountProperties } = require('../gravity/gravityAccountProperties')
const { jupiterAccountService } = require('./jupiterAccountService')
const { tableService } = require('./tableService')

/**
 *
 */
class AccountRegistration {
  /**
   *
   * @param applicationGravityAccountProperties
   * @param jupApi
   * @param {JupiterTransactionsService} jupiterTransactionsService
   * @param jupiterFundingService
   * @param jupiterAccountService
   * @param tableService
   * @param gravity
   */
  constructor(
    applicationGravityAccountProperties,
    jupApi,
    jupiterTransactionsService,
    jupiterFundingService,
    jupiterAccountService,
    tableService,
    gravity
  ) {
    // if(!(binaryAccountJob instanceof BinaryAccountJob)){throw new Error('binaryAccountJob is invalid')}
    if (!applicationGravityAccountProperties) {
      throw new Error('missing applicationGravityAccountProperties')
    }
    if (!jupApi) {
      throw new Error('missing jupiterAPIService')
    }
    if (!jupiterTransactionsService) {
      throw new Error('missing jupiterTransactionsService')
    }
    if (!jupiterFundingService) {
      throw new Error('missing jupiterFundingService')
    }
    if (!jupiterAccountService) {
      throw new Error('missing jupiterAccountService')
    }
    if (!tableService) {
      throw new Error('missing tableService')
    }
    if (!gravity) {
      throw new Error('missing gravity')
    }
    this.applicationAccountProperties = applicationGravityAccountProperties
    this.jupiterTransactionsService = jupiterTransactionsService
    this.jupApi = jupApi
    this.jupiterFundingService = jupiterFundingService
    this.jupiterAccountService = jupiterAccountService
    this.tableService = tableService
    this.gravity = gravity
    // this.binaryAccountJob = binaryAccountJob;
  }

  /**
   *
   * @return {string[]}
   */
  defaultTableNames() {
    return ['storage']
  }

  /**
   *
   * @param tableName
   * @param tables
   * @return {*}
   */
  findTableByName(tableName, tables) {
    const filtered = tables.filter((table) => table.name == tableName)
    if (filtered.length > 0) {
      return filtered[0]
    }
  }

  /**
   *
   * @param address
   * @return {Promise<boolean>}
   */
  async isAccountRegisteredWithApp(address) {
    logger.verbose(`#### isAccountRegisteredWithApp(address)`)
    logger.sensitive(`address=${JSON.stringify(address)}`)
    if (!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address: ${address}`)
    const tag = userConfig.userRecord
    const transactions = await this.jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(
      address,
      tag
    )
    console.log(`length: ${transactions.length}`)
    if (!gu.isNonEmptyArray(transactions)) return false
    return true
  }


  /**
   * @Description This is for brand new jupiter accounts in contrast to an existing jupiter account that needs to be
   * registered with Metis.
   *
   * @TODO What if the account was already created by a different Metis Node?
   * @param {string} newAccountPassword
   * @return {Promise<GravityAccountProperties>}
   */
  async createNewAccount(newAccountPassword) {
    logger.verbose('#### createNewAccount(newAccountAliasName, newAccountPassword))')
    if (!gu.isStrongPassword(newAccountPassword)) {
      throw new MetisErrorWeakPassword()
    }
    try {
      const newAccountProperties = await instantiateGravityAccountProperties(
        gu.generatePassphrase(),
        newAccountPassword
      )
      return newAccountProperties
    } catch (error) {
      logger.error(`****************************************************************`)
      logger.error(`** createNewAccount(newAccountPassword).catch(error)`)
      logger.error(`****************************************************************`)
      logger.error(`error= ${error}`)
      throw error
    }
  }

  /**
   *
   * @param {GravityAccountProperties} newAccountProperties
   * @param {string} newAccountAliasName
   * @return {Promise<void>}
   */
  async register3(newAccountProperties, newAccountAliasName) {
    logger.verbose('#### register3(newAccountProperties, newAccountAliasName))')
    if (!(newAccountProperties instanceof GravityAccountProperties))
      throw new mError.MetisErrorBadGravityAccountProperties(`newAccountProperties`)
    if (!gu.isWellFormedJupiterAlias(newAccountAliasName))
      throw new mError.MetisErrorBadJupiterAlias(newAccountAliasName)
    try {
      //  First: check if Account is not already registered
      console.log(`\n`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--`)
      logger.info(`  First: check if Account is not already registered: ${newAccountProperties.address}`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n`)
      const isAlreadyRegistered = await this.isAccountRegisteredWithApp(newAccountProperties.address)
      if (isAlreadyRegistered) {
        throw new Error('Account is already registered')
      }
      // First: Make sure the alias is available
      console.log(`\n`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--`)
      logger.info(` First: Make sure the alias is available`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n`)
      const isAliasAvailable = await this.jupiterAccountService.isAliasAvailable(newAccountAliasName)
      if (!isAliasAvailable) throw new MetisError('alias is already in user')
      // Second: Provide Funds to the new user account
      console.log(`\n`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--`)
      logger.info(` Second: Provide Funds to the new user account`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n`)
      const provideInitialStandardUserFundsResponse = await this.jupiterFundingService.provideInitialStandardUserFunds(
        newAccountProperties
      )
      const transactionIdForUserFundingTransactionId = provideInitialStandardUserFundsResponse.data.transaction

      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--`)
      logger.info(` Waiting for money to be confirmed`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n`)
      await this.jupiterFundingService.waitForTransactionConfirmation(transactionIdForUserFundingTransactionId)
      // Third: Add the UserRecord transaction
      console.log(`\n`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--`)
      logger.info(` Third: Add the UserRecord transaction`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n`)
      // await this.jupiterAccountService.addUserRecordToUserAccount(newAccountProperties);
      const addUserRecordToUserAccountResponse = await this.jupiterAccountService.addUserRecordToUserAccount(
        newAccountProperties
      )
      await this.jupiterFundingService.waitForTransactionConfirmation(addUserRecordToUserAccountResponse.transaction)
      // Fourth: Set The Alias
      console.log(`\n`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--`)
      logger.info(` NEXT: Set The Alias`)
      logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n`)
      const aliasResponse = await this.jupApi.setAlias(
        newAccountProperties.address,
        newAccountProperties.passphrase,
        newAccountAliasName
      )
      await this.jupiterFundingService.waitForTransactionConfirmation(aliasResponse.data.transaction)

      return
    } catch (error) {
      logger.error(`****************************************************************`)
      logger.error(`** register3(newAccountProperties, newAccountAliasName).catch(error)`)
      logger.error(`****************************************************************`)
      logger.error(`error= ${error}`)
      throw error
    }
  }

  /**
   *
   * @param {object} currentlyAttachedTableStatements
   * @param {GravityAccountProperties} tableOwnerProperties
   * @returns {Promise<{data: {newTables:[]}, transactionsReport}>}
   */
  attachMissingDefaultTables(currentlyAttachedTableStatements, tableOwnerProperties) {
    logger.verbose('#### attachMissingDefaultTables(currentlyAttachedTableStatements, tableOwnerProperties)')
    if (!tableOwnerProperties) {
      throw new Error('accountProperties is missing')
    }
    logger.sensitive(`attaching tables to: ${tableOwnerProperties.address}`)

    const listOfAttachedTableNames = currentlyAttachedTableStatements.map((statement) => statement.tableName)
    logger.debug(`listOfAttachedTableNames= ${listOfAttachedTableNames}`)
    logger.debug(`listOfdefaultTableNames= ${this.defaultTableNames()}`)
    const listOfMissingTableNames = this.defaultTableNames().filter(
      (defaultTableName) => !listOfAttachedTableNames.includes(defaultTableName)
    )
    logger.debug(`listOfMissingTableNames= ${listOfMissingTableNames}`)
    const tablesToAttach = []
    for (let i = 0; i < listOfMissingTableNames.length; i++) {
      logger.debug(`Attaching a table: ${listOfMissingTableNames[i]} to the account: ${tableOwnerProperties.address}`)
      tablesToAttach.push(this.attachTable(listOfMissingTableNames[i], tableOwnerProperties)) //{name, address, passphrase, publicKey, sendMoneyTransactionId}
    }

    return Promise.all(tablesToAttach).then((tablesToAttachResults) => {
      // [{name, address, passphrase, publicKey, sendMoneyTransactionId}]
      return this.tableService
        .createTableListRecord(tableOwnerProperties, this.defaultTableNames())
        .then((createTableListRecordResponse) => {
          logger.verbose(`---- attachMissingDefaultTables().createTableListRecord().then()`)
          const transactionsReport = tablesToAttachResults.reduce((reduced, tablesToAttachResult) => {
            reduced = [...reduced, ...tablesToAttachResult.transactions]
            return reduced
          }, [])
          transactionsReport.push(createTableListRecordResponse.transactionReport)

          return { newTables: tablesToAttachResults, transactions: transactionsReport }
        })
    })
  }

  /**
   *
   * @param tableName
   * @param accountProperties
   * @returns {Promise<{name, address, passphrase, publicKey, sendMoneyTransactionId}>}
   */
  async attachTable(tableName, accountProperties) {
    logger.verbose(`#### attachTable(tableName=${tableName}, accountProperties)`)
    // @TODO before attaching make sure the table doesn't yet exist.
    return new Promise((resolve, reject) => {
      const accessData = accountProperties.generateAccessData()
      this.gravity
        .attachTable(accessData, tableName)
        .then((response) => {
          // {name, address, passphrase, publicKey, transactionsIds}
          logger.verbose('---------------------------------------------------------------------------------------')
          logger.verbose(
            `-- attachTable().gravity.attachTable(accessData, tableName = ${tableName}).THEN(res= ${!!response})`
          )
          logger.verbose('---------------------------------------------------------------------------------------')
          logger.sensitive(`accountProperties= ${JSON.stringify(accountProperties)}`)
          logger.sensitive(`response= ${JSON.stringify(response)}`)

          const attachTableResponse = {
            name: response.name,
            address: response.address,
            passphrase: response.passphrase,
            publicKey: response.publicKey,
            transactions: response.transactions
          }

          resolve(attachTableResponse)
        })
        .catch((error) => {
          logger.error('****************************')
          logger.error('** ERROR ATTACHING TABLE!')
          logger.error(`** attachTable().attachTable(accessData , tableName = ${tableName}).catch(error)`)
          logger.error('********************')
          logger.sensitive(`${JSON.stringify(accountProperties)}`)
          console.log(error)
          reject(error)
        })
    })
  }

  printRegistrationData(statement) {
    const records = statement.records
      .slice(-15)
      .reverse()
      .reduce((recordStatement, record) => {
        return recordStatement + JSON.stringify(record) + `\n\n`
      }, '')

    const messages = statement.messages
      .slice(-15)
      .reverse()
      .reduce((messageStatement, messageContainer) => {
        return messageStatement + JSON.stringify(messageContainer) + `\n\n`
      }, '')

    const transactions = statement.transactions
      .slice(-15)
      .reverse()
      .reduce((transactionStatement, transaction) => {
        return transactionStatement + JSON.stringify(transaction) + `\n\n`
      }, '')

    const tableStatement = this.printTableStatement(statement.attachedTables)

    const label = statement.statementId.toUpperCase()
    return `
            
#################################################################################################################
######## ##     ## ########     ######  ########    ###    ######## ######## ##     ## ######## ##    ## ######## 
   ##    ##     ## ##          ##    ##    ##      ## ##      ##    ##       ###   ### ##       ###   ##    ##    
   ##    ##     ## ##          ##          ##     ##   ##     ##    ##       #### #### ##       ####  ##    ##    
   ##    ######### ######       ######     ##    ##     ##    ##    ######   ## ### ## ######   ## ## ##    ##    
   ##    ##     ## ##                ##    ##    #########    ##    ##       ##     ## ##       ##  ####    ##    
   ##    ##     ## ##          ##    ##    ##    ##     ##    ##    ##       ##     ## ##       ##   ###    ##    
   ##    ##     ## ########     ######     ##    ##     ##    ##    ######## ##     ## ######## ##    ##    ##    
#################################################################################################################

         
  ${label}
  ------------
                      
  statement id: ${statement.statementId}
  address: ${statement.properties.address}
  password: ${statement.properties.password}
  passwordHash: ${statement.properties.passwordHash}
  passphrase: ${statement.properties.passphrase}
  balance: ${statement.balance}     
  unconfirmedBalance: ${statement.unconfirmedBalance}     
  record count: ${statement.records.length}     
  messages count: ${statement.messages.length}     
  attachedTables count: ${statement.attachedTables.length}     
  blockchainTransaction Count: ${statement.blockchainTransactionCount}
  transactions Count: ${statement.transactions.length}
  
  ${label} RECORDS
  -------------
  ${records}
            
  ${label} MESSAGES
  ---------------
  ${messages}
  
  ${label} TRANSACTIONS
  ---------------
  ${transactions}
  
  ${label} TABLES
  -------------
  ${tableStatement}
            
the end.              
              `
  }

  printTableStatement(attachedTables) {
    const tables = attachedTables.reduce((reduced, tableStatement) => {
      let count = 0
      const records = tableStatement.records
        .slice(-5)
        .reverse()
        .reduce((recordStatement, record) => {
          count++
          return `(${count}) ` + recordStatement + JSON.stringify(record) + `\n\n`
        }, '')

      const messages = tableStatement.messages
        .slice(-5)
        .reverse()
        .reduce((messageStatement, message) => {
          return messageStatement + JSON.stringify(message) + `\n\n`
        }, '')

      const transactions = tableStatement.transactions
        .slice(-5)
        .reverse()
        .reduce((transactionStatement, transaction) => {
          if (transaction.attachment.encryptedMessage) {
            transaction.attachment.encryptedMessage.data = ''
          }

          return transactionStatement + JSON.stringify(transaction) + `\n\n`
        }, '')

      const label = tableStatement.statementId

      const tableInfo = `
        -- ${label}
        
            statement id:${tableStatement.statementId}
            address: ${tableStatement.properties.address}
            passphrase: ${tableStatement.properties.passphrase}
            password: ${tableStatement.properties.password}
            balance: ${tableStatement.balance}                          
            unconfirmed balance: ${tableStatement.unconfirmedBalance}                          
            table name: ${tableStatement.tableName}   
            record count: ${tableStatement.records.length}     
            messages count: ${tableStatement.messages.length} 
            blockchainTransaction Count: ${tableStatement.blockchainTransactionCount}      
            transaction Count: ${tableStatement.transactions.length}      
            -- ${label} records -------------------------------------------------------- 
            ${records}
            -- ${label} messages --------------------------------------------------------
            ${messages}
            -- ${label} transactions  --------------------------------------------------------
            ${transactions}
         
                  `
      return reduced + tableInfo
    }, '')

    return tables
  }
}

const { jupiterAPIService } = require('./jupiterAPIService')
const { gravity } = require('../config/gravity')
const { jupiterFundingService } = require('./jupiterFundingService')
const { jupiterTransactionsService } = require('./jupiterTransactionsService')
const { instantiateGravityAccountProperties } = require('../gravity/instantiateGravityAccountProperties')
const { MetisError, MetisErrorWeakPassword } = require('../errors/metisError')
const mError = require('../errors/metisError')
const { userConfig } = require('../config/constants')
// const {binaryAccountJob, BinaryAccountJob} = require("../src/jim/jobs/binaryAccountJob");

module.exports.AccountRegistration = AccountRegistration
module.exports.accountRegistration = new AccountRegistration(
  metisGravityAccountProperties,
  jupiterAPIService,
  jupiterTransactionsService,
  jupiterFundingService,
  jupiterAccountService,
  tableService,
  gravity
)
