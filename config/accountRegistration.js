import { gravity } from '../config/gravity';
// import User from '../models/user';
const logger = require('../utils/logger')(module);

class AccountRegistration {
    constructor(accessData, fromAccount) {
        this.accessData = accessData;
        this.fromAccount = fromAccount;
    }

    async attachTable(tableName){
        logger.verbose('########################################################################################')
        logger.verbose(`##                      attachTable(${tableName})`);
        logger.verbose('########################################################################################')
        // @TODO before attaching make sure the table doesn't yet exist.
        logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.accessData)} , tableName = ${tableName})`)

        return new Promise( (resolve, reject) =>{
            gravity.attachTable(this.accessData, tableName)
                .then(res =>{
                    logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.accessData)} , tableName = ${tableName}).THEN(res)`)
                    logger.debug('%%%%%%%%%%%%%%%%% THEN %%%%%%%%%%%%%%%%%');
                    resolve(res);
                    // res = { success: true };
                    // workerData.usersExists = true;
                    // workerData.usersConfirmed = false;
                })
                .catch( error => {
                    logger.error(`attachTable().attachTable(accessData= ${JSON.stringify(this.accessData)} , tableName = ${tableName}).error(error)`)
                    logger.error(`error= ${error}`);
                    console.log(error)
                    reject(new Error('error!!!!!'));
                })
        })
    }
}

module.exports.AccountRegistration = AccountRegistration;
