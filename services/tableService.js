const {JupiterAccountProperties} = require("../gravity/jupiterAccountProperties");
const {TableAccountProperties} = require("../gravity/tableAccountProperties");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const logger = require('../utils/logger')(module);


class TableService {

    constructor( jupiterTransactionsService ) {
        this.jupiterTransactionsService = jupiterTransactionsService;
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



//
// ] --
//     metis_1  | [0] { id: '2376166064047524148',
//     metis_1  | [0]   user_record:
//         metis_1  | [0]    '{"id":"2376166064047524148","account":"JUP-KMRG-9PMP-87UD-3EXSF","accounthash":"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW","alias":"sprtz","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO","encryption_password":"sprtz"}',
//     metis_1  | [0]   date: 1625269463920 }
// metis_1  | [0] --
// metis_1  | [0] { id: '2376166064047524148',
// metis_1  | [0]   user_record:
//     metis_1  | [0]    '{"id":"2376166064047524148","account":"JUP-KMRG-9PMP-87UD-3EXSF","accounthash":"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW","alias":"sprtz","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO","encryption_password":"sprtz"}',
// metis_1  | [0]   date: 1625269463920 }
// metis_1  | [0] --
// metis_1  | [0] { id: '2376166064047524148',
// metis_1  | [0]   user_record:
//     metis_1  | [0]    '{"id":"2376166064047524148","account":"JUP-KMRG-9PMP-87UD-3EXSF","accounthash":"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW","alias":"sprtz","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO","encryption_password":"sprtz"}',
// metis_1  | [0]   date: 1625269463920 }
// metis_1  | [0] --
// metis_1  | [0] { id: '2376166064047524148',
// metis_1  | [0]   user_record:
//     metis_1  | [0]    '{"id":"2376166064047524148","account":"JUP-KMRG-9PMP-87UD-3EXSF","accounthash":"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW","alias":"sprtz","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO","encryption_password":"sprtz"}',
// metis_1  | [0]   date: 1625269463920 }
// metis_1  | [0] --
// metis_1  | [0] { id: '2376166064047524148',
// metis_1  | [0]   user_record:
//     metis_1  | [0]    '{"id":"2376166064047524148","account":"JUP-KMRG-9PMP-87UD-3EXSF","accounthash":"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW","alias":"sprtz","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO","encryption_password":"sprtz"}',
// metis_1  | [0]   date: 1625269463920 }
// metis_1  | [0] --
// metis_1  | [0] { id: '2376166064047524148',
// metis_1  | [0]   user_record:
//     metis_1  | [0]    '{"id":"2376166064047524148","account":"JUP-KMRG-9PMP-87UD-3EXSF","accounthash":"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW","alias":"sprtz","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO","encryption_password":"sprtz"}',
// metis_1  | [0]   date: 1625269463920 }
// metis_1  | [0] --
// metis_1  | [0] { id: '2376166064047524148',
// metis_1  | [0]   user_record:
//     metis_1  | [0]    '{"id":"2376166064047524148","account":"JUP-KMRG-9PMP-87UD-3EXSF","accounthash":"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW","alias":"sprtz","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO","encryption_password":"sprtz"}',
// metis_1  | [0]   date: 1625269463920 }


    extractLatestTableNamesFromMessages(messages){
        if(messages.length === 0 ) {
            return []
        }

        const reducedMessages =  messages.reduce( (reduced, message) => {
            if(message.tables){
                reduced.push(message)
                return reduced;
            }
            return reduced;
        }, [])

        reducedMessages.sort(function(a, b){return b.date -a.date}); // decending by date
        logger.debug(`reducedMessage= ${JSON.stringify(reducedMessages)}`);

        if(reducedMessages.length < 1){
            return []
        }

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

        logger.debug(`tables= ${JSON.stringify(tables)}`);
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
        logger.insane(`   messages= ${JSON.stringify(messages)}`);

        const records = messages.reduce( (reduced, message) => {
                // const extractLatestTablesListFromMessages(messages)
                const keys = (Object.keys(message))
                for(let i = 0; i<keys.length; i++){
                    // console.log('**');
                    // console.log('key:', keys[i]);
                    const re = /\w+_record/;
                    if(re.test(keys[i])){
                        // console.log('FOUND the key: ', keys[i]);
                        let record = message[keys[i]];
                        try {
                            record = JSON.parse(message[keys[i]])
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
            }, [] )

        // logger.sensitive(`extractedRecordsFromMessages= ${JSON.stringify(records)}`);

        return records;
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

        properties.addAlias(record.alias);

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

        if (messages.length === 0) {
            return [];
        }

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
        logger.sensitive(`tables= ${JSON.stringify(tables)}`);

        return tables;
    }



}

module.exports.TableService = TableService;



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
