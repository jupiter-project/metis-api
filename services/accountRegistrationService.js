const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');
const {metisGravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {jupiterAccountService} = require("./jupiterAccountService");
const {tableService} = require("./tableService");

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
    gravity) {
      if(!applicationGravityAccountProperties){throw new Error('missing applicationGravityAccountProperties')}
      if(!jupApi){throw new Error('missing jupiterAPIService')}
      if(!jupiterTransactionsService){throw new Error('missing jupiterTransactionsService')}
      if(!jupiterFundingService){throw new Error('missing jupiterFundingService')}
      if(!jupiterAccountService){throw new Error('missing jupiterAccountService')}
      if(!tableService){throw new Error('missing tableService')}
      if(!gravity){throw new Error('missing gravity')}
      this.applicationAccountProperties = applicationGravityAccountProperties;
      this.jupiterTransactionsService = jupiterTransactionsService;
      this.jupApi = jupApi;
      this.jupiterFundingService = jupiterFundingService;
      this.jupiterAccountService = jupiterAccountService;
      this.tableService = tableService;
      this.gravity = gravity;
  }

  defaultTableNames() {
    return ['channels', 'invites', 'storage'];
  }


  findTableByName(tableName, tables) {
    const filtered = tables.filter(table => table.name == tableName);
    if (filtered.length > 0) {
      return filtered[0];
    }
  }

  isAccountRegisteredWithApp(clientAddress, appRecords){
      const userAccountPropertiesFoundInApplication = this.tableService.extractUserPropertiesFromRecordsOrNull(clientAddress, appRecords);
      return !!userAccountPropertiesFoundInApplication
  }

  // async isAliasAvailable(aliasName){
  //     return this.jupApi.getAlias(aliasName)
  //         .then(response => {
  //             return false;
  //         })
  //         .catch( error => {
  //             if(error === 'Unknown alias'){
  //                 return true;
  //             }
  //             throw error;
  //         })
  // }

    /**
     *
     * @param newAccountAddress
     * @param newAccountAliasName
     * @param newAccountPassphrase
     * @param newAccountPassword
     * @returns {Promise<unknown>}
     */
    register(newAccountAddress, newAccountAliasName, newAccountPassphrase, newAccountPassword) {
        logger.verbose('###########################################');
        logger.verbose('## register(newAccountAddress, newAccountAliasName, newAccountPassphrase, newAccountPassword)');
        logger.verbose('##');
        logger.verbose('##');

        return new Promise( (resolve, reject) => {
            let transactionIdForUserFunding = null;
            let newAndFundedAccountStatement = null;
            let metisAppAccountStatement = null;
            let usersTableStatement = null;

            this.jupiterTransactionsService.isAliasAvailable(newAccountAliasName)
                .then(isAliasAvailable => {
                    if(!isAliasAvailable){
                        throw new Error('alias is already in user');
                    }
                })
                .then( () => {
                    const promises = [];
                    promises.push(this.jupiterAccountService.fetchAccountStatement(
                        this.applicationAccountProperties.passphrase,
                        this.applicationAccountProperties.password,
                        'metis-account',
                        'app'
                    ));

                    promises.push(this.jupiterAccountService.fetchAccountStatement(
                        newAccountPassphrase,
                        newAccountPassword,
                        'new-user-account',
                        'user'
                    ));

                    return Promise.all(promises);
                })
                .then( promiseResults => {
                    const [appStatement, newAccountStatement] = promiseResults;
                    metisAppAccountStatement = appStatement;

                    usersTableStatement = metisAppAccountStatement.attachedTables.find( table => table.statementId === 'table-users');
                    if (!usersTableStatement) {
                        throw new Error('There is no application users table');
                    }
                    if(this.isAccountRegisteredWithApp(newAccountAddress, metisAppAccountStatement.records)){
                        throw new Error('Account is already registered');
                    }

                    return  this.jupiterFundingService.provideInitialStandardUserFunds(newAccountStatement.properties);
                })
                .then( provideInitialStandardUserFundsResponse => {
                    transactionIdForUserFunding = provideInitialStandardUserFundsResponse.data.transaction;
                    return this.jupiterFundingService.waitForTransactionConfirmation(provideInitialStandardUserFundsResponse.data.transaction);
                } )
                .then( () => {
                    return this.jupiterAccountService.fetchAccountStatement(
                        newAccountPassphrase,
                        newAccountPassword,
                        'new-user-account',
                        'user'
                    )

                })
                .then( fundedAccountStatement => {
                    newAndFundedAccountStatement = fundedAccountStatement;
                    const promises = [];
                    promises.push(this.attachMissingDefaultTables(fundedAccountStatement.attachedTables, fundedAccountStatement.properties ));
                    promises.push(this.jupApi.setAlias({alias: newAccountAliasName, passphrase: newAccountPassphrase, account: newAccountAddress}));

                    return Promise.all(promises);
                })
                .then(promiseResults => {

                    const [attachMissingDefaultTablesResponse, setAliasResponse ] = promiseResults;

                    const aliasObject = {
                        "aliasURI": setAliasResponse.data.transactionJSON.attachment.uri,
                        "aliasName": setAliasResponse.data.transactionJSON.attachment.alias,
                        "accountRS": setAliasResponse.data.transactionJSON.senderRS,
                    }
                    newAndFundedAccountStatement.properties.addAlias(aliasObject);

                    return this.jupiterFundingService.waitForAllTransactionConfirmations(attachMissingDefaultTablesResponse.transactions)
                })
                .then( () => {
                    return this.jupiterAccountService.addRecordToMetisUsersTable(newAndFundedAccountStatement.properties, usersTableStatement.properties)
                })
                .then( addRecordToMetisUsersTableResponse => {
                    return this.jupiterFundingService.waitForAllTransactionConfirmations(addRecordToMetisUsersTableResponse.transactionsReport)
                })
                .then( () => {
                    const metisAppRegistrationData = this.printRegistrationData(newAndFundedAccountStatement)
                    logger.sensitive(metisAppRegistrationData);
                    const newUserRegistrationData = this.printRegistrationData(metisAppAccountStatement)
                    logger.sensitive(newUserRegistrationData);
                    console.log('DONE.');

                    return resolve('done')
                })
                .catch( (error) => {
                    reject(error);
                })
        })
  }

    /**
     *
     * @param {object} currentlyAttachedTableStatements
     * @param {GravityAccountProperties} tableOwnerProperties
     * @returns {Promise<{data: {newTables:[]}, transactionsReport}>}
     */
    attachMissingDefaultTables(currentlyAttachedTableStatements, tableOwnerProperties) {
        logger.verbose('#####################################################################################');
        logger.verbose('## attachMissingDefaultTables(currentlyAttachedTableStatements, tableOwnerProperties)');
        logger.verbose('##');
        if (!tableOwnerProperties) { throw new Error('accountProperties is missing') }
        logger.sensitive(`attaching tables to: ${tableOwnerProperties.address}`)

        const listOfAttachedTableNames = currentlyAttachedTableStatements.map(statement => statement.tableName);
        logger.debug(`listOfAttachedTableNames= ${listOfAttachedTableNames}`);
        logger.debug(`listOfdefaultTableNames= ${this.defaultTableNames()}`);
        const listOfMissingTableNames = this.defaultTableNames().filter(defaultTableName => !listOfAttachedTableNames.includes(defaultTableName));
        logger.debug(`listOfMissingTableNames= ${listOfMissingTableNames}`);
        const tablesToAttach = [];
        for (let i = 0; i < listOfMissingTableNames.length; i++) {
            logger.debug(`Attaching a table: ${listOfMissingTableNames[i]} to the account: ${tableOwnerProperties.address}`)
            tablesToAttach.push(this.attachTable(listOfMissingTableNames[i], tableOwnerProperties)); //{name, address, passphrase, publicKey, sendMoneyTransactionId}
        }
        return Promise.all(tablesToAttach)
            .then( tablesToAttachResults => { // [{name, address, passphrase, publicKey, sendMoneyTransactionId}]
                return this.tableService.createTableListRecord(tableOwnerProperties, this.defaultTableNames())
                    .then(createTableListRecordResponse => {
                        logger.verbose('------------------------------------------------------------------');
                        logger.verbose(`-- attachMissingDefaultTables().createTableListRecord().then()`);
                        logger.verbose('-- ');
                        const transactionsReport = tablesToAttachResults.reduce(  (reduced, tablesToAttachResult) => {
                            reduced = [...reduced, ...tablesToAttachResult.transactions]
                            return reduced;
                        }, []);
                        transactionsReport.push(createTableListRecordResponse.transactionReport);

                        return {newTables: tablesToAttachResults, transactions: transactionsReport};
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
        logger.verbose('#########################################################');
        logger.verbose(`## attachTable(tableName=${tableName}, accountProperties)`);
        logger.verbose('##');

        // @TODO before attaching make sure the table doesn't yet exist.

        return new Promise((resolve, reject) => {
            const accessData = accountProperties.generateAccessData();
            this.gravity.attachTable(accessData, tableName)
                .then((response) => { // {name, address, passphrase, publicKey, transactionsIds}
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`-- attachTable().gravity.attachTable(accessData, tableName = ${tableName}).THEN(res= ${!!response})`);
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.sensitive(`accountProperties= ${JSON.stringify(accountProperties)}`)
                    logger.sensitive(`response= ${JSON.stringify(response)}`);

                    const attachTableResponse = {
                        name: response.name,
                        address: response.address,
                        passphrase: response.passphrase,
                        publicKey: response.publicKey,
                        transactions: response.transactions
                    }

                    resolve(attachTableResponse);
                })
                .catch((error) => {
                    logger.error('****************************');
                    logger.error('** ERROR ATTACHING TABLE!')
                    logger.error(`** attachTable().attachTable(accessData , tableName = ${tableName}).catch(error)`);
                    logger.error('********************');
                    logger.sensitive(`${JSON.stringify(accountProperties)}`)
                    console.log(error);
                    reject(error);
                });
        });
    }

    printRegistrationData(statement){

            const records = statement.records.slice(-15).reverse().reduce( (recordStatement, record) => {
                return recordStatement + JSON.stringify(record) + `\n\n`
            }, '' )

            const messages = statement.messages.slice(-15).reverse().reduce( (messageStatement, messageContainer) => {
                return messageStatement + JSON.stringify(messageContainer) + `\n\n`
            }, '' )

            const transactions = statement.transactions.slice(-15).reverse().reduce( (transactionStatement, transaction) => {
                return transactionStatement + JSON.stringify(transaction) + `\n\n`
            }, '' )

            const tableStatement = this.printTableStatement(statement.attachedTables)

            const label = statement.statementId.toUpperCase();
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

    printTableStatement(attachedTables){
        const tables = attachedTables.reduce( (reduced, tableStatement) => {

            let count = 0
            const records = tableStatement.records.slice(-5).reverse().reduce( (recordStatement, record) => {
                count++;
                return `(${count}) ` + recordStatement + JSON.stringify(record) + `\n\n`
            }, '' )

            const messages = tableStatement.messages.slice(-5).reverse().reduce( (messageStatement, message) => {
                return messageStatement + JSON.stringify(message) + `\n\n`
            }, '' )

            const transactions = tableStatement.transactions.slice(-5).reverse().reduce( (transactionStatement, transaction) => {
                if(transaction.attachment.encryptedMessage){
                    transaction.attachment.encryptedMessage.data = ''
                }

                return transactionStatement + JSON.stringify(transaction) + `\n\n`
            }, '' )

            const label = tableStatement.statementId;

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
            return reduced + tableInfo;
        }, '')

        return tables;
    }
}


const {jupiterAPIService} = require("./jupiterAPIService");
const { gravity} = require('../config/gravity');
const {jupiterFundingService} = require("./jupiterFundingService");
const {jupiterTransactionsService} = require("./jupiterTransactionsService");

module.exports.AccountRegistration = AccountRegistration;
module.exports.accountRegistration = new AccountRegistration(
    metisGravityAccountProperties,
    jupiterAPIService,
    jupiterTransactionsService,
    jupiterFundingService,
    jupiterAccountService,
    tableService,
    gravity
)
