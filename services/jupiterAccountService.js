const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const logger = require('../utils/logger')(module);


class JupiterAccountService {

    constructor(jupiterAPIService, applicationProperties, tableService) {
        this.jupiterAPIService = jupiterAPIService;
        this.applicationProperties = applicationProperties;
        this.tableService = tableService;
    }


    /**
     * ie gravity.getRecords()
     * @returns {Promise<{recordsFound, pending, records, last_record}>} - {recordsFound, pending, records, last_record}
     */
    async fetchMessagesContainer() { // ie gravity.getRecords()
        logger.verbose(`fetchMessagesContainer()`);
        return new Promise((resolve, reject) => {
            const promise1 =  this.fetchConfirmedMessages();
            const promise2 = this.fetchUnconfirmedMessages();
            const allPromises = Promise.all([promise1, promise2]);
            allPromises
                .then( messagesPromiseResultGrouping => {
                    logger.verbose(`fetchMessagesContainer().AllPromises().then()`);
                    logger.verbose(`TOTAL messagesPromiseResultGrouping: ${messagesPromiseResultGrouping.length}`);
                    // console.log(messages);
                    const confirmedMessages = messagesPromiseResultGrouping[0];
                    const unconfirmedMessages = messagesPromiseResultGrouping[1];
                    const allMessages = [...confirmedMessages, ...unconfirmedMessages];

                    logger.verbose(`confirmedMessages Count: ${confirmedMessages.length}`)
                    logger.verbose(`unconfirmedMessages Count: ${unconfirmedMessages.length}`)

                    resolve({
                        recordsFound: allMessages.length,
                        pending: 99,
                        records: allMessages,
                        last_record: allMessages[0]
                    });
                })
                .catch( error => {
                    logger.error(`fetchMessagesContainer().catch()  ${error}`);
                    reject(error);
                })
        });
    }





    /**
     *
     * @param { JupiterAccountService } accountService
     * @returns {Promise<unknown>}
     */
    getAccountData(accountAddress, accountPassphrase, accountPassword) { // ie gravity.loadAppData
        logger.verbose('getUserAccountData()');

        return new Promise((resolve, reject) => {
            this.fetchMessagesContainer()  //gravity.getRecords()
                .then((messagesContainer) => {
                    logger.verbose(`getAccountData().fetchMessagesContainer().then()`);
                    // { recordsFound: 1, pending: 1, records: [], last_record: undefined }
                    logger.debug(messagesContainer);

                    const records = messagesContainer.records;
                    const recordsFound = messagesContainer.recordsFound;
                    // const pending = messagesContainer.pending;
                    // const last_record = messagesContainer.last_record;
                    logger.verbose(`TOTAL Account Records: ${records.length}`);
                    if (records.length === 0) {
                        logger.verbose(`No records found.`);
                        return resolve(this.getAccountDataContainer());
                    }

                    const accountRecord = this.tableService.extractAccountRecordFromRecords('users' ,records);

                    logger.verbose(`TOTAL Account Records: ${accountRecord.length}`);

                    // const usersTable = this.gravityTablesService.extractUsersTableFromRecords(records);
                    // logger.verbose(`TOTAL UsersTable: ${usersTable.length}`);
                    // const hasUserTable = (usersTable !== null) ? false : true;

                    const attachedTables = this.tableService.extractTableCredentialsFromRecords(records);

                    // Object.keys(myObject).length;
                    logger.verbose(`TOTAL attachedTables: ${Object.keys(attachedTables).length}`);
                    logger.debug(JSON.stringify(attachedTables));
                    let tableList = this.tableService.extractTableListFromRecords(records);
                    logger.verbose(`TOTAL tableList: ${tableList.length}`);
                    // tableList = this.gravityObjectMapper.sortByDate(tableList);

                    // const currentList = this.gravityTablesService.extractCurrentListFromTableList(tableList);
                    // logger.verbose(`TOTAL currentList: ${currentList.length}`);
                    const tableData = this.tableService.extractTableData(currentList, attachedTables);
                    logger.verbose(`TOTAL tableData: ${tableData.length}`);

                    let accountDataContainer = this.this.getAccountDataContainer()();
                    accountDataContainer.numberOfRecords = recordsFound;
                    accountDataContainer.tableNames = currentList;
                    accountDataContainer.tableData = tableData;
                    accountDataContainer.accountRecord = accountRecord;
                    accountDataContainer.accountProperties = accountProperties;

                    return resolve(accountDataContainer);
                })
                .catch((error) => {
                    logger.error(`fetchMessagesContainer.catch() ${error}`);
                    reject({success: false, error: 'There was an error loading records'});
                });
        });
    }


    getAccountDataContainer(numberOfRecords = 0,
                            tableNames = [],
                            tableData,
                            accountRecord = null ,
                            accountProperties = JupiterAccountService.createProperties())
    {
        return {
            numberOfRecords: numberOfRecords,
            tableNames: tableNames,
            tableData: tableData,
            accountRecord: accountRecord,
            accountProperties: accountProperties
        }

    }


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
