const logger = require('../utils/logger')(module);


class TableService {

    /**
     *
     * @param {JupiterAccountService} jupiterAccountService
     */
    constructor( jupiterAccountService) {
        this.jupiterAccountService = jupiterAccountService

    }


    extractTableCredentialsFromRecords(records){
        if(records.length === 0){
            return {};
        }
        const tablesRetrieved = {};

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
     * @param records
     * @returns {null|*}
     */
    extractAccountRecordFromRecords(tableName , records){
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


    /**
     *
     * @param tableOwnerProperties
     * @param nameOfTableToAttach
     * @param currentTables
     * @returns {Promise<unknown>}
     */
    async attachTable(tableOwnerProperties, nameOfTableToAttach) {
        logger.verbose('##############################################################')
        logger.verbose('attachTable()');
        logger.verbose('##############################################################')
        return new Promise((resolve, reject) => {
            this.gravityService.getUserAccountData() // gravity.loadAppData
                .then((userAccountData) => {

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
                        tableOwnerProperties.address,
                        tableOwnerProperties.publicKey,
                        nameOfTableToAttach,
                        userAccountTableNames,
                        passphrase,
                        tableOwnerProperties.encryptionPassword,
                        this.applicationAccountInfo.algorithm)
                        .then(response => {
                            return resolve(response);
                        })
                })
                .catch( error =>{
                    logger.error(error);
                    reject(error);
                })
        });
    }

}

module.exports.TableService = TableService;
