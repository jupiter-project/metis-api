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
     * @param jupiterFundingService
     * @param jupiterAccountService
     * @param tableService
     * @param gravity
     */
  constructor(
    applicationGravityAccountProperties,
    jupApi,
    jupiterFundingService,
    jupiterAccountService,
    tableService,
    gravity) {
      if(!applicationGravityAccountProperties){throw new Error('missing applicationGravityAccountProperties')}
      if(!jupApi){throw new Error('missing jupiterAPIService')}
      if(!jupiterFundingService){throw new Error('missing jupiterFundingService')}
      if(!jupiterAccountService){throw new Error('missing jupiterAccountService')}
      if(!tableService){throw new Error('missing tableService')}
      if(!gravity){throw new Error('missing gravity')}
      this.applicationAccountProperties = applicationGravityAccountProperties;
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

  async isAliasAvailable(aliasName){
      return this.jupApi.getAlias(aliasName)
          .then(response => {
              return false;
          })
          .catch( error => {
              if(error === 'Unknown alias'){
                  return true;
              }
              throw error;
          })
  }

    /**
     *
     * @param newAccountAddress
     * @param newAccountAliasName
     * @param newAccountPassphrase
     * @param newAccountPassword
     * @returns {Promise<unknown>}
     */
  async register(newAccountAddress, newAccountAliasName, newAccountPassphrase, newAccountPassword) {
    logger.verbose('###########################################');
    logger.verbose('## register(newAccountAddress, newAccountAliasName, newAccountPassphrase, newAccountPassword)');
    logger.verbose('##');
    logger.verbose('##');

    return new Promise(async (resolve, reject) => {
        const isAliasAvailable = await this.isAliasAvailable(newAccountAliasName);

        if(!isAliasAvailable){
            return reject('Alias is already in use');
        }

        const promises = [];
        promises.push(this.jupiterAccountService.fetchAccountStatement(
            this.applicationAccountProperties.address,
            this.applicationAccountProperties.passphrase,
            this.applicationAccountProperties.password,
            'metis-account',
            'app'
        ));

        promises.push(this.jupiterAccountService.fetchAccountStatement(
            newAccountAddress,
            newAccountPassphrase,
            newAccountPassword,
            'new-user-account',
            'user'
        ));

        Promise.all(promises)
            .then( async promiseResults =>{
            const [appStatement, newAccountStatement] = promiseResults;
            const applicationUsersTableStatement = appStatement.attachedTables.find( table => table.statementId === 'table-users');
            if (!applicationUsersTableStatement) {
                reject('there is no application users table!');
            }
            if(this.isAccountRegisteredWithApp(newAccountAddress, appStatement.records)){
                return reject('account is already registered');
            }
            const sendMoneyResponse = await this.jupiterFundingService.provideInitialStandardUserFunds(newAccountStatement.properties);
            this.jupiterFundingService.waitForTransactionConfirmation(sendMoneyResponse.data.transaction)// TODO This should probably go to JupiterTransactionsService
                .then( async ()=>{
                    const fundedAccountStatement = await this.jupiterAccountService.fetchAccountStatement(
                        newAccountAddress,
                        newAccountPassphrase,
                        newAccountPassword,
                        'new-user-account',
                        'user'
                    );
                    const promises = []
                    promises.push(this.attachMissingDefaultTables(
                        fundedAccountStatement.attachedTables,
                        fundedAccountStatement.properties
                    ));
                    promises.push(this.jupApi.setAlias({
                        alias: newAccountAliasName,
                        passphrase: newAccountPassphrase,
                        account: newAccountAddress
                    }))
                    Promise.all(promises).then( async (results)=>{
                        const [newlyAttachedTables, setAliasResponse] = results;
                        const aliasObject = {
                            "aliasURI": setAliasResponse.data.transactionJSON.attachment.uri,
                            "aliasName": setAliasResponse.data.transactionJSON.attachment.alias,
                            "accountRS": setAliasResponse.data.transactionJSON.senderRS,
                        }
                        fundedAccountStatement.properties.addAlias(aliasObject);
                        const wait =[]
                        wait.push(this.jupiterFundingService.waitForAllTransactionConfirmations(newlyAttachedTables.transactionsReport));
                        Promise.all(wait).then( async () => {
                            const addRecordToMetisUsersTableResponse = await this.jupiterAccountService.addRecordToMetisUsersTable(fundedAccountStatement.properties, applicationUsersTableStatement.properties)
                            await this.jupiterFundingService.waitForAllTransactionConfirmations(addRecordToMetisUsersTableResponse.transactionsReport)
                            const metisAppRegistrationData = this.printRegistrationData(
                                this.applicationAccountProperties.address,
                                this.applicationAccountProperties.passphrase,
                                this.applicationAccountProperties.password,
                                'metis-app',
                                'app'
                            )
                            const newUserRegistrationData = this.printRegistrationData(
                                newAccountAddress,
                                newAccountPassphrase,
                                newAccountPassword,
                                'new-user',
                                'user'
                            )

                            Promise.all([metisAppRegistrationData, newUserRegistrationData]).then( results => {
                                results.forEach(report => {
                                    logger.sensitive(report);
                                })
                            })

                            console.log('DONE.');
                            return resolve('done')
                        }  )

                    })
                })
                .catch( error => {
                    logger.error('************************************************');
                    logger.error('**  waitForTransactionConfirmation().catch(error)');
                    logger.error('**');
                    return reject(error);
                })
        } )
            .catch(error => {
                logger.error(`***********************************************************************************`);
                logger.error(`** register(newAccountAddress, newAccountAliasName, newAccountPassphrase, newAccountPassword).fetchAccountStatement().then()`);
                logger.error(`** `);
                console.log(error);
                return reject(error);
            })
    });
  }

    /**
     *
     * @param currentlyAttachedTableStatements
     * @param tableOwnerProperties
     * @returns {Promise<unknown>}
     */
    async attachMissingDefaultTables(currentlyAttachedTableStatements, tableOwnerProperties) {
        logger.verbose('#####################################################################################');
        logger.verbose('## attachMissingDefaultTables(currentlyAttachedTables, accountProperties)');
        logger.verbose('##');
        if (!tableOwnerProperties) {
            throw new Error('accountProperties is missing')
        }
        logger.sensitive(`attaching tables to: ${tableOwnerProperties.address}`)
        return new Promise((resolve, reject) => {
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
            Promise.all(tablesToAttach)
                .then(async (tablesToAttachResults) => { // [{name, address, passphrase, publicKey, sendMoneyTransactionId}]
                    this.tableService.createTableListRecord(tableOwnerProperties, this.defaultTableNames())
                        .then(response => {
                            logger.verbose('------------------------------------------------------------------');
                            logger.verbose(`-- attachMissingDefaultTables().createTableListRecord().then()`);
                            logger.verbose('-- ');

                            const transactionsReport = []
                            transactionsReport.concat(response.transactionsReport);
                            transactionsReport.concat(tablesToAttachResults.transactionsReport);
                            return resolve({
                                data:
                                    {
                                        newTables: tablesToAttachResults
                                    },
                                transactionsReport: transactionsReport
                            });
                        })
                })
                .catch((error) => {
                    logger.error(`********************************************`)
                    logger.error(`** There was a problem attaching a table!`)
                    logger.error(`** Attaching to the account: ${tableOwnerProperties.address}`)
                    logger.error('**')
                    console.log(error);
                    reject(error);
                });
        });
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
                        data: {
                            name: response.name,
                            address: response.address,
                            passphrase: response.passphrase,
                            publicKey: response.publicKey
                        },
                        transactionsReport: response.transactionsReport
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

    async printRegistrationData(address,passphrase, password,statementId, accountType){
        logger.debug(`address= ${address}`);
        return this.jupiterAccountService.fetchAccountStatement(
            address,
            passphrase,
            password,
            statementId,
            accountType
        ).then( statement => {

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
  passphrase: ${statement.properties.passphrase}
  password: ${statement.properties.password}
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
            
ths end.              
              `
        } )
    }

    printTableStatement(attachedTables){
        const tables = attachedTables.reduce( (reduced, tableStatement) => {

            let count = 0
            const records = tableStatement.records.slice(-15).reverse().reduce( (recordStatement, record) => {
                count++;
                return `(${count}) ` + recordStatement + JSON.stringify(record) + `\n\n`
            }, '' )

            const messages = tableStatement.messages.slice(-15).reverse().reduce( (messageStatement, message) => {
                return messageStatement + JSON.stringify(message) + `\n\n`
            }, '' )

            const transactions = tableStatement.transactions.slice(-15).reverse().reduce( (transactionStatement, transaction) => {
                transaction.attachment.encryptedMessage.data = ''
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

module.exports.AccountRegistration = AccountRegistration;
module.exports.accountRegistration = new AccountRegistration(
    metisGravityAccountProperties,
    jupiterAPIService,
    jupiterFundingService,
    jupiterAccountService,
    tableService,
    gravity
)
