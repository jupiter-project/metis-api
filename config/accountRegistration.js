// import { gravity } from '../config/gravity';
// const gravity = require('../config/gravity');
// import User from '../models/user';
const { JupiterAccountProperties } = require('../gravity/jupiterAccountProperties');
const { JupiterFundingService } = require('../services/jupiterFundingService');
const { applicationAccountProperties } = require('../gravity/applicationAccountProperties');
const { FundingNotConfirmedError } = require('../errors/metisError');
const gravity = require("./gravity");
const logger = require('../utils/logger')(module);

/**
 *
 */
class AccountRegistration {
  /**
     *
     * @param {GravityAccountProperties} newUserAccountProperties
     * @param {GravityAccountProperties} applicationGravityAccountProperties
     * @param {JupiterAPIService} jupiterAPIService
     * @param {JupiterFundingService} jupiterFundingService
     * @param {JupiterAccountService} jupiterAccountService
     * @param {TableService} tableService
     * @param {Gravity} gravity
     */
  constructor(
      newUserAccountProperties,
      applicationGravityAccountProperties,
      jupiterAPIService,
      jupiterFundingService,
      jupiterAccountService,
      tableService,
      gravity) {
    this.newUserAccountProperties = newUserAccountProperties;
    this.applicationAccountProperties = applicationGravityAccountProperties;
    this.jupiterAPIService = jupiterAPIService;
    this.jupiterFundingService = jupiterFundingService;
    this.jupiterAccountService = jupiterAccountService;
    this.tableService = tableService;
    this.gravity = gravity;
  }

  defaultTableNames() {
    return ['channels', 'invites', 'storage'];
  }


  findTableByName(tableName, tables) {
    const filtered = tables.filter(table => table.name == tableName);
    if (filtered.length > 0) {
      return filtered[0];
    }
  }


  async register() {
    logger.verbose('###########################################');
    logger.verbose('###########################################');
    logger.verbose('## register()');
    logger.verbose('##');

    return new Promise(async (resolve, reject) => {
      // const funds = parseInt(0.1 * 100000000, 10);
      // console.log(`funds: `, funds);
      // logger.verbose(`register().provideInitialStandardUserFunds(account= ${this.newUserAccountProperties.address}, funds= ${funds})`)
        // TODO add a proper error handler

        const alias = this.newUserAccountProperties.getCurrentAliasOrNull();
        const userPassphrase = this.newUserAccountProperties.passphrase;
        const userAccount = this.newUserAccountProperties.address;
        if (!alias){
            reject('No alias provided');
        }
        // Get Metis Data
        logger.verbose(`register().fetchAccountData(applicationAccountProperties=${!!this.applicationAccountProperties})`);
        logger.debug('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        logger.debug('++                    fetch application account data from Metis Account');
        logger.debug('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        this.jupiterAccountService.fetchAccountData(this.applicationAccountProperties)
        .then((applicationAccountData) => {
          logger.verbose('----------------------------------------');
          logger.verbose(`-- register().fetchAccountData(applicationAccountProperties).then(applicationAccountData)`);
          logger.verbose('----------------------------------------');
          // logger.sensitive(`  applicationAccountData.attachedTables= ${JSON.stringify(applicationAccountData.attachedTables)}`);
          const usersTableProperties = this.tableService.extractTableFromTablesOrNull('users', applicationAccountData.attachedTables);
          // logger.sensitive(`  usersTableProperties= ${JSON.stringify(usersTableProperties)}`);

          if (!usersTableProperties) {
            // throw new Error('there is no application users table!')
            reject('There is no application users table!');
          }

          usersTableProperties
            .setCrypto(this.applicationAccountProperties.crypto.decryptionPassword);

          logger.sensitive(`  usersTableProperties= ${JSON.stringify(usersTableProperties)}`);

          // Get Metis Users Table data
          // logger.info('Get Metis Users Table Data');
          logger.debug('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
          logger.debug('++                    fetch account data for Metis Users Table Account');
          logger.debug('++');
          this.jupiterAccountService.fetchAccountData(usersTableProperties)
            .then((usersTableData) => {
              logger.verbose('----------------------------------------');
              logger.verbose('-- register().fetchAccountData(applicationAccountProperties).fetchAccountData(applicationUsersTableProperties).then(usersTableData)');
              logger.verbose('--');
              logger.sensitive(`  usersTableProperties= ${JSON.stringify(usersTableProperties)}`);

              const userAccountPropertiesFoundInApplication =
                  this.tableService.extractUserPropertiesFromRecordsOrNull(
                    this.newUserAccountProperties.address,
                    usersTableData.allRecords,
                  );

              if (userAccountPropertiesFoundInApplication) {
                return resolve('already registered');
              }

                this.jupiterAPIService.getAlias(alias)
                    .then(aliasResponse => {
                        if (aliasResponse.available){
                            logger.debug('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                            logger.debug('++                    User is not in the Metis Records. ');
                            logger.debug('++                    Get New User Account Data. ');
                            logger.debug('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                            // Get User Account Data
                            return this.jupiterAccountService.fetchAccountData(this.newUserAccountProperties)
                        }
                        //TODO if alias already belong to the account the continue
                        return reject('Alias is already in use');
                    })
                .then((newUserAccountData) => {
                  logger.verbose('----------------------------------------');
                  logger.verbose('-- fetchAccountData(newUserAccountData).then()');
                  logger.verbose('----------------------------------------');

                  const payments = [];
                  const newAccountPaymentConfirmation = this.jupiterFundingService.provideInitialStandardUserFunds(this.newUserAccountProperties);
                  const defaultTables = ['invites', 'storage', 'channels'];
                  const newTables = defaultTables.filter(tableName => !newUserAccountData.attachedTables.has(tableName));
                  newTables.forEach(tableName =>  payments.push(this.jupiterFundingService.createTableAccountAndProvideInitialStandardTableFunds(tableName)));

                  Promise.all([...payments,newAccountPaymentConfirmation]).then( results =>{

                      this.jupiterFundingService.waitForTransactionsConfirmation(transactions)
                          .then(()=>{
                              let attachedTables = [];
                              results.forEach( tableProperties =>{
                                  attachedTables.push(this.attachTable(tableProperties, userAccountProperties))
                              } )

                              Promise.all(attachedTables).then( tables => {
                                  await this.jupiterAPIService.setAlias(params);
                                  await this.jupiterAccountService.addRecordToMetisUsersTable(this.newUserAccountProperties, usersTableProperties);
                                  await this.verifyRegistration(this.newUserAccountProperties, this.applicationAccountProperties, usersTableProperties)}
                              } )

                          })
                  } )

                //
                //   // TODO Add to Metis users table at the very end. also we need to confirm all transactions.
                //   this.jupiterAccountService.addRecordToMetisUsersTable(this.newUserAccountProperties, usersTableProperties)
                //     .then((newUserRecordTransactionId) => {
                //       logger.verbose('----------------------------------------');
                //       logger.verbose('-- addAccountToMetisUsersTable(newUserAccountData).then()');
                //       logger.verbose('----------------------------------------');
                //       logger.debug(`newUserRecordTransactionId= ${newUserRecordTransactionId}`);
                //
                //       logger.verbose(`provideInitialStandardUserFunds for ${this.newUserAccountProperties.address}`);
                //       this.jupiterFundingService.provideInitialStandardUserFunds(this.newUserAccountProperties)
                //         .then((sendMoneyResponse) => {
                //           logger.verbose('----------------------------------------');
                //           logger.verbose(`-- register().transferAndWait().then(sendMoneyResponse= ${!!sendMoneyResponse})`);
                //           logger.verbose('----------------------------------------');
                //
                //           this.jupiterFundingService.waitForTransactionConfirmation(sendMoneyResponse.data.transaction)// TODO This should probably go to JupiterTransactionsService
                //             .then((waitForConfirmationResponse) => {
                //               logger.verbose('----------------------------------------');
                //               logger.verbose('waitForTransactionConfirmation().then()');
                //               logger.verbose('----------------------------------------');
                //               logger.verbose('register().provideInitialStandardUserFunds(newUserAccountProperties).then(sendMoneyResponse).waitForTransactionConfirmation(transactionId).then(waitForConfirmationResponse)');
                //               logger.verbose('attachAllDefaultTables()');
                //               this.attachMissingDefaultTables(newUserAccountData.attachedTables)
                //                   .then((attachedTablesResponse) => {
                //                   logger.verbose('----------------------------------------');
                //                   logger.verbose('attachAllDefaultTables().then()');
                //                   logger.verbose('----------------------------------------');
                //                   logger.sensitive(`attachedTablesResponse= ${JSON.stringify(attachedTablesResponse)}`); // attachedTablesResponse= [{"name":"users","address":"JUP-A","passphrase":"tickle awkward cage steal","confirmed":true}]
                //                     const params = {
                //                         alias,
                //                         passphrase: userPassphrase,
                //                         account: userAccount
                //                     }
                //                   return this.jupiterAPIService.setAlias(params);
                //                   })
                //                   .then(setAliasResponse => {
                //                     return resolve('done')
                //                   })
                //                   .then( ()=>{
                //                       // async verifyRegistration(newUserProperties, appProperties, usersTableProperties){
                //                       return this.verifyRegistration(this.newUserAccountProperties, this.applicationAccountProperties, usersTableProperties)}
                //                   )
                //                   .catch((error) => {
                //                   logger.error('********************');
                //                   logger.error(`** register().sendMoney().then().attachAllDefaultTables().catch(${!!error})`);
                //                   logger.error('********************');
                //                   return reject(error);
                //                 });
                //             });
                //         });
                //     });
                // });
            });
        })
        .catch(error => {
            logger.error('********************');
            logger.error('********************');
            logger.error(`_ error Main promise= ${JSON.stringify(error)}`);
            logger.error('********************');
            logger.error('********************');
            return reject(error);
        })
    });
  }



  async verifyRegistration(newUserProperties, appProperties, usersTableProperties){
      logger.verbose('################################################################');
      logger.verbose(`## verifyRegistration(user= ${newUserProperties.address}, app=${appProperties.address}, usersTable=${usersTableProperties.address})`);
      logger.verbose('##');
      logger.verbose('##');
      return new Promise( (resolve, reject) => {
          this.jupiterAccountService.fetchAccountData(usersTableProperties)
              .then((usersTableData) => {
                  logger.verbose('-------------------------------------------');
                  logger.verbose(`-- verifyRegistration(user= ${newUserProperties.address}, app=${appProperties}).fetchAccountData(userTableProperties=${usersTableProperties.address}).then(usersTableData)`);
                  logger.verbose('--');
                  // logger.sensitive(`applicationUsersTableProperties= ${JSON.stringify(applicationUsersTableProperties)}`);

                  const userAccountPropertiesFoundInUsersTable =
                      this.tableService.extractUserPropertiesFromRecordsOrNull(
                          this.newUserAccountProperties.address,
                          usersTableData.allRecords,
                      );

                  logger.debug(`userAccountPropertiesFoundInUsersTable=${JSON.stringify(userAccountPropertiesFoundInUsersTable)}`);

                  if (!userAccountPropertiesFoundInUsersTable) {
                      return reject(false);
                  }

                  logger.debug(`newUserProperties= ${JSON.stringify(newUserProperties)}`);

                  this.jupiterAccountService.fetchAccountData(newUserProperties)
                      .then( newUserAccountData => {
                          console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
                          console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
                          console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
                          console.log(newUserAccountData.attachedTables); //[{name, address, passphrase, publicKey}]
                          console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
                          console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
                          console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
                          return resolve(true)
                      })
              })
        })
  }

  /**
     *
     * @returns {Promise<unknown>}
     */
  async attachAllDefaultTables() {
    logger.verbose('################################################################');
    logger.verbose('## attachAllDefaultTables()');
    logger.verbose('##');
    logger.verbose('##');

    return new Promise((resolve, reject) => {
      logger.verbose(`   attachAllDefaultTables().loadAccountData(accountProperties= ${!!this.newUserAccountProperties})`);

      // @TODO change this to this.jupiterAccountService.fetchAccountData(this.newUserAccountProperties)
      this.gravity.loadAccountData(this.newUserAccountProperties)
        .then(accountData => this.attachMissingDefaultTables(accountData.tables))
        .catch((error) => {
          logger.error('________________________');
          logger.error(`__    attachAllDefaultTables().loadAccountData(accountProperties).catch(error = ${!!error})`);
          logger.error('________________________');
          logger.error(`error= ${JSON.stringify(error)}`);
          reject(error);
        });
    });
  }


  async attachMissingDefaultTables(currentlyAttachedTables) {
    logger.verbose('#####################################################################################');
    logger.verbose('## attachMissingDefaultTables(currentlyAttachedTables)');
    logger.verbose('##');
    logger.verbose(` attaching tables to: ${this.newUserAccountProperties.address}`)
    logger.verbose(` currentlyAttachedTables.length= ${currentlyAttachedTables.length}`);
    logger.debug(` currentlyAttachedTables= ${JSON.stringify(currentlyAttachedTables)}`);

    return new Promise((resolve, reject) => {
      logger.verbose(` attachMissingDefaultTables().loadAccountData(accountProperties= ${!!this.newUserAccountProperties})`);
      const listOfAttachedTableNames = this.gravity.extractTableNamesFromTables(currentlyAttachedTables);
      logger.debug(`listOfAttachedTableNames= ${listOfAttachedTableNames}`);
      logger.debug(`AccountRegistration.defaultTableNames= ${this.defaultTableNames()}`);

      const listOfMissingTableNames = this.defaultTableNames().filter(defaultTableName => !listOfAttachedTableNames.includes(defaultTableName));
      logger.debug(`listOfMissingTableNames= ${listOfMissingTableNames}`);

      const newTables = [];
      for (let i = 0; i < listOfMissingTableNames.length; i++) {
        logger.debug(`listOfMissingTableNames[i]= ${listOfMissingTableNames[i]}`);


        logger.debug(`Attaching a table: ${listOfMissingTableNames[i]} to the account: ${this.newUserAccountProperties.address}`)
        newTables.push(this.attachTable(listOfMissingTableNames[i])); // // {name, address, passphrase, publicKey}
      }
      // }

      // accountData.tables = [{name, address, passphrase, confirmed}]
      logger.verbose('-- attachMissingDefaultTables().PromiseAll(newTables))');
      Promise.all(newTables)
        .then((results) => { // [{success,message, data, jupiter_response, tables, others}]
          logger.verbose('---------------------------------------------------------------------------------------');
          logger.verbose(`-- attachAllDefaultTables().loadAccountData(accountProperties).then(accountData).PromiseAll(newTables).then(results= ${!!results})`);
          logger.verbose('---------------------------------------------------------------------------------------');
          logger.verbose(`results= ${JSON.stringify(results)}`);
          logger.verbose(`currentlyAttachedTables= ${currentlyAttachedTables}`);

          if (Array.isArray(results) && results.length > 0) {
            const allTables = [...currentlyAttachedTables, ...results];
            logger.verbose(`allTables= ${JSON.stringify(allTables)}`);
            return resolve(allTables);
          }

          logger.verbose(`currentlyAttachedTables= ${JSON.stringify(currentlyAttachedTables)}`); // accountData.tables= [{"name":"users","address":"JUP-","passphrase":"tickle awl","confirmed":true}]

          return resolve(currentlyAttachedTables);
        })
        .catch((error) => {
            logger.error(`_______________________________________________`)
            logger.error(`There was a problem attaching a table!`)
            logger.debug(`Attaching to the account: ${this.newUserAccountProperties.address}`)
            console.log(error);
            logger.error(`_______________________________________________`)

          reject(error);
        });
    });
  }


  async retrieveCurrentTables() {

  }


    /**
     *
     * @param tableName
     * @returns {Promise<{name, address, passphrase, publicKey}>}
     */
  async attachTable(tableName) {
    logger.verbose('########################################################################################');
    logger.verbose(`##                      attachTable(tableName=${tableName})`);
    logger.verbose('##');
    // @TODO before attaching make sure the table doesn't yet exist.
    logger.debug(`attachTable().attachTable(accessData= ${JSON.stringify(this.newUserAccountProperties)} , tableName = ${tableName})`);

    return new Promise((resolve, reject) => {
      const accessData = this.newUserAccountProperties.generateAccessData();
      logger.debug(`accessData= ${JSON.stringify(accessData)}`);

      // this.jupiterAccountService.getStatement(this.newUserAccountProperties)
      //     .then(accountStatement => {
      //         if (!(accountStatement.hasMinimumAppBalance && accountStatement.hasMinimumTableBalance)) {
      //             return reject(' needs minimal balances');
      //         }
      //         this.tableService.attachTable(this.newUserAccountProperties, tableName)
      //             .then(response => {
      //             })
      //
      logger.verbose(`-- attachTable().attachTable(accessData= ${JSON.stringify(this.newUserAccountProperties)} , tableName = ${tableName})`);
      this.gravity.attachTable(accessData, tableName)
        .then((res) => { // {name, address, passphrase, publicKey}
          logger.verbose('---------------------------------------------------------------------------------------');
          logger.verbose(`-- attachTable().attachTable(accessData= ${JSON.stringify(this.newUserAccountProperties)} , tableName = ${tableName}).THEN(res= ${!!res})`);
          logger.verbose('---------------------------------------------------------------------------------------');
          logger.sensitive(`res= ${JSON.stringify(res)}`);
          resolve(res);
        })
        .catch((error) => {
          logger.error('********************');
          logger.error('** ERROR ATTACHING TABLE!')
          logger.error(`  attachTable().attachTable(accessData= ${JSON.stringify(this.newUserAccountProperties)} , tableName = ${tableName}).error(error)`);
          console.log(error);
          reject(error);
        });
    });
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
