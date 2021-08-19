import { gravity } from '../config/gravity';
import {userInfo} from "os";
import UserWorker from "../workers/user";
// import User from '../models/user';
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
    constructor(accountProperties, jupiterAPIService) {
        this.accountProperties = accountProperties;
        this.jupiterAPIService = jupiterAPIService;
    }

    static defaultTableNames = ['users', 'channels','invites', 'storage']


    async register(){
        logger.verbose('#####################################################################################');
        logger.verbose(`## register()`)
        logger.verbose('#####################################################################################');

        logger.verbose(`register().attachAllDefaultTables()`);
        this.attachAllDefaultTables()
            .then(attachedTablesResponse => {
                logger.debug('---------------------------------------------------------------------------------------');
                logger.debug(`-- register().attachAllDefaultTables().then(attacjedTablesResponse= ${!!attachedTablesResponse})`);
                logger.debug('---------------------------------------------------------------------------------------');
                gravity.sendMoney(
                    this.accountProperties.jup_account_id,
                    parseInt(0.05 * 100000000, 10),
                ).then(sendMoneyResponse => {
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`-- register().attachAllDefaultTables().sendMoney().then(sendMoneyResponse)`);
                    logger.verbose('---------------------------------------------------------------------------------------');
                    const usersTableProperties = attachedTablesResponse.usersTableProperties;
                    const userRecord = this.accountProperties.generateUserRecord();
                    const encryptedUserRecord = this.accountProperties.crypto.encryptJson(userRecord);
                    this.jupiterAPIService.postEncipheredMessage(usersTableProperties, this.accountProperties, encryptedUserRecord, feeNQT)
                    resolve('resolve something');
                })
            }
        )
    }


    async attachAllDefaultTables(){
        logger.verbose('#####################################################################################');
        logger.verbose(`## attachAllDefailtTables()`);
        logger.verbose('#####################################################################################');
        return new Promise(  (resolve, reject) => {

            logger.verbose(`attachAllDefaultTables().loadAccountData(accountProperties)`)
            gravity.loadAccountData(this.accountProperties)
                .then(accountData => {  //{tables: [], userRecord: null}
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`-- attachAllDefaultTables().loadAccountData().then(accountData)`)
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.sensitive(`accountData= ${JSON.stringify(accountData)}`);

                    const listOfAttachedTableNames = gravity.extractTableNamesFromTables(accountData.tables);
                    const listOfMissingTableNames = AccountRegistration.defaultTableNames.filter( defaultTableName => {
                        listOfAttachedTableNames.includes(defaultTableName)
                    })

                    const newTables = [];
                    for ( let i = 0; i < listOfMissingTableNames.length; i++ ) {
                        newTables.push(this.attachTable(listOfMissingTableNames[i])) // {success,message, data, jupiter_response, tables, others}
                    }

                    // accountData.tables = [{name, address, passphrase, confirmed}]
                    logger.verbose(`-- attachAllDefaultTables().loadAccountData().then(accountData).PromiseAll(newTables))`)
                    Promise.all(newTables) // [{success,message, data, jupiter_response, tables, others}]
                        .then( results => {
                            logger.verbose(`-- attachAllDefaultTables().loadAccountData().then(accountData).PromiseAll(newTables)).then(results)`)
                            logger.verbose(` results= ${JSON.stringify(results)}`);

                            if(!(Array.isArray(results) && results.length > 0)){
                                reject('problem.');


                            }

                            const allTables = [ ...accountData.tables, ...results.others];
                            resolve(allTables);
                        })
                        .catch( error =>{
                            reject(error);
                        })
                })
        } )
    }


    async retrieveCurrentTables(){

    }




    async attachTable(tableName){
        logger.verbose('########################################################################################')
        logger.verbose(`##                      attachTable(${tableName})`);
        logger.verbose('########################################################################################')
        // @TODO before attaching make sure the table doesn't yet exist.
        logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.accountProperties)} , tableName = ${tableName})`)

        return new Promise( (resolve, reject) =>{
            const accessData = this.accountProperties.generateAccessData();
            gravity.attachTable(accessData, tableName)
            .then(res =>{


                logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.accountProperties)} , tableName = ${tableName}).THEN(res)`)
                resolve(res);
            })
            .catch( error => {
                logger.error(`attachTable().attachTable(accessData= ${JSON.stringify(this.accountProperties)} , tableName = ${tableName}).error(error)`)
                logger.error(`error= ${error}`);
                console.log(error)
                reject(new Error('error!!!!!'));
            })
        })
    }
}

module.exports.AccountRegistration = AccountRegistration;
