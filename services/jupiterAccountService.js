const {FeeManager, feeManagerSingleton} = require("./FeeManager");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {fundingManagerSingleton} = require("./fundingManager");
const logger = require('../utils/logger')(module);


class JupiterAccountService {

    constructor(jupiterAPIService, applicationProperties, tableService, jupiterTransactionsService) {
        this.jupiterAPIService = jupiterAPIService;
        this.applicationProperties = applicationProperties;
        this.tableService = tableService;
        this.jupiterTransactionsService = jupiterTransactionsService;
    }


    // async checkIfAccountIsRegistered(accountProperties){
    //     return new Promise( (resolve, reject) => {
    //         return resolve(false)
    //     })
    // }










    async addRecordToMetisUsersTable(accountProperties, metisUsersTableProperties){
        logger.verbose('###########################################');
        logger.verbose('## addRecordToMetisUsersTable(accountProperties, metisUsersTableProperties)');
        logger.verbose('###########################################');
        logger.verbose(`accountProperties.address= ${accountProperties.address}`)
        logger.verbose(`metisUsersTableProperties.address= ${metisUsersTableProperties.address}`)
        logger.verbose(`metisUsersTableProperties.publicKey= ${metisUsersTableProperties.publicKey}`)

        return new Promise((resolve, reject) => {
            this.generateId(accountProperties, metisUsersTableProperties)
                .then(transactionId =>{
                    logger.verbose('----------------------------------------');
                    logger.verbose(`--- addRecordToMetisUsersTable()generateId().then(transactionId= ${transactionId})`);
                    logger.verbose('----------------------------------------');

                    logger.debug(`transactionId= ${transactionId}`)
                    const userRecord = accountProperties.generateUserRecord(transactionId);
                    const encryptedUserRecord = metisUsersTableProperties.crypto.encryptJson(userRecord)
                    logger.debug(`encryptedUserRecord= ${encryptedUserRecord}`)
                    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record);
                    const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}
                    this.jupiterAPIService.sendSimpleEncipheredMetisMessage(metisUsersTableProperties, accountProperties, encryptedUserRecord,fee, subtype)
                        .then(response => {
                            logger.verbose('----------------------------------------');
                            logger.verbose(`-- addRecordToMetisUsersTable()generateId().then(transactionId= ${transactionId}).sendSimpleEncipheredMetisMessage().then(response)`);
                            logger.verbose('----------------------------------------');

                            return resolve(response.data.transaction);
                        })
                        .catch(error => {
                            console.log(error);
                            // logger.error(`error= ${JSON.stringify(error)}`);
                            return reject(error);
                        })
                })
        })
    }


    /**
     * // callUrl = `${gravity.jupiter_data.server}/nxt?
     // requestType=sendMessage
     // &secretPhrase=${metisUsersTableProperties.passphrase}
     // &recipient=${metisUsersTableProperties.address}
     // &messageToEncrypt=${'Generating Id for record'}
     // &feeNQT=${100}
     // &deadline=${gravity.jupiter_data.deadline}
     // &recipientPublicKey=${metisUsersTableProperties.publicKey}
     // &compressMessageToEncrypt=true
     // &encryptedMessageIsPrunable=true`;
     * @param accountProperties
     * @param metisUsersTableProperties
     * @returns {Promise<unknown>}
     */
    async generateId(accountProperties, metisUsersTableProperties) {
        logger.verbose('###########################################');
        logger.verbose('## generateId()');
        logger.verbose('###########################################');
        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record);
        const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}



        return new Promise((resolve, reject) => {
            this.jupiterAPIService.sendSimpleNonEncipheredMetisMessage(
                metisUsersTableProperties,
                accountProperties,
                'Generating Id for record',
                fee,
                subtype,
                false
                )
                .then(response => {
                    return resolve(response.data.transaction);
                })
                .catch( error => {
                    return reject(error);
                })
        });
    }

    /**
     *
     * @returns {JupiterAccountService}
     */
    // getUserAccountService(){
    //     const userAccountService = this.getAccountService('user');
    //     return userAccountService;
    // }

    /**
     *
     * @param {string} name
     * @returns {JupiterAccountService}
     */
    // getAccountService(name){
    //     if(!this.accountServiceExists(name)){
    //         throw new Error(`No Account Services exists with name: ${name}`);
    //     }
    //     const accountServices = this.accountServices.filter( accountService => accountService.name == name );
    //     return accountServices[0];
    // }

    // fetchAccountTables(accountProperties){
    //     return new Promise((resolve, reject) => {
    //
    //         this.retrieveUserAccountPayload()
    //             .then((response) => {
    //                 logger.verbose('getUserAccount().retrieveUserAccountPayload().then()');
    //                 if (response.databaseFound && !response.userNeedsSave) {
    //                     return resolve(response);
    //                 } else if (response.userRecord) {
    //                     const currentDatabase = this.tableBreakdown(response.tables);
    //                     return resolve(response.tables);
    //                 }
    //                 // logger.debug(`response: ${JSON.stringify(response)}`);
    //                 // logger.debug('retrieveUserFromApp().before()');
    //                 this.retrieveAccountFromApp(
    //                     userAccountService.gravityAccountProperties.address,
    //                     userAccountService.gravityAccountProperties.passphrase
    //                 )
    //                     .then((res) => {
    //                         logger.verbose('getAccount().retrieveApplicationAccountPayload().then().retrieveAccountFromApp.then()')
    //                         res.noUserTables = response.noUserTables;
    //                         res.databaseFound = response.databaseFound;
    //                         res.database = response.database;
    //                         res.userNeedsSave = response.userNeedsSave;
    //                         res.tables = response.tables;
    //                         logger.debug(res);
    //                         return resolve(res);
    //                     })
    //                     .catch((error) => {
    //                         const errorMessage = `getUserAccount().retrieveUserAccountPayload().then().retrieveAccountFromApp().catch() > Error: ${error}`;
    //                         logger.error(errorMessage);
    //                         return reject(error);
    //                     });
    //
    //             })
    //             .catch(error => {
    //                 const errorMessage = `getAccount() error: ${error}`;
    //                 logger.error(errorMessage);
    //                 reject(error);
    //             });
    //     });
    // }

    /**
     *
     * @returns {Promise<{recordsFound,database,tables,user,databaseFound,userNeedsSave}>} - {recordsFound,database,tables,user,databaseFound,userNeedsSave}
     */
    // retrieveUserAccountPayload() {
    //     logger.verbose('retrieveUserAccountPayload()');
    //     const userAccountService = this.getUserAccountService();
    //
    //     return new Promise((resolve, reject) => {
    //         this.getUserAccountData()
    //             .then( userAccountData => { // { numberOfRecords,success,app: {tables,appData:{name,address,description}, address}, message, tables: {}, hasUserTable,userRecord }
    //                 logger.verbose(`retrieveUserAccountPayload().getUserAccountData().then()`);
    //                 logger.debug(JSON.stringify(userAccountData));
    //                 let appTables = userAccountData.app.tables;
    //                 let tables = userAccountData.tables;
    //                 let userRecord = userAccountData.userRecord;
    //                 if (!userAccountData.hasUserTable) {
    //                     // {tableList, success, noUserTables, tables, userRecord}
    //                     return resolve({
    //                         tableList: tables,
    //                         success: false,
    //                         noUserTables: true,
    //                         tables: appTables,
    //                         userRecord: userRecord,
    //                     });
    //                 }
    //
    //                 let recordTable = this.gravityTablesService.extractUsersTableFromAppTables(appTables);
    //                 logger.verbose(`TOTAL recordTable: ${recordTable.length}`);
    //                 if (recordTable === null) {
    //                     logger.debug(`No Record Table Found.`);
    //                     return resolve(`No Record Table Found.`);
    //                 }
    //
    //                 logger.debug(`recordTable: ${recordTable}`)
    //                 this.jupiterApi.getBlockChainMessageTransactions(recordTable.address)
    //                     .then((blockChainMessageTransactions) => {
    //                         logger.verbose(`retrieveApplicationAccountPayload().getUserAccountData().getBlockChainMessageTransactions().then()`);
    //                         const messageTransactions = userAccountService.transactions.filterMessageTransactionsByRecipientOrSender(blockChainMessageTransactions);
    //                         const messageTransactionIds = userAccountService.transactions.extractTransactionIds(messageTransactions);
    //                         logger.error(`this needs to get fixed!  ${recordTable}`);
    //                         userAccountService.readMessagesFromMessageTransactionIdsAndDecrypt(messageTransactionIds, crypto, passphrase)
    //                             .then(messages => {
    //                                 logger.verbose(`getAppAccountData().then().getBlockChainMessageTransactions().then().readMessagesFromMessageTransactionIds().then()`);
    //                                 logger.error(`Not sure which account to use for decruption+`);
    //                                 const decryptedMessages = userAccountService.messages.decryptMessages(
    //                                     messages,
    //                                     this.appJupiterAccountService.crypto
    //                                 );
    //                                 return resolve({
    //                                     recordsFound: 1,
    //                                     database: appTables,
    //                                     tables: undefined,
    //                                     user: decryptedMessages[0].user_record,
    //                                     databaseFound: true,
    //                                     userNeedsSave: false,
    //                                 });
    //
    //
    //                                 //no user record found
    //                                 // resolve({
    //                                 //   userRecord,
    //                                 //   tableList,
    //                                 //   noUserTables: false,
    //                                 //   tables: database,
    //                                 //   databaseFound: true,
    //                                 //   userNeedsSave: true,
    //                                 // });
    //
    //
    //                             })
    //                             .catch(error => {
    //                                 logger.error(`Error with Reading Messages: ${error}`);
    //                                 reject(`Error with Reading Messages: ${error}`);
    //                             })
    //                     })
    //                     .catch(error => {
    //                         const errorMessage = `getBlockChainMessageTransactions().catch() ${error}`;
    //                         logger.error(errorMessage);
    //                         reject(errorMessage);
    //                     })
    //             })
    //             .catch((error) => {
    //                 const errorMessage = `retrieveAccountFromPassphrase() getAppAccountData().catch() ${error}`
    //                 logger.error(errorMessage);
    //                 reject(errorMessage);
    //             });
    //     });
    // }




    /**
     *
     * @returns { numberOfRecords,success,app: {tables,appData:{name,address,description}, address}, message, tables: {}, hasUserTable,userRecord }
     */
    // getUserAccountData(accountProperties) { // ie gravity.loadAppData
    //     logger.verbose('getUserAccountData()');
    //     return new Promise((resolve, reject) => {
    //         this.getAccountData(accountProperties)
    //             .then( response => resolve(response))
    //             .catch( error => reject(error));
    //     })
    // }


//
//     return new Promise((resolve, reject) => {
//     this.jupiterTransactionsService.fetchMessages(accountProperties)  //gravity.getRecords()
// .then((transactionMessages) => {
//     logger.verbose('---------------------------------------------------------------------------------------');
//     logger.verbose(`fetchAttachedTables().fetchMessages().then(transactionMessages)`);
//     logger.verbose('---------------------------------------------------------------------------------------');
//     logger.sensitive(`transactionMessages= ${JSON.stringify(transactionMessages)}`);
//
//     // const tableProperties = this.tableService.extractTablePropertiesFromMessages('users' ,transactionMessages);
//     // logger.verbose(`TOTAL tableProperties: ${tableProperties.length}`);
//
// const attachedTables = this.extractTablesFromMessages(transactionMessages);
// logger.sensitive(`attachedTables= ${JSON.stringify(attachedTables)}`);
//
//     // let tableList = this.tableService.extractTableListFromRecords(records);
//     // logger.verbose(`TOTAL tableList: ${tableList.length}`);
//     // tableList = this.gravityObjectMapper.sortByDate(tableList);
//
//     // const currentList = this.gravityTablesService.extractCurrentListFromTableList(tableList);
//     // logger.verbose(`TOTAL currentList: ${currentList.length}`);
//     // const tableData = this.tableService.extractTableData(currentList, attachedTables);
//     // logger.verbose(`TOTAL tableData: ${tableData.length}`);
//
//     // let accountDataContainer = this.this.getAccountDataContainer()();
//     // accountDataContainer.numberOfRecords = recordsFound;
//     // accountDataContainer.tableNames = currentList;
//     // accountDataContainer.tableData = tableData;
//     // accountDataContainer.accountRecord = tableProperties;
//     // accountDataContainer.accountProperties = accountProperties;
//
// return resolve(attachedTables);
// })
// .catch((error) => {
// logger.error(`fetchMessagesContainer.catch() ${error}`);
// reject({success: false, error: 'There was an error loading records'});
// });
// });





    fetchAccountData(accountProperties) {
        logger.verbose('#####################################################################################');
        logger.verbose('## fetchAccountData(accountProperties)');
        logger.verbose('##');
        return new Promise((resolve, reject) => {

            this.jupiterTransactionsService.fetchMessages(accountProperties)
                .then((transactionMessages) => {
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`fetchAccountData().fetchMessages().then(transactionMessages)`);
                    logger.verbose('---------------------------------------------------------------------------------------');
                    // logger.sensitive(`transactionMessages= ${JSON.stringify(transactionMessages)}`);
                    // logger.sensitive(`transactionMessages= ${JSON.stringify(transactionMessages)}`);


                    const attachedTables = this.tableService.extractTablesFromMessages(transactionMessages);
                    logger.sensitive(`attachedTables= ${JSON.stringify(attachedTables)}`);
                    // logger.sensitive(`transactionMessages= ${JSON.stringify(transactionMessages)}`);


                    const records = this.tableService.extractRecordsFromMessages(transactionMessages);

                    this.jupiterAPIService.getAccountInformation(accountProperties.passphrase)
                        .then(accountInformationResponse => {
                            accountProperties.publicKey = accountInformationResponse.publicKey;
                            resolve({
                                attachedTables: attachedTables,
                                allMessages: transactionMessages,
                                allRecords: records,
                                accountProperties: accountProperties
                            })
                        })
                        .catch(error => {
                            reject(error);
                        })
                })
                .catch(error => {
                    reject(error);
                })
        });
    }


    /**
     *
     * @param { JupiterAccountService } accountService
     * @returns {Promise<unknown>}
     */
    // getAccountDataOld(address, passphrase, password) { // ie gravity.loadAppData
    //     logger.verbose('getUserAccountData()');
    //     return new Promise((resolve, reject) => {
    //         this.jupiterTransactionsService.fetchMessages()  //gravity.getRecords()
    //             .then((messagesContainer) => {
    //                 logger.verbose(`getAccountData().fetchMessagesContainer().then()`);
    //                 // { recordsFound: 1, pending: 1, records: [], last_record: undefined }
    //                 logger.debug(messagesContainer);
    //
    //                 const records = messagesContainer.records;
    //                 const recordsFound = messagesContainer.recordsFound;
    //                 // const pending = messagesContainer.pending;
    //                 // const last_record = messagesContainer.last_record;
    //
    //                 logger.verbose(`TOTAL Account Records: ${records.length}`);
    //
    //                 if (records.length === 0) {
    //                     logger.verbose(`No records found.`);
    //                     const appAccountDataContainer = this.generateNoRecordsFoundAppAccountDataContainer();
    //                     return resolve(appAccountDataContainer);
    //                 }
    //
    //                 const accountRecord = this.gravityTablesService.extractAccountRecordFromRecords(records);
    //                 logger.verbose(`TOTAL Account Records: ${accountRecord.length}`);
    //
    //                 const usersTable = this.gravityTablesService.extractUsersTableFromRecords(records);
    //                 logger.verbose(`TOTAL UsersTable: ${usersTable.length}`);
    //                 const hasUserTable = (usersTable !== null) ? false : true;
    //                 const tablesRetrieved = this.gravityTablesService.extractTablesRetrievedFromRecords(records);
    //
    //                 // Object.keys(myObject).length;
    //                 logger.verbose(`TOTAL tablesRetrieved: ${Object.keys(tablesRetrieved).length}`);
    //
    //                 logger.debug(JSON.stringify(tablesRetrieved));
    //
    //                 let tableList = this.gravityTablesService.extractTableListFromRecords(records);
    //                 logger.verbose(`TOTAL tableList: ${tableList.length}`);
    //                 // tableList = this.gravityObjectMapper.sortByDate(tableList);
    //                 const currentList = this.gravityTablesService.extractCurrentListFromTableList(tableList);
    //                 logger.verbose(`TOTAL currentList: ${currentList.length}`);
    //                 const tableData = this.gravityTablesService.extractTableData(currentList, tablesRetrieved);
    //                 logger.verbose(`TOTAL tableData: ${tableData.length}`);
    //
    //
    //
    //                 let accountDataContainer = this.getEmptyAccountDataContainer();
    //                 accountDataContainer.app.appData.name = this.appJupiterAccountService.gravityAccountProperties.firstName;
    //                 accountDataContainer.app.address = this.appJupiterAccountService.gravityAccountProperties.address;
    //                 accountDataContainer.app.appData.description = '';
    //                 accountDataContainer.app.tables = tableData;
    //                 accountDataContainer.numberOfRecords = recordsFound;
    //                 accountDataContainer.success = true;
    //                 accountDataContainer.message = 'Existing record found';
    //                 accountDataContainer.tables = currentList;
    //                 accountDataContainer.hasUserTable = hasUserTable;
    //                 accountDataContainer.userRecord = accountRecord;
    //
    //                 return resolve({
    //                     isRegistered: true,
    //                     attachedTables: attachedTables,
    //
    //                 });
    //
    //             })
    //             .catch((error) => {
    //                 logger.error(`fetchMessagesContainer.catch() ${error}`);
    //                 reject({success: false, error: 'There was an error loading records'});
    //             });
    //     });
    // }



    // fetchTableProperties(tableName, accountOwnerProperties ){
    //
    // }


    // getAccountDataContainer(numberOfRecords = 0,
    //                         tableNames = [],
    //                         tableData,
    //                         accountRecord = null ,
    //                         accountProperties = JupiterAccountService.createProperties())
    // {
    //     return {
    //         numberOfRecords: numberOfRecords,
    //         tableNames: tableNames,
    //         tableData: tableData,
    //         accountRecord: accountRecord,
    //         accountProperties: accountProperties
    //     }
    //
    // }


    async getStatement(accountProperties) {
        logger.verbose('##############################################################')
        logger.verbose('## getStatement()');
        logger.verbose('##############################################################')
        return new Promise((resolve, reject) =>{
            this.jupiterAPIService.getBalance(accountProperties.address)
                .then(response => {
                    let accountStatement = {};
                    accountStatement.balanceNQT = response.data.balanceNQT;
                    accountStatement.hasMinimumAppBalance = null;
                    accountStatement.hasMinimumTableBalance = null;

                    if(this.applicationProperties.isApp()){
                        logger.info(`Balance: ${(parseFloat(response.data.balanceNQT) / (10 ** this.applicationProperties.moneyDecimals))} JUP.`);
                        accountStatement.hasMinimumAppBalance = response.data.balanceNQT >= this.applicationProperties.minimumAppBalance;
                        accountStatement.hasMinimumTableBalance = response.data.balanceNQT >= this.applicationProperties.minimumTableBalance;
                    }

                    return resolve(accountStatement);
                })
                .catch( error => {
                    logger.error(error);
                    reject(error);
                })
        })
    }

}

module.exports.JupiterAccountService = JupiterAccountService;
