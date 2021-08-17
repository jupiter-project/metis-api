import { gravity } from '../config/gravity';
import {userInfo} from "os";
import UserWorker from "../workers/user";
// import User from '../models/user';
const logger = require('../utils/logger')(module);

class AccountRegistration {
    constructor(accountCredentials) {
        this.accountCredentials = accountCredentials;
    }

    static defaultTableNames = ['users', 'channels','invites', 'storage']


    async register(){
        this.attachAllDefaultTables()
            .then(response => {
                sendMoney(this.accountCredentials);
                sentTans1(this.accountCredentials);
                sendTrans2(this.accountCredentials);
                resolve(something);
            }
        )
    }


    async attachAllDefaultTables(){
        return new Promise(  (resolve, reject) => {
            gravity.loadAccountData(this.accountCredentials)
                .then(accountData => {  //{tables: [], userRecord: null}
                    const listOfAttachedTableNames = gravity.extractTableNamesFromTables(accountData.tables);
                    const listOfMissingTableNames = AccountRegistration.defaultTableNames.filter( defaultTableName => {
                        listOfAttachedTableNames.includes(defaultTableName)
                    })

                    const newTables = [];
                    for ( let i = 0; i < listOfMissingTableNames.length; i++ ) {
                        newTables.push(this.attachTable(listOfMissingTableNames[i]))
                    }

                    Promise.all(newTables)
                        .then( results => {
                            resolve(results);
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
        logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.accountCredentials)} , tableName = ${tableName})`)

        return new Promise( (resolve, reject) =>{
            gravity.attachTable(this.accountCredentials, tableName)
                .then(res =>{
                    logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.accountCredentials)} , tableName = ${tableName}).THEN(res)`)
                    logger.debug('%%%%%%%%%%%%%%%%% THEN %%%%%%%%%%%%%%%%%');
                    resolve(res);
                    // res = { success: true };
                    // workerData.usersExists = true;
                    // workerData.usersConfirmed = false;
                })
                .catch( error => {
                    logger.error(`attachTable().attachTable(accessData= ${JSON.stringify(this.accountCredentials)} , tableName = ${tableName}).error(error)`)
                    logger.error(`error= ${error}`);
                    console.log(error)
                    reject(new Error('error!!!!!'));
                })
        })
    }
}

module.exports.AccountRegistration = AccountRegistration;
