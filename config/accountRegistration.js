// import { gravity } from '../config/gravity';
// const gravity = require('../config/gravity');
// import User from '../models/user';
const {JupiterAccountProperties} = require("../gravity/jupiterAccountProperties");
const logger = require('../utils/logger')(module);

/**
 *
 */
class AccountRegistration {

    /**
     *
     * @param {GravityAccountProperties} accountProperties
     * @param {JupiterAPIService} jupiterAPIService
     */

    /**
     *
     * @param {GravityAccountProperties} newUserAccountProperties
     * @param {GravityAccountProperties} applicationGravityAccountProperties
     * @param {jupiterAPIService} jupiterAPIService
     * @param {Gravity} gravity
     */
    constructor(newUserAccountProperties, applicationGravityAccountProperties, jupiterAPIService, gravity) {
        this.newUserAccountProperties = newUserAccountProperties;
        this.applicationAccountProperties = applicationGravityAccountProperties;
        this.jupiterAPIService = jupiterAPIService;
        this.gravity = gravity;
    }

    defaultTableNames() {
        return ['users', 'channels', 'invites', 'storage']
    }


    findTableByName(tableName, tables){
        const filtered =  tables.filter(table => { return table.name == tableName  });
        if(filtered.length > 0){
            return filtered[0];
        }
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async register() {
        logger.verbose('#####################################################################################');
        logger.verbose(`## register()`)
        logger.verbose('#####################################################################################');



        return new Promise((resolve, reject) => {
            logger.verbose(`register().attachAllDefaultTables()`);

            const funds = parseInt(0.1 * 100000000, 10);

            logger.verbose(`register().sendMoney(account= ${this.newUserAccountProperties.address}, funds= ${funds})`)

            const waitFiveSeconds = 5;
            const waitTenSeconds = 50;
            this.gravity.sendMoneyAndWait(
                this.newUserAccountProperties.address, // to
                funds,
                this.applicationAccountProperties.passphrase, //from
                waitTenSeconds
            ).then(sendMoneyResponse => {
                logger.verbose('---------------------------------------------------------------------------------------');
                logger.verbose(`-- register().sendMoney().then(sendMoneyResponse= ${!!sendMoneyResponse})`);
                logger.verbose('---------------------------------------------------------------------------------------');


                logger.verbose(`register().sendMoney().then().attachAllDefaultTables()`)
                this.attachAllDefaultTables()
                    .then(attachedTablesResponse => {
                        logger.debug('---------------------------------------------------------------------------------------');
                        logger.debug(`-- register().sendMoney().then().attachAllDefaultTables().then(attacjedTablesResponse= ${!!attachedTablesResponse})`);
                        logger.debug('---------------------------------------------------------------------------------------');
                        logger.sensitive(`attachedTablesResponse= ${JSON.stringify(attachedTablesResponse)}`); // attachedTablesResponse= [{"name":"users","address":"JUP-A","passphrase":"tickle awkward cage steal","confirmed":true}]

                        const usersTableCreds = this.findTableByName('users', attachedTablesResponse);
                        logger.debug(`usersTableCreds= ${JSON.stringify(usersTableCreds)}`);
                        const usersTableProperties = JupiterAccountProperties.createProperties(usersTableCreds.address, usersTableCreds.passphrase, usersTableCreds.publicKey);
                        const userRecord = this.newUserAccountProperties.generateUserRecord('test');
                        logger.sensitive(`userRecord= ${JSON.stringify(userRecord)}`);

                        const encryptedUserRecord = this.newUserAccountProperties.crypto.encryptJson(userRecord);

                        console.log(2);
                        console.log(usersTableProperties.passphrase);
                        this.jupiterAPIService.postEncipheredMessage(usersTableProperties, this.newUserAccountProperties, encryptedUserRecord)
                            .then(response => {
                                logger.debug(`response.data= ${response.data}`);
                                return resolve('resolve something');
                            })
                            .catch(error => {
                                console.log(error);
                                // logger.error(`error= ${JSON.stringify(error)}`);
                                return reject(error);
                            })

                    })
                    .catch(error => {
                        logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                        logger.error(`register().sendMoney().then().attachAllDefaultTables().catch(${!!error})`);
                        logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                        logger.error(`error= ${JSON.stringify(error)}`);
                        reject(error);
                    })
            })
                .catch(error => {
                    logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                    logger.error(`error= ${JSON.stringify(error)}`);
                    logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                    reject(error);
                })
        })

    }


    /**
     *
     * @returns {Promise<unknown>}
     */
    async attachAllDefaultTables() {
        logger.verbose('#####################################################################################');
        logger.verbose(`## attachAllDefaultTables()`);
        logger.verbose('#####################################################################################');
        return new Promise((resolve, reject) => {

            logger.verbose(`attachAllDefaultTables().loadAccountData(accountProperties)`)

            this.gravity.loadAccountData(this.newUserAccountProperties)
                .then(accountData => {  //{tables: [], userRecord: null}
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`-- attachAllDefaultTables().loadAccountData().then(accountData)`)
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.sensitive(`accountData= ${JSON.stringify(accountData)}`);
                    // logger.sensitive(`accountData.tables= ${JSON.stringify(accountData.tables)}`);

                    const listOfAttachedTableNames = this.gravity.extractTableNamesFromTables(accountData.tables);
                    logger.debug(`listOfAttachedTableNames= ${listOfAttachedTableNames}`);
                    logger.debug(`AccountRegistration.defaultTableNames= ${this.defaultTableNames()}`);

                    const listOfMissingTableNames = this.defaultTableNames().filter(defaultTableName => {
                        // logger.debug(`isArray? ${Array.isArray(listOfAttachedTableNames)}`)
                        return !listOfAttachedTableNames.includes(defaultTableName)
                    })
                    logger.debug(`listOfMissingTableNames= ${listOfMissingTableNames}`);
                    const newTables = [];
                    // if(listOfMissingTableNames.length > 1) {
                    //     for (let i = 0; i < 1; i++) {

                    for ( let i = 0; i < listOfMissingTableNames.length; i++ ) {
                            logger.debug(`listOfMissingTableNames[i]= ${listOfMissingTableNames[i]}`)
                            newTables.push(this.attachTable(listOfMissingTableNames[i])) // // {name, address, passphrase, publicKey}
                        }
                    // }

                    // accountData.tables = [{name, address, passphrase, confirmed}]
                    logger.verbose(`-- attachAllDefaultTables().loadAccountData(accountProperties).then(accountData).PromiseAll(newTables))`)
                    Promise.all(newTables)
                        .then(results => { // [{success,message, data, jupiter_response, tables, others}]
                            logger.verbose('---------------------------------------------------------------------------------------');
                            logger.verbose(`-- attachAllDefaultTables().loadAccountData(accountProperties).then(accountData).PromiseAll(newTables).then(results= ${!!results})`);
                            logger.verbose('---------------------------------------------------------------------------------------');
                            logger.verbose(`results= ${JSON.stringify(results)}`);


                            if(Array.isArray(results) && results.length > 0){
                                const allTables = [...accountData.tables, ...results];
                                logger.verbose(`allTables= ${JSON.stringify(allTables)}`);
                                return resolve(allTables);
                            }

                            logger.verbose(`accountData.tables= ${JSON.stringify(accountData.tables)}`); //accountData.tables= [{"name":"users","address":"JUP-","passphrase":"tickle awl","confirmed":true}]

                            return resolve(accountData.tables);
                        })
                        .catch(error => {
                            reject(error);
                        })
                })
                .catch( error => {
                    logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                    logger.error(`attachAllDefaultTables().loadAccountData().catch(error = ${!!error})`);
                    logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                    logger.error(`error= ${JSON.stringify(error)}`);
                    reject(error)
                })
        })
    }


    async retrieveCurrentTables() {

    }


    async attachTable(tableName) {
        logger.verbose('########################################################################################')
        logger.verbose(`##                      attachTable(${tableName})`);
        logger.verbose('########################################################################################')
        // @TODO before attaching make sure the table doesn't yet exist.
        logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.newUserAccountProperties)} , tableName = ${tableName})`)

        return new Promise((resolve, reject) => {
            const accessData = this.newUserAccountProperties.generateAccessData();
            logger.debug(`accessData= ${JSON.stringify(accessData)}`);

            logger.verbose(`-- attachTable().attachTable(accessData= ${JSON.stringify(this.newUserAccountProperties)} , tableName = ${tableName})`);
            this.gravity.attachTable(accessData, tableName)
                .then(res => { // {name, address, passphrase, publicKey}
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`-- attachTable().attachTable(accessData= ${JSON.stringify(this.newUserAccountProperties)} , tableName = ${tableName}).THEN(res= ${!!res})`)
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.sensitive(`res= ${JSON.stringify(res)}`)

                        // [{"name":"users","address":"JUP-X53Y-G95B-VLG5-D2G3W","passphrase":"forever edge flag grip disappear pay true separate example darkness bottom sneak","confirmed":true},{"name":"channels","address":null,"passphrase":null,"confirmed":null},{"name":"invites","address":null,"passphrase":null,"confirmed":null},{"name":"storage","address":null,"passphrase":null,"confirmed":null}]


                    // const attachedTable = {
                    //     name: tableName,
                    //     address: res.data.transactionJSON.recipientRS,
                    //     passphrase: 'goeshere',
                    //     account: res.data.transactionJSON.recipient,
                    //     publicKey: 'here',
                    //     transaction: res.dta.transactionJSON.transaction
                    // }
                    // logger.sensitive(`attachedTable= ${JSON.stringify(res)}`);
                    resolve(res);
                })
                .catch(error => {
                    logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                    logger.error(`xx attachTable().attachTable(accessData= ${JSON.stringify(this.newUserAccountProperties)} , tableName = ${tableName}).error(error)`)
                    logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                    logger.error(`error= ${JSON.stringify(error)}`);
                    reject(new Error('error!!!!!'));
                })
        })
    }
}

module.exports.AccountRegistration = AccountRegistration;

// results= [
//     {   "success":true,
//         "message":"Table users pushed to the blockchain and funded.",
//         "data": {
//             "signatureHash":"123",
//             "transactionJSON": {
//                 "senderPublicKey":"123",
//                 "signature":"123",
//                 "feeNQT":"100",
//                 "type":0,
//                 "fullHash":"122",
//                 "version":1,
//                 "phased":false,
//                 "ecBlockId":"14299521375805376641",
//                 "signatureHash":"123",
//                 "attachment":{
//                     "version.OrdinaryPayment":0},
//                 "senderRS":"JUP-KMRG-9PMP-87UD-3EXSF",
//                 "subtype":0,
//                 "amountNQT":"99150",
//                 "sender":"1649351268274589422",
//                 "recipientRS":"JUP-X53Y-G95B-VLG5-D2G3W",
//                 "recipient":"13692561836985977918",
//                 "ecBlockHeight":202691,
//                 "deadline":60,
//                 "transaction":"5819163356141812942",
//                 "timestamp":120963232,
//                 "height":2147483647},
//             "unsignedTransactionBytes":"123",
//             "broadcasted":true,
//             "requestProcessingTime":4,
//             "transactionBytes":"123",
//             "fullHash":"123",
//             "transaction":"5819163356141812942"},
//         "jupiter_response":{"signatureHash":"123",
//             "transactionJSON":{"senderPublicKey":"123",
//                 "signature":"123",
//                 "feeNQT":"100",
//                 "type":0,
//                 "fullHash":"123",
//                 "version":1,
//                 "phased":false,
//                 "ecBlockId":"14299521375805376641",
//                 "signatureHash":"123",
//                 "attachment":{"version.OrdinaryPayment":0},
//                 "senderRS":"JUP-KMRG-9PMP-87UD-3EXSF",
//                 "subtype":0,
//                 "amountNQT":"99150",
//                 "sender":"1649351268274589422",
//                 "recipientRS":"JUP-X53Y-G95B-VLG5-D2G3W",
//                 "recipient":"13692561836985977918",
//                 "ecBlockHeight":202691,
//                 "deadline":60,
//                 "transaction":"5819163356141812942",
//                 "timestamp":120963232,
//                 "height":2147483647},
//             "unsignedTransactionBytes":"123",
//             "broadcasted":true,
//             "requestProcessingTime":4,
//             "transactionBytes":"123",
//             "fullHash":"123",
//             "transaction":"5819163356141812942"},
//         "tables":["users"],
//         "others":[]}]

