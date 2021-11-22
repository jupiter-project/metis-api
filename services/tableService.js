const {JupiterAccountProperties} = require("../gravity/jupiterAccountProperties");
const {TableAccountProperties} = require("../gravity/tableAccountProperties");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {feeManagerSingleton, FeeManager} = require("../services/FeeManager");
const logger = require('../utils/logger')(module);

// import {GravityAccountProperties} from "./gravityAccountProperties";
// const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');
// const jupiterApiService = require("./jupiterAPIService");
const {jupiterAPIService} = require("./jupiterAPIService");
const {jupiterTransactionsService} = require("./jupiterTransactionsService");
// const {jupiterAPIService} = require("./jupiterAPIService");
// const {jupiterTransactionsService} = require("./jupiterTransactionsService");

/**
 *
 */
class GravityTablesService {

    /**
     *
     * @param {GravityService} gravityService
     */
    constructor(gravityService, jupiterApiService) {
        if(!gravityService){throw new Error('missing gravityService')}
        if(!jupiterApiService){throw new Error('missing jupiterApiService')}

        this.gravityService = gravityService;
        this.applicationTransactions = gravityService.applicationTransactions;
        this.jupiterAccountService = gravityService.jupiterAccountService;
        this.applicationAccountInfo = this.gravityService.applicationGravityAccountType;
        this.jupiterApiService = jupiterApiService;
        // this.userJupiterAccount,
        // this.gravityTablesService,
        // this.userJupiterMessages,
        // this.userJupiterTransactions

    }


    /**
     *
     * @param newTableProperties
     * @param clientProperties
     * @param applicationProperties
     * @param initialFundingAmount
     * @returns {Promise<Object>}
     */
    async processTableUsingProperties(newTableProperties, clientProperties, applicationProperties, initialFundingAmount = 0){
            const appStatement = this.applicationTransactions.getAccountStatement(applicationProperties); //Include AppBalance and Table Balance
            const clientStatement = this.applicationTransactions.getAccountStatement(clientProperties);
            return Promise.all( [appStatement, clientStatement])
                .then((promiseResults) => {
                    const appStatement = promiseResults[0];
                    const clientStatement = promiseResults[1];
                    return this.processTable( newTableProperties, clientStatement, appStatement, initialFundingAmount)
            })
    }

    /**
     *
     * @param newTableProperties
     * @param clientStatement
     * @param appStatement
     * @param initialFundingAmount
     * @returns {Promise<unknown[]>}
     */
    async processTable(newTableProperties, clientStatement, appStatement, initialFundingAmount = 0){
        logger.verbose('createTable');
            const newPassphrase = gu.generatePassphrase();
            const isTableNameAvailable = this.isTableNameAvailable(tableName, clientStatement.attachedTables);
            const canAppFundTable = this.canAppFundTable(clientStatement, initialFundingAmount);
            if (!(isTableNameAvailable && canAppFundTable)) {
                throw new Error(`Problem processing table: isTableNameAvailable= ${isTableNameAvailable}, canAppFundTable=${canAppFundTable}`)
            }
            const newAccountAddress = await this.jupiterAccountService.getAccountId(newPassphrase);
            newTableProperties.address = newAccountAddress;
            const encryptedTableRecord = this.constructAndEncryptTableRecord(newAccountAddress, clientProperties, clientProperties.crypto)
            const encryptedTableListRecord = this.constructAndEncryptTableListRecord(newAccountAddress, clientProperties.crypto);
            let allPromise = []
            allPromise.push(this.jupiterApiService.sendMetisMessageToSelf(clientStatement.clientProperties, encryptedTableListRecord))
            allPromise.push(this.jupiterApiService.sendMetisMessageToSelf(clientStatement.clientProperties,encryptedTableRecord, newTableProperties.name))
            if(!(initialFundingAmount > 0)) {
                return Promise.all(allPromise); // [{transactionType: 'tableRecord', transactionId: 123}, {transactionType: 'tableList', transactionId: 123}]
            }

            return Promise.all(allPromise)
                .then(jupiterApiResponses => {
                    this.jupiterApiService.sendMoney( clientStatement.clientProperties  ,newTableProperties,initialFundingAmount)
                        .then( sendMoneyResponse => { // [{transactionType: 'sendMoney', transactionId: 123}]
                            return {...jupiterApiResponses, sendMoneyResponse}; // return all transactions
                        })
                })
    }

    // /**
    //  * AttachTable = Create Account, Send record transaction, and Fund Account
    //  * @param database
    //  * @param nameOfTableToAttach
    //  * @param currentTables
    //  * @returns {Promise<unknown>}
    //  */
    // async attachTable(database, nameOfTableToAttach, currentTables=[]) {
    //     logger.verbose('attachTable');
    //     return new Promise((resolve, reject) => {
    //         this.applicationTransactions.getAccountStatement()
    //             .then(accountStatement => {
    //                 if(!(accountStatement.hasMinimumAppBalance && accountStatement.hasMinimumTableBalance)){
    //                     return reject(accountStatement);
    //                 }
    //
    //                 this.gravityService.getUserAccountData() // gravity.loadAppData
    //                     .then((userAccountData) => {
    //
    //                         if(!gu.jsonPropertyIsNonEmptyArray('tables', userAccountData)){
    //                             return reject('Table name cannot be undefined');
    //                         }
    //
    //                         let userAccountTableNames = userAccountData.tables; //tableList
    //                         let isTableInCurrentTableList = currentTables.includes(nameOfTableToAttach);
    //
    //                         if(currentTables.includes(nameOfTableToAttach) && userAccountTableNames.includes(nameOfTableToAttach)){
    //                             return reject(`Error: Unable to save table. ${nameOfTableToAttach} is already in the database`);
    //                         }
    //
    //                         const passphrase = gu.generatePassphrase();
    //                         logger.debug(`passphrase: ${passphrase}`);
    //
    //                         this.setUpNewGravityAccount(
    //                             database.address,
    //                             database.publicKey,
    //                             nameOfTableToAttach,
    //                             userAccountTableNames,
    //                             passphrase,
    //                             database.encryptionPassword,
    //                             this.applicationAccountInfo.algorithm)
    //                             .then(response => {
    //                                 return resolve(response);
    //                             })
    //                     })
    //                     .catch( error =>{
    //                         logger.error(error);
    //                         reject(error);
    //                     })
    //             })
    //             .catch(error => {
    //                 reject(error);
    //             })
    //     });
    // }











    /**
     *
     * @param mainTable
     * @param subTable
     * @returns {boolean}
     */
    tableIsSubsetOf(mainTable, subTable) {

        if(!this.isObject(mainTable) || !gu.isObject(subTable)) {
            throw new Error('function params need to be valid');
        }

        const mainTableString = mainTable.sort().join(',');
        const subTableString = subTable.sort().join(',');

        if (mainTableString.includes(subTableString)) {
            return true;
        }
        return false;
    }


    /**
     *
     * @param tables
     * @param tableName
     * @returns {boolean}
     */
    hasTable(tables, tableName) {
        let hasKey = false;
        for (let x = 0; x < tables.length; x += 1) {
            const tableKeys = Object.keys(tables[x]);
            if (tableKeys.includes(tableName)) {
                hasKey = true;
                break;
            }
        }

        return hasKey;
    }


    /**
     *
     * @param tableBreakdown
     * @returns {Promise<unknown>}
     */
    // async createUserTable(tableBreakdown) {
    //     return new Promise( (resolve, reject) => {
    //         logger.verbose('createUserTable()');
    //         this.attachUsersTable( tableBreakdown)
    //             .then(res => {
    //                 if (res.error) {
    //                     logger.error(res.error);
    //                     if (res.fullError === 'Error: Unable to save tableName. users is already in the database') {
    //                         return resolve({resolutionType: 'exists', message: 'already created'});
    //                     }
    //                     return resolve({resolutionType: 'error', message: res.error})
    //                 }
    //
    //                 return resolve({resolutionType: 'success'})
    //             })
    //             .catch(error => {
    //                 return reject(error);
    //             })
    //     })
    // }


    // async attachUsersTable(currentTables) {
    //     return new Promise((resolve, reject) => {
    //         const algorithm = this.gravityService.userJupiterAccount.algorithm;
    //         const password = this.gravityService.userJupiterAccount.password;
    //
    //       this.attachTable(algorithm,password, 'users', currentTables)
    //           .then(response => {
    //               return resolve(response);
    //           })
    //           .catch(error => {
    //               reject(error);
    //           })
    //     })
    // }


    /**
     *
     * @param databaseGravityAccountType
     * @param encryptedTableListRecord
     * @returns {Promise<unknown>}
     */
    async postTableListRecord(databaseGravityAccountType,encryptedTableListRecord ){
        return new Promise( (resolve, reject) => {
            const feeNQT = this.jupiterAccountService.feeNQT / 2;
            this.jupiterAccountService.postSimpleMessage(databaseGravityAccountType, encryptedTableListRecord, true, feeNQT)
                .then(res => {
                    if (res.data.broadcasted && res.data.broadcasted == true) {
                        this.jupiterAccountService.provideInitialStandardFunds()
                            .then(response => {
                                logger.error(`Needs Logic!!!`);
                                return reject(`Needs Logic!`);
                            })
                    }
                    return reject(res);
                })
        })
    }


    /**
     *
     * @param databaseGravityAccountType
     * @param encryptedUserRecord
     * @param nameOfTableToAttach
     * @returns {Promise<unknown>}
     */
    async postUserRecord(databaseGravityAccountType, encryptedUserRecord, nameOfTableToAttach){
        return new Promise((resolve, reject) => {
            this.jupiterAccountService.postSimpleMessage(databaseGravityAccountType, encryptedUserRecord)
                .then(response => {
                    if (response.data.broadcasted && response.data.broadcasted) {
                        logger.info(`Table ${nameOfTableToAttach} pushed to the blockchain and linked to your account.`);
                        return resolve(response);
                    }
                    return reject(response);
                })
        })
    }

    /**
     *
     * @param address
     * @param publicKey
     * @param nameOfTableToAttach
     * @param userAccountTableNames
     * @param passphrase
     * @param encryptionPassword
     * @param algorithm
     * @returns {Promise<unknown>}
     */
    // async setUpNewGravityAccount(address, publicKey, nameOfTableToAttach, userAccountTableNames, passphrase, encryptionPassword, algorithm ) {
    //     return new Promise((resolve, reject) => {
    //         this.jupiterAccountService.getAccountId(passphrase) // creates new jup accountId
    //             .then( response => {
    //                 const hash = encryptionPassword; // This seems wrong!
    //                 const databaseGravityAccountType = new GravityAccountProperties(address, '', publicKey, passphrase, hash, encryptionPassword, algorithm);
    //                 const databaseCrypto = new GravityCrypto(databaseGravityAccountType.algorithm, databaseGravityAccountType.password);
    //
    //                 const encryptedUserRecord = this.constructAndEncryptUserRecord(nameOfTableToAttach, accountRS, publicKey, passphrase, databaseCrypto)
    //                 const encryptedTableListRecord = this.constructAndEncryptTableListRecord(nameOfTableToAttach, userAccountTableNames, databaseCrypto);
    //
    //                 let allPromise = []
    //                 allPromise.push(this.postTableListRecord(databaseGravityAccountType, encryptedTableListRecord))
    //                 allPromise.push(this.postUserRecord(databaseGravityAccountType,encryptedUserRecord,nameOfTableToAttach))
    //
    //                 /**
    //                  * Promise.all() method takes an iterable of promises as an input, and returns a single Promise that
    //                  * resolves to an array of the results of the input promises. This returned promise will resolve
    //                  * when all of the input's promises have resolved, or if the input iterable contains no promises.
    //                  * It rejects immediately upon any of the input promises rejecting or non-promises throwing an error,
    //                  * and will reject with this first rejection message / error.
    //                  */
    //                 Promise.all(allPromise)
    //                     .then( response => {
    //                         resolve(response);
    //                     })
    //                     .catch(error =>{
    //                         logger.error(error);
    //                         reject(error)
    //                     })
    //             })
    //             .catch((error) => {
    //                 logger.error(error);
    //                 reject(error);
    //             })
    //     })
    // }


    /**
     *
     * @param nameOfTableToAttach
     * @param userAccountTableNames
     * @param databaseCrypto
     */
    constructAndEncryptTableListRecord(nameOfTableToAttach, userAccountTableNames, databaseCrypto){

        userAccountTableNames.push(nameOfTableToAttach);

        if (nameOfTableToAttach === 'channels' && userAccountTableNames.length < 2) {
            userAccountTableNames = ['users', 'channels'];
        }

        if (nameOfTableToAttach === 'invites' && userAccountTableNames.length < 3) {
            userAccountTableNames = ['users', 'channels', 'invites'];
        }

        // tableList === userAccountTableNames
        // tableListRecord === tableListRecord
        // encryptedTableData ===  encryptedTableListRecord
        // encryptedData === encryptedUserRecord

        //ie {tables: ['users', 'channels', 'invites'], date: 123123}
        const tableListRecord = {
            tables: userAccountTableNames,
            date: Date.now(),
        };

        const encryptedTableListRecord = databaseCrypto.encryptJson(tableListRecord);

        return encryptedTableListRecord;
    }

    /**
     *
     * @param nameOfTableToAttach
     * @param accountRS
     * @param publicKey
     * @param passphrase
     * @param databaseCrypto
     */
    constructAndEncryptUserRecord( nameOfTableToAttach, accountRS, publicKey, passphrase, databaseCrypto) {
        // ie {channels: {address, passphrase,public_key}
        const userRecord = {
            [nameOfTableToAttach]: {
                address: accountRS,
                passphrase: passphrase,
                public_key: publicKey
            }
        }
        const encryptedUserRecord = databaseCrypto.encryptJson(userRecord);

        return encryptedUserRecord;
    }


    /**
     *
     * @param currentTables
     * @param database
     * @returns {Promise<unknown>}
     */
    // async attachUsersTable(currentTables, database) {
    //     return new Promise((resolve, reject) => {
    //         this.attachTable( database, 'users', currentTables)
    //             .then(response => {
    //                 return resolve(response);
    //             })
    //             .catch(error => {
    //                 reject(error);
    //             })
    //     })
    // }

    /**
     *
     * @param database
     * @param nameOfTableToAttach
     * @param currentTables
     * @returns {Promise<unknown>}
     */
    async attachTable(database, nameOfTableToAttach, currentTables=[]) {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## attachTable(database, nameOfTableToAttach, currentTables=[])`);
        logger.verbose(`## `);
        logger.sensitive(`nameOfTableToAttach=${JSON.stringify(nameOfTableToAttach)}`);
        logger.sensitive(`currentTables=${JSON.stringify(currentTables)}`);
        return new Promise((resolve, reject) => {
            this.applicationTransactions.getAccountStatement()
                .then(accountStatement => {
                    logger.verbose(`-----------------------------------------------------------------------------------`);
                    logger.verbose(`-- attachTable().getAccountStatement().then()`);
                    logger.verbose(`-- `);
                    logger.sensitive(`accountStatement=${JSON.stringify(accountStatement)}`);

                    if(!(accountStatement.hasMinimumAppBalance && accountStatement.hasMinimumTableBalance)){
                        return reject(accountStatement);
                    }

                    this.gravityService.getUserAccountData() // gravity.loadAppData
                        .then((userAccountData) => {
                            logger.verbose(`-----------------------------------------------------------------------------------`);
                            logger.verbose(`-- attachTable().getAccountStatement().then().getUserAccountData().then()`);
                            logger.verbose(`-- `);
                            logger.sensitive(`userAccountData=${JSON.stringify(userAccountData)}`);


                            if(!gu.jsonPropertyIsNonEmptyArray('tables', userAccountData)){
                                return reject('Table name cannot be undefined');
                            }

                            let userAccountTableNames = userAccountData.tables; //tableList
                            let isTableInCurrentTableList = currentTables.includes(nameOfTableToAttach);

                            if(currentTables.includes(nameOfTableToAttach) && userAccountTableNames.includes(nameOfTableToAttach)){
                                return reject(`Error: Unable to save table. ${nameOfTableToAttach} is already in the database`);
                            }

                            const passphrase = gu.generatePassphrase();
                            logger.debug(`passphrase: ${passphrase}`);

                            this.setUpNewGravityAccount(
                                database.address,
                                database.publicKey,
                                nameOfTableToAttach,
                                userAccountTableNames,
                                passphrase,
                                database.encryptionPassword,
                                this.applicationAccountInfo.algorithm)
                                .then(response => {
                                    return resolve(response);
                                })
                        })
                        .catch( error =>{
                            logger.error(error);
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
     * @param database
     * @returns {*[]}
     */
    tableBreakdown(database) {
        const tableList = [];
        for (let x = 0; x < database.length; x += 1) {
            const tableKeys = Object.keys(database[x]);
            if (tableKeys.length > 0) {
                tableList.push(tableKeys[0]);
            }
        }
        return tableList;
    }

    /**
     *
     * @param appTables
     * @returns {null}
     */
    extractUsersTableFromAppTables(appTables){
        logger.verbose(`extractUsersTableFromAppTables()`);
        logger.debug(appTables);

        Object.keys(appTables).forEach((table) => {
            if (appTables[table].users) {
                return  appTables[table].users;
            }
        });

        return null;
    }


    /**
     *
     * @param records
     * @returns {null|*}
     */
    extractUsersTableFromRecords(records){
        if(records.length === 0){
            return null;
        }
        const usersTable = records.filter( record => record.users);
        return usersTable;
    }

    /**
     *
     * @param records
     * @returns {null|*}
     */
    extractAccountRecordFromRecords(records){
        logger.verbose(`extractAccountRecordFromRecords()`);
        if(records.length === 0){
            return null;
        }

        const accountRecords = records.filter( record => record.user_record);
        if(accountRecords.length > 0){
            return accountRecords[0].user_record;
        }

        return null;
    }


    /**
     *
     * @param records
     * @returns {{}}
     */
    extractTablesRetrievedFromRecords(records){
        if(records.length === 0){
            return {};
        }
        const tablesRetrieved = {};

        // console.log(records);

        for (let x = 0; x < Object.keys(records).length; x += 1) {
            // logger.debug(records[x]);
            // logger.debug(Object.keys(records[x]))
            // logger.debug(Object.keys(records[x])[0]);
            const objectKey = Object.keys(records[x])[0];
            if (tablesRetrieved[objectKey] === undefined) {
                tablesRetrieved[objectKey] = [];
                tablesRetrieved[objectKey].push(records[x]);
            } else {
                tablesRetrieved[objectKey].push(records[x]);
            }
        }

        // console.log(tablesRetrieved.length)
        return tablesRetrieved;
    }

    extractTableListFromRecords(records){
        if(records.length === 0 ) {
            return []
        }
        return records.filter( record =>  record.tables && record.date );
    }


    /**
     *
     * @param tableList
     * @returns {*[]}
     */
    extractCurrentListFromTableList(tableList){
        logger.verbose(`extractCurrentListFromTableList()`)
        if(tableList.length === 0 ) {
            return [];
        }
        let currentList = [];

        for (let y = 0; y < Object.keys(tableList).length; y += 1) {
            if (tableList[y].tables.length > currentList.length) {
                if (currentList.length === 0) {
                    currentList = tableList[y].tables;
                } else if (this.tableIsSubsetOf(currentList, tableList[y].tables)) {
                    currentList = tableList[y].tables;
                }
            }
        }
        return currentList;
    }


    /**
     *
     * @param currentListArray
     * @param tablesRetrievedJson
     * @returns {*[]}
     */
    extractTableData(currentListArray, tablesRetrievedJson) {

        if(currentListArray.length === 0 && Object.keys(tablesRetrievedJson).length  === 0) {
            return [];
        }
        const tableData = [];

        for (let i = 0; i < Object.keys(currentListArray).length; i += 1) {
            const thisKey = currentListArray[i];
            if (tablesRetrievedJson[thisKey]) {
                // We need to sort the the list we are about to call
                this.sortBySubkey(tablesRetrievedJson[thisKey], thisKey, 'date');

                // Once we do this, we can obtain the last record and push to the tableData variable
                // NOTE: We'll expand validation of tables in future releases
                tableData.push(tablesRetrievedJson[thisKey][0]);
            }
        }
        return tableData;
    }


    /**
     *
     * @param array
     * @param key
     * @param subkey
     * @returns {*}
     */
    sortBySubkey(array, key, subkey) {
        return array.sort((a, b) => {
            const x = a[key][subkey];
            const y = b[key][subkey];
            const result = (x !== undefined && x > y) ? -1 : ((x === undefined || x < y) ? 1 : 0);

            return (result);
        });
    }

}

module.exports.GravityTablesService = GravityTablesService;























class TableService {

    /**
     *
     * @param jupiterTransactionsService
     * @param jupiterAPIService
     */
    constructor( jupiterTransactionsService, jupiterApiService ) {
        this.jupiterTransactionsService = jupiterTransactionsService;
        this.jupiterApiService = jupiterApiService;
    }

    // constructor( jupiterTransactionsService, jupiterAPIService ) {
    //     this.jupiterTransactionsService = jupiterTransactionsService;
    //     this.jupiterAPIService = jupiterAPIService;
    // }

    /**
     *
     * @param currentListArray
     * @param tablesRetrievedJson
     * @returns {*[]}
     */
    extractTableData(currentListArray, tablesRetrievedJson) {

        if(currentListArray.length === 0 && Object.keys(tablesRetrievedJson).length  === 0) {
            return [];
        }
        const tableData = [];

        for (let i = 0; i < Object.keys(currentListArray).length; i += 1) {
            const thisKey = currentListArray[i];
            if (tablesRetrievedJson[thisKey]) {
                // We need to sort the the list we are about to call
                this.sortBySubkey(tablesRetrievedJson[thisKey], thisKey, 'date');

                // Once we do this, we can obtain the last record and push to the tableData variable
                // NOTE: We'll expand validation of tables in future releases
                tableData.push(tablesRetrievedJson[thisKey][0]);
            }
        }
        return tableData;
    }


    /**
     *
     * @param {GravityAccountProperties}accountProperties
     * @param {[]} arrayOfTableNames
     * @returns {Promise<{data, transactionReport: [{name, id}]}>}
     */
    async createTableListRecord(accountProperties, arrayOfTableNames) {
        logger.verbose('###################################################################################')
        logger.verbose(`## tableService.createTableListRecord(accountProperties= ${accountProperties.address}, arrayOfTableNames=${arrayOfTableNames})`)
        logger.verbose('## ');

        const tablesList = {
            tables: arrayOfTableNames,
            date: Date.now()
        }
        const encrypted = accountProperties.crypto.encryptJson(tablesList);
        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record);
        const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}
        return new Promise((resolve, reject) => {
            this.jupiterApiService.sendSimpleEncipheredMetisMessage(
                accountProperties,
                accountProperties,
                encrypted,
                fee,
                subtype,
                false)
                .then(response => {
                    resolve({responseData: response.data, transactionReport: {name: 'create-table-list-record', id: response.data.transaction}})
                })
        })
    }


    extractLatestTableNamesFromMessages(messages){
        if(messages.length === 0 ) {return []}
        const reducedMessages =  messages.reduce( (reduced, message) => {
            if(message.tables){
                reduced.push(message)
                return reduced;
            }
            return reduced;
        }, [])

        reducedMessages.sort(function(a, b){return b.date -a.date}); // decending by date
        logger.debug(`reducedMessage= ${JSON.stringify(reducedMessages)}`);

        if(reducedMessages.length < 1){return []}

        return reducedMessages[0].tables;
    }

    // messages= [{"id":"2376166064047524148","user_record":"{\"id\":\"2376166064047524148\",\"account\":\"JUP-KMRG-9PMP-87UD-3EXSF\",\"accounthash\":\"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW\",\"alias\":\"sprtz\",\"secret_key\":null,\"twofa_enabled\":false,\"twofa_completed\":false,\"api_key\":\"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO\",\"encryption_password\":\"sprtz\"}","date":1625269463920},{"tables":["users","channels","invites","users"],"date":1625269444963},[{"users":{"address":"JUP-7WMJ-S9N6-3LQV-A3VCK","passphrase":"scratch neck before bullet glass hallway like sway very crush itself leg"}}],{"tables":["users","channels","invites"],"date":1625269431846},{"invites":{"address":"JUP-3GKU-CKKB-N5F5-FSTYJ","passphrase":"single commit gun screw beauty slice teeth six dad friendship paint autumn"}},{"tables":["users","channels"],"date":1625269431464},{"channels":{"address":"JUP-X5E2-MWPE-3FLC-GU3KU","passphrase":"look crimson some toward grand ask block holy tightly hello anyone lovely"}}]


    /**
     * {"users":{"address":"JUP-7WMJ-S9N6-3LQV-A3VCK","passphrase":"scratch neck before bullet glass hallway like sway very crush itself leg"}}
     * @param tableName
     * @param messages
     * @returns {null|*}
     */
    extractLatestTableFromMessages(tableName, messages){
        logger.verbose(`##### extractLatestTableFromMessages(tableName= ${tableName}, messages= ${!!messages})  #####`);
        if(messages.length === 0 ) {
            return null
        }

        if(!tableName){
            return null
        }

        const reducedMessages =  messages.reduce( (reduced, message) => {
            if(message[tableName]){
                reduced.push(message[tableName])
                return reduced;
            }
            return reduced;
        }, [])


        if(reducedMessages.length < 1){
            return null
        }
        // reducedMessages.sort(function(a, b){return b.date -a.date}); // decending by date
        // logger.debug(`reducedMessage= ${JSON.stringify(reducedMessages)}`);

        //@TODO there is no date property to get the latest table. Fix this!
        return reducedMessages[0];
    }


    extractTableListFromRecords(records){
        if(records.length === 0 ) {
            return []
        }
        return records.filter( record =>  record.tables && record.date );
    }


    /**
     *
     * @param tableName
     * @param tables
     * @returns {null|*}
     */
    extractTableFromTablesOrNull(tableName , tables){
        logger.verbose('######################################');
        logger.verbose(`extractTableFromTablesOrNull(tableName= ${tableName}, tables)`);
        logger.verbose('######################################');

        if(!tableName){
            return null;
        }
        if(!tables){
            return null;
        }

        if(tables.length < 1){
            return null;
        }

        const filtered = tables.filter(tableProperties => tableProperties.name == tableName);

        if(!filtered && filtered.length < 1){
            return null
        }
        logger.debug(`found table: ${filtered[0].name}`);
        return filtered[0];
    }


    /**
     *
     * @param records
     * @returns {null|*}
     */
    extractTablePropertiesFromMessages(tableName , records){
        logger.verbose('##############################################################')
        logger.verbose(`## extractAccountRecordFromRecords(tableName = ${tableName}, records= ${!!records})`);
        logger.verbose('##############################################################')
        if(records.length === 0){
            return null;
        }
        const recordName = `${tableName}_record`;
        const accountRecords = records.filter( record => record[recordName]);
        if(accountRecords.length > 0){
            return accountRecords[0][recordName];
        }

        return null;
    }


    // const tablesRetrieved = messages.reduce( (reduced, message) =>{
    //
    //     console.log('1-----------------------------------------')
    //     logger.debug(`message= ${message}`);
    //     // const jsonMessage = JSON.parse(message);
    //
    //     // logger.debug(`message= ${JSON.stringify(jsonMessage)}`)
    //
    //     // console.log('_________________')
    //     // if(!jsonMessage){
    //     //     return reduced;
    //     // }
    //
    //     // messages= [{"id":"2376166064047524148","user_record":"{\"id\":\"2376166064047524148\",\"account\":\"JUP-KMRG-9PMP-87UD-3EXSF\",\"accounthash\":\"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW\",\"alias\":\"sprtz\",\"secret_key\":null,\"twofa_enabled\":false,\"twofa_completed\":false,\"api_key\":\"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO\",\"encryption_password\":\"sprtz\"}","date":1625269463920},{"tables":["users","channels","invites","users"],"date":1625269444963},{"users":{"address":"JUP-7WMJ-S9N6-3LQV-A3VCK","passphrase":"scratch neck before bullet glass hallway like sway very crush itself leg"}},{"tables":["users","channels","invites"],"date":1625269431846},{"invites":{"address":"JUP-3GKU-CKKB-N5F5-FSTYJ","passphrase":"single commit gun screw beauty slice teeth six dad friendship paint autumn"}},{"tables":["users","channels"],"date":1625269431464},{"channels":{"address":"JUP-X5E2-MWPE-3FLC-GU3KU","passphrase":"look crimson some toward grand ask block holy tightly hello anyone lovely"}}]
    //
    //
    //     const extractLatestTablesListFromMessages(messages)
    //
    //     const keys = (Object.keys(message))
    //     for(let i = 0; i<keys.length;i++){
    //         console.log('**');
    //         console.log('key:', keys[i]);
    //         const re = /\w+_record/;
    //         if(re.test(keys[i])){
    //             console.log('FOUND the key: ', keys[i]);
    //             const table = JSON.parse(message[keys[i]])
    //             logger.debug(`table= ${JSON.stringify(table)}`);
    //
    //             // console.log(keys[i], 'tableName')
    //             table.tableName = keys[i];
    //             table.date = message.date
    //             return reduced.push(table);
    //         }
    //     }
    //     return reduced;
    // }, [] )


    // console.log(tablesRetrieved.length)

    //     return tablesRetrieved;
    // }


    /**
     *  { id: '8381644747484745663',user_record:{"id":"123","account":"JUP-","accounthash":"123","email":"","firstname":"next"," +
     *      ""alias":"next","lastname":"","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"123",
     *      "encryption_password":"next"}, date: 1629813396685 },
     * @param {[]}messages
     */
    extractRecordsFromMessages(messages){
        logger.verbose('#####################################################################################');
        logger.verbose('## extractRecordsFromMessages(messages)');
        logger.verbose('##');
        // logger.debug(`  messages= ${JSON.stringify(messages)}`);
        // logger.sensitive(`extractedRecordsFromMessages= ${JSON.stringify(records)}`);
        return messages.reduce((reduced, message) => {
            const keys = (Object.keys(message));
            for (let i = 0; i < keys.length; i++) {
                const re = /\w+_record/;
                if (re.test(keys[i])) {
                    // console.log('FOUND the key: ', keys[i]);
                    let record = message[keys[i]];
                    try {
                        record = JSON.parse(message[keys[i]]);
                    } catch (error) {
                        // do nothing
                    }
                    logger.insane(`record= ${JSON.stringify(record)}`);
                    record.name = keys[i];
                    record.date = message.date
                    reduced.push(record);
                    return reduced;
                }
            }

            return reduced;
        }, []);
    }


    /**
     * *  { id: '8381644747484745663',user_record:{"id":"123","account":"JUP-","accounthash":"123","email":"","firstname":"next"," +
     *      ""alias":"next","lastname":"","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"123",
     *      "encryption_password":"next"}, date: 1629813396685 },
     * @param {string} address
     * @param {{id,user_record:{id,account,accounthash,email,firstname,alias,lastname,secret_key,twofa_enabled,twofa_completed,api_key,encryption_password}, date }} records
     * @returns {null | GravityAccountProperties}
     */
    extractUserPropertiesFromRecordsOrNull(address, records){
        const record = records.filter(record => record.account == address);

        if(!record){
            return null;
        }

        if(record.length < 1){
            return null;
        }

        const properties = new GravityAccountProperties(
            record.account,
            record.id,
            record.api_key,
            record.secret_key,
            record.accounthash,
            record.encryption_password,
            null, //algorithm
            record.email,
            record.firstname,
            record.lastname
        )

        // properties.addAlias(record.alias);

        return properties;
    }

    /**
     *
     * @param messages
     * @returns {*[]}
     */
    extractTablesFromMessages(messages) {
        logger.verbose('###############################################################');
        logger.verbose(`## extractTablesFromMessages(messages.length= ${messages.length})`);
        logger.verbose('##');

        if (messages.length === 0) {return []};
        logger.debug(`messages.length= ${messages.length}`);
        const tableNames = this.extractLatestTableNamesFromMessages(messages);

        const unique = (value, index, self) => {
            return self.indexOf(value) === index
        }

        const uniqueTableNames = tableNames.filter(unique)
        const tables = []
        for (let i = 0; i < uniqueTableNames.length; i++) {
            const latestTable = this.extractLatestTableFromMessages(uniqueTableNames[i], messages); // { address: 'JUP----',passphrase:'single commit gun screw' }
            if (latestTable) {
                tables.push( new TableAccountProperties(uniqueTableNames[i], latestTable.address, latestTable.passphrase, latestTable.password));
            }
        }
        // logger.sensitive(`tables= ${JSON.stringify(tables)}`);

        return tables;
    }



}

module.exports.TableService = TableService;
module.exports.tableService = new TableService( jupiterTransactionsService, jupiterAPIService  );


/**
 *
 * @param tableOwnerProperties
 * @param nameOfTableToAttach
 * @param currentTables
 * @returns {Promise<unknown>}
 */
// async attachTable(tableOwnerProperties, nameOfTableToAttach) {
//     logger.verbose('##############################################################')
//     logger.verbose('attachTable()');
//     logger.verbose('##############################################################')
//     return new Promise((resolve, reject) => {
//         this.gravityService.getUserAccountData() // gravity.loadAppData
//             .then((userAccountData) => {
//
//                 if(!gu.jsonPropertyIsNonEmptyArray('tables', userAccountData)){
//                     return reject('Table name cannot be undefined');
//                 }
//
//                 let userAccountTableNames = userAccountData.tables; //tableList
//                 let isTableInCurrentTableList = currentTables.includes(nameOfTableToAttach);
//
//                 if(currentTables.includes(nameOfTableToAttach) && userAccountTableNames.includes(nameOfTableToAttach)){
//                     return reject(`Error: Unable to save table. ${nameOfTableToAttach} is already in the database`);
//                 }
//
//                 const passphrase = gu.generatePassphrase();
//                 logger.debug(`passphrase: ${passphrase}`);
//
//                 this.setUpNewGravityAccount(
//                     tableOwnerProperties.address,
//                     tableOwnerProperties.publicKey,
//                     nameOfTableToAttach,
//                     userAccountTableNames,
//                     passphrase,
//                     tableOwnerProperties.encryptionPassword,
//                     this.applicationAccountInfo.algorithm)
//                     .then(response => {
//                         return resolve(response);
//                     })
//             })
//             .catch( error =>{
//                 logger.error(error);
//                 reject(error);
//             })
//     });
// }

// /**
//  *
//  * @param accountProperties
//  * @returns {Promise<unknown>}
//  */
// fetchAttachedTables(accountProperties) { // ie gravity.loadAppData
//     logger.verbose('#####################################################################################');
//     logger.verbose('## fetchAttachedTables()');
//     logger.verbose('#####################################################################################');
//     logger.sensitive(`accountProperties= ${JSON.stringify(accountProperties)}`);
//
//
//     return new Promise((resolve, reject) => {
//         this.jupiterTransactionsService.fetchMessages(accountProperties)  //gravity.getRecords()
//             .then((transactionMessages) => {
//                 logger.verbose('---------------------------------------------------------------------------------------');
//                 logger.verbose(`fetchAttachedTables().fetchMessages().then(transactionMessages)`);
//                 logger.verbose('---------------------------------------------------------------------------------------');
//                 logger.sensitive(`transactionMessages= ${JSON.stringify(transactionMessages)}`);
//
//                 // const tableProperties = this.tableService.extractTablePropertiesFromMessages('users' ,transactionMessages);
//                 // logger.verbose(`TOTAL tableProperties: ${tableProperties.length}`);
//
//                 const attachedTables = this.extractTablesFromMessages(transactionMessages);
//                 logger.sensitive(`attachedTables= ${JSON.stringify(attachedTables)}`);
//
//                 // let tableList = this.tableService.extractTableListFromRecords(records);
//                 // logger.verbose(`TOTAL tableList: ${tableList.length}`);
//                 // tableList = this.gravityObjectMapper.sortByDate(tableList);
//
//                 // const currentList = this.gravityTablesService.extractCurrentListFromTableList(tableList);
//                 // logger.verbose(`TOTAL currentList: ${currentList.length}`);
//                 // const tableData = this.tableService.extractTableData(currentList, attachedTables);
//                 // logger.verbose(`TOTAL tableData: ${tableData.length}`);
//
//                 // let accountDataContainer = this.this.getAccountDataContainer()();
//                 // accountDataContainer.numberOfRecords = recordsFound;
//                 // accountDataContainer.tableNames = currentList;
//                 // accountDataContainer.tableData = tableData;
//                 // accountDataContainer.accountRecord = tableProperties;
//                 // accountDataContainer.accountProperties = accountProperties;
//
//                 return resolve(attachedTables);
//             })
//             .catch((error) => {
//                 logger.error(`fetchMessagesContainer.catch() ${error}`);
//                 reject({success: false, error: 'There was an error loading records'});
//             });
//     });
// }

// const applicationUsersTableProperties = this.extractTablePropertiesFromTables('user', applicationAccountData.attachedTables);

// extractTablePropertiesFromTablesOrNull( tableName, tables) {
//     const table = tables.filter( table => table.tableName == tableName );
//
//     if(table.length > 0){
//         return new TableAccountProperties(table[0].address,table[0].passphrase,'',table[0].password)
//     }
//
//     return null;
// }
