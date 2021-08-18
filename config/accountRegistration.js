import { userInfo } from 'os';
import { gravity } from './gravity';
import UserWorker from '../workers/user';
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

    static defaultTableNames = ['users', 'channels', 'invites', 'storage']


    async register() {
      return this.attachAllDefaultTables()
        .then((attachedTablesResponse) => {
          const sendMoneyPromise = gravity.sendMoney(
            this.accountProperties.jup_account_id,
            parseInt(0.05 * 100000000, 10),
          );
          return Promise.all([attachedTablesResponse, sendMoneyPromise]);
        })
        .then(([attachedTablesResponse, sendMoneyResponse]) => {
          const { usersTableProperties } = attachedTablesResponse;
          const userRecord = this.accountProperties.generateUserRecord();
          const encryptedUserRecord = this.accountProperties.crypto.encryptJson(userRecord);

          this.jupiterAPIService.postEncipheredMessage(
            usersTableProperties,
            this.accountProperties,
            encryptedUserRecord,
            feeNQT,
          );
          // TODO review what you are gonna return
          resolve('resolve something');
        });
    }


    async attachAllDefaultTables() {
      return new Promise((resolve, reject) => {
        gravity.loadAccountData(this.accountProperties)
          .then((accountData) => { // {tables: [], userRecord: null}
            const listOfAttachedTableNames = gravity.extractTableNamesFromTables(accountData.tables);

            const listOfMissingTableNames = AccountRegistration.defaultTableNames
              .filter(defaultTableName => listOfAttachedTableNames.includes(defaultTableName));

            const newTables = [];

            // TODO shouldn't be listOfMissingTableNames.length - 1?
            for (let idx = 0; idx < listOfMissingTableNames.length - 1; idx++) {
              newTables.push(this.attachTable(listOfMissingTableNames[idx]));
            }

            return Promise.all(newTables);
          })
          .then((results) => {
            resolve(results);
          })
          .catch((error) => {
            reject(error);
          });
      });
    }


    async retrieveCurrentTables() {

    }


    async attachTable(tableName) {
      logger.verbose('########################################################################################');
      logger.verbose(`##                      attachTable(${tableName})`);
      logger.verbose('########################################################################################');
      // @TODO before attaching make sure the table doesn't yet exist.
      logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.accountProperties)} , tableName = ${tableName})`);

      return new Promise((resolve, reject) => {
        gravity.attachTable(this.accountProperties, tableName)
          .then((res) => {
            logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.accountProperties)} , tableName = ${tableName}).THEN(res)`);
            logger.debug('%%%%%%%%%%%%%%%%% THEN %%%%%%%%%%%%%%%%%');
            resolve(res);
            // res = { success: true };
            // workerData.usersExists = true;
            // workerData.usersConfirmed = false;
          })
          .catch((error) => {
            logger.error(`attachTable().attachTable(accessData= ${JSON.stringify(this.accountProperties)} , tableName = ${tableName}).error(error)`);
            logger.error(`error= ${error}`);
            console.log(error);
            reject(new Error('error!!!!!'));
          });
      });
    }
}

module.exports.AccountRegistration = AccountRegistration;
