import {FeeManager, feeManagerSingleton} from "../services/FeeManager";
import {FundingManager, fundingManagerSingleton} from "../services/fundingManager";
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const events = require('events');
const _ = require('lodash');
const methods = require('./_methods');
const logger = require('../utils/logger')(module);
const AccountRegistration  = require('../services/accountRegistrationService');
import { gravityCLIReporter} from '../gravity/gravityCLIReporter';


const addressBreakdown = process.env.APP_ACCOUNT_ADDRESS ? process.env.APP_ACCOUNT_ADDRESS.split('-') : [];

class Gravity {
  constructor() {
    this.algorithm = process.env.ENCRYPT_ALGORITHM;
    this.password = process.env.ENCRYPT_PASSWORD;
    this.sender = process.env.APP_ACCOUNT;
    this.version = process.env.VERSION;
    this.jupiter_data = {
      server: process.env.JUPITERSERVER,
      feeNQT: feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction), // was hardcoded 500
      deadline: process.env.JUPITER_DEADLINE, //60
      minimumTableBalance: fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table),  //was hardcoded 50000,
      minimumAppBalance: fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user),   // was hard coded 100000,
      moneyDecimals:  process.env.JUPITER_MONEY_DECIMALS,  // was hardcoded 8,
      version: process.env.VERSION,
    };
    this.generate_passphrase = methods.generate_passphrase;
    this.appSchema = {
      appData: {
        name: '',
        address: '',
        description: '',
      },
      tables: [],
    };
    this.fundingProperty = `funding-${addressBreakdown[addressBreakdown.length - 1]}`;
    this.data = {};
    this.tables = [];
  }

  hasTable(database, tableName) {
    let hasKey = false;
    for (let x = 0; x < database.length; x += 1) {
      const tableKeys = Object.keys(database[x]);
      if (tableKeys.includes(tableName)) {
        hasKey = true;
        break;
      }
    }

    return hasKey;
  }

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

  getTableData(table, database) {
    let tableData;

    for (let x = 0; x < database.length; x += 1) {
      const tableKeys = Object.keys(database[x]);
      if (tableKeys.length > 0) {
        if (tableKeys[0] === table && !tableData) {
          tableData = database[x];
          break;
        }
      }
    }

    return tableData[table];
  }

  showTables(returnType = 'app') {
    const self = this;
    return new Promise((resolve, reject) => {
      logger.debug('-- ---- -- --- -- --- $$$$$ -- ---- -- --- -- --- 2')
      self.loadUserAndAppData()
        .then((response) => {
          if (returnType === 'console') {
            logger.info(
              `Database tables associated with your app ${
                response.app.appData.name
              } (${response.app.address})`,
            );
            logger.info(response.tables);
            logger.info('If you wish to show table details, run "npm run gravity:db"');
            logger.info('If you wish to add a new table, run "npm run gravity:db:add"');
          }
          resolve(response.tables);
        })
        .catch((error) => {
          logger.error(error);
          reject(error);
        });
    });
  }


  loadTables(returnType = 'app', accessData) {
    const self = this;
    let current;
    return new Promise((resolve, reject) => {
      logger.debug('-- ---- -- --- -- --- $$$$$ -- ---- -- --- -- --- 3')
      self.loadUserAndAppData(accessData)
        .then((response) => {
          const { tables } = response.app;

          if (returnType === 'console') {
            logger.verbose(`Database tables associated with your app ${response.app.appData.name}(${response.app.address})`);
            Object.keys(tables).forEach((x) => {
              current = tables[x];
              const [key] = Object.keys(tables[x]);
              logger.verbose(`Table => ${key}`);
              logger.verbose('---Table Address---');
              logger.verbose(current[key].address);
              logger.verbose('---Table Passphrase---');
              logger.sensitive(current[key].passphrase);
              logger.verbose('---Table Public Key---');
              logger.verbose(current[key].public_key);
              logger.verbose('----------------------------------------------------------------');
            });
          }
          resolve(tables);
        })
        .catch((error) => {
          logger.error(error);
          reject(error);
        });
    });
  }

  encrypt(text, password = this.password) {
    const cipher = crypto.createCipher(this.algorithm, password);
    let crypted = cipher.update(text, 'utf8', 'hex');
    crypted += cipher.final('hex');

    return crypted;
  }

  /**
   *
   * @param {string} text
   * @param {string} password
   * @returns {string}
   */
  decrypt(text, password = this.password) {
    try {
      // logger.sensitive(`Decrypting with password: ${password}  AND algorithm: ${this.algorithm}`);
      // logger.sensitive(`Text to decrypt: ${text}`);

      const decipher = crypto.createDecipher(this.algorithm, password);
      let dec = decipher.update(text, 'hex', 'utf8');
      dec += decipher.final('utf8');
      logger.sensitive(`DECRYPTED: ${dec}`)
      return dec;
    } catch( error){
      // logger.warn(`NOT ABLE 2 DECRYPT: ${error}`);
      throw error
    }
  }

  sortByDate(array, order = 'asc') {
    return array.sort((a, b) => {
      const x = a.date;
      const y = b.date;
      let ruleOne;
      let ruleTwo;

      if (order === 'asc' || order !== 'desc') {
        ruleOne = (x !== undefined && x > y);
        ruleTwo = (x === undefined || x < y);
      } else {
        ruleOne = (x < y);
        ruleTwo = (x > y);
      }
      const result = ruleOne ? -1 : (ruleTwo ? 1 : 0);

      return (result);
    });
  }

  isSubtable(MainTable, SubTable) {
    const mainTable = MainTable.sort().join(',');
    const subtable = SubTable.sort().join(',');
    let returnValue;
    if (mainTable.includes(subtable)) {
      returnValue = true;
    } else {
      returnValue = false;
    }
    return returnValue;
  }

  sortBySubkey(array, key, subkey) {
    return array.sort((a, b) => {
      const x = a[key][subkey];
      const y = b[key][subkey];
      const result = (x !== undefined && x > y) ? -1 : ((x === undefined || x < y) ? 1 : 0);

      return (result);
    });
  }


  validateTransaction(transaction, filter) {
    if (!filter || typeof filter !== 'object') {
      return true;
    }

    if (filter.signature && transaction.signature !== filter.signature) {
      return false;
    }

    if (filter.signatureHash && transaction.signatureHash !== filter.signatureHash) {
      return false;
    }

    if (filter.type && transaction.type !== filter.type) {
      return false;
    }

    if (filter.hasAttachment && !transaction.attachment) {
      return false;
    }

    if (filter.senderRS && transaction.senderRS !== filter.senderRS) {
      return false;
    }

    if (filter.recipientRS && transaction.recipientRS !== filter.recipientRS) {
      return false;
    }

    if (filter.sender && transaction.sender !== filter.sender) {
      return false;
    }

    if (filter.recipient && transaction.recipient !== filter.recipient) {
      return false;
    }

    if (filter.block && transaction.block !== filter.block) {
      return false;
    }

    if (filter.blockTimestamp && transaction.blockTimestamp !== filter.blockTimestamp) {
      return false;
    }

    if (filter.timestamp && transaction.timestamp !== filter.timestamp) {
      return false;
    }

    if (filter.timestampHigherThan && transaction.timestamp < filter.timestampHigherThan) {
      return false;
    }

    if (filter.timestampLowerThan && transaction.timestamp > filter.timestampLowerThan) {
      return false;
    }

    if (filter.heightHigherThan && transaction.height < filter.heightHigherThan) {
      return false;
    }

    if (filter.heightLowerThan && transaction.height > filter.heightLowerThan) {
      return false;
    }

    if (filter.confirmationsHigherThan
      && transaction.confirmations < filter.confirmationsHigherThan) {
      return false;
    }

    if (filter.confirmationsLowerThan
      && transaction.confirmations > filter.confirmationsLowerThan) {
      return false;
    }

    if (filter.transaction && transaction.transaction !== filter.transaction) {
      return false;
    }

    return true;
  }

  async decryptMessage(transactionId, passphrase) {
    let response;
    try {
      const apiCall = `${this.jupiter_data.server}/nxt?requestType=readMessage&transaction=${transactionId}&secretPhrase=${passphrase}`;
      const call = await axios.get(apiCall);
      response = call.data;
    } catch (e) {
      response = { error: true, fullError: e };
    }

    return response;
  }


  /**
   *
   * @param {object} accountCredentials
   * @returns {Promise<unknown>}
   */
  loadAccountData(accountCredentials ) { // -> getREcords
    logger.verbose('#####################################################################################')
    logger.verbose(`                       loadAccountData(accountCredentials = ${!!accountCredentials})`)
    logger.verbose('#####################################################################################')
    logger.sensitive(`accountCredentials = ${JSON.stringify(accountCredentials)}`);

    return new Promise((resolve, reject) => {

      logger.debug(`loadAccountData(accountCredentials=${!!accountCredentials}).getRecords(ownerAddress=${accountCredentials.address}, transactionSender=${accountCredentials.address}, passphrase)`);
      this.getRecords(
          accountCredentials.address,
          accountCredentials.address,
          accountCredentials.passphrase,
          { size: 'all', show_pending: null, show_unconfirmed: false },
          accountCredentials.password )
          .then((recordsContainer) => { //{records,last_record,pending}
            logger.debug('---------------------------------------------------------------------------------------')
            logger.debug(`-- loadAccountData(containedDatabase=${!!accountCredentials}).getRecords(ownerAddress=${accountCredentials.address}, transactionSender=${accountCredentials.address}).THEN(recordsContainer)`);
            logger.debug('---------------------------------------------------------------------------------------')

            const allRecords = recordsContainer.records;
            if (Array.isArray(allRecords) && !allRecords.length ){
              logger.warn(`-- the records array is empty`)
              return resolve({tables: [], userRecord: null})
            }

            const currentUsersTable = this.getCurrentTable(allRecords, 'users');
            const currentChannelsTable = this.getCurrentTable(allRecords, 'channels')
            const currentInvitesTable = this.getCurrentTable(allRecords, 'invites')
            const currentStorageTable = this.getCurrentTable(allRecords, 'storage')

            const currentTables = [
              currentUsersTable,
              currentChannelsTable,
              currentInvitesTable,
              currentStorageTable
            ]

            const currentUserRecord = this.getUserRecord(allRecords);
            logger.sensitive(`-- currentTables= ${JSON.stringify(currentTables)}`);
            logger.sensitive(`-- Count of allRecords = ${allRecords.length}`);
            logger.sensitive(`-- currentUserRecord= ${ JSON.stringify(currentUserRecord)}`)
            logger.sensitive(`-- currentUsersTable= ${ JSON.stringify(currentUsersTable)}`)
            logger.sensitive(`-- currentChannelsTable= ${ JSON.stringify(currentChannelsTable)}`)
            logger.sensitive(`-- currentInvitesTable= ${ JSON.stringify(currentInvitesTable)}`)
            logger.sensitive(`-- currentStorageTable= ${ JSON.stringify(currentStorageTable)}`)

            const payload = {
              tables: currentTables,
              userRecord: currentUserRecord
            }

            logger.sensitive(`payload= ${JSON.stringify(payload)}`);

            return resolve(payload)
          })
          .catch((error) => {
            logger.error('Theres an error!');
            logger.error(error);
            reject('There was an error loading records');
          });
    });
  }


















  /**
   *
   * @param {object | false} containedDatabase
   * @returns {Promise<{numberOfRecords,success,app,hasUserTable,userRecord,message} | {numberOfRecords,success,app: {tables,appData,address},message,tables,hasUserTable,userRecord}>} -
   */
  loadUserAndAppData(containedDatabase = false) { // -> getREcords
    logger.verbose('#####################################################################################')
    logger.verbose(`                       loadUserAndAppData(containedDatabase = ${!!containedDatabase})`)
    logger.verbose('#####################################################################################')

    if(!!containedDatabase) {
      logger.sensitive(`containedDatabase = ${JSON.stringify(containedDatabase)}`);
    }

    const eventEmitter = new events.EventEmitter();
    const self = this;
    const appname = process.env.APPNAME;
    let server = process.env.JUPITERSERVER;
    let passphrase = process.env.APP_ACCOUNT;
    let account = process.env.APP_ACCOUNT_ADDRESS;

    let allRecords = [];
    let numberOfRecords;
    let { password: ownerPassword } = self;
    let userRecord;
    let hasUserTable = false;

    if (containedDatabase) {
      // logger.sensitive(`containedDatabase = ${JSON.stringify(containedDatabase)}`);
      server = process.env.JUPITERSERVER;
      ({ account } = containedDatabase);
      ({ passphrase } = containedDatabase);
      ownerPassword = containedDatabase.encryptionPassword;
    }

    return new Promise((resolve, reject) => {
      let responseMessage;
      const ownerAddress = account;
      const accountPropertiesHolder = account;
      const accountPropertiesHolderPassphrase = passphrase;

      logger.debug(`loadUserAndAppData(containedDatabase=${!!containedDatabase}).getRecords(ownerAddress=${ownerAddress}, transactionSender=${accountPropertiesHolder}, passphrase)`);
      self.getRecords(
          ownerAddress,
          accountPropertiesHolder,
          accountPropertiesHolderPassphrase,
          { size: 'all', show_pending: null, show_unconfirmed: false },
          ownerPassword )
        .then((response) => {
          allRecords = response.records;
          if (Array.isArray(allRecords) && !allRecords.length ){
              logger.warn(`-- the records array is empty`)
          }


          const currentUsersTable = this.getCurrentTable(allRecords, 'users');
          const currentChannelsTable = this.getCurrentTable(allRecords, 'channels')
          const currentInvitesTable = this.getCurrentTable(allRecords, 'invites')
          const currentStorageTable = this.getCurrentTable(allRecords, 'storage')

          const currentTables = [
            currentUsersTable,
            currentChannelsTable,
            currentInvitesTable,
            currentStorageTable
          ]

          // const currentUserRecord = this.getCurrentTable(allRecords, 'user_record');
          const currentUserRecord = this.getUserRecord(allRecords);

          logger.sensitive(`-- Count of allRecords = ${allRecords.length}`);
          logger.sensitive(`-- currentUserRecord= ${ JSON.stringify(currentUserRecord)}`)
          logger.sensitive(`-- currentUsersTable= ${ JSON.stringify(currentUsersTable)}`)
          logger.sensitive(`-- currentChannelsTable= ${ JSON.stringify(currentChannelsTable)}`)
          logger.sensitive(`-- currentInvitesTable= ${ JSON.stringify(currentInvitesTable)}`)
          logger.sensitive(`-- currentStorageTable= ${ JSON.stringify(currentStorageTable)}`)

          const payload = {
            app: {tables: []},
            tables: currentTables,
            userRecord: currentUserRecord
          }

          logger.sensitive(`payload= ${JSON.stringify(payload)}`);

          return resolve(payload);

          self.appSchema.tables = tableData;
          self.appSchema.appData.name = appname;
          self.appSchema.address = account;
          responseMessage = {
            numberOfRecords,
            success: true,
            app: self.appSchema,
            message: 'Existing record found',
            tables: currentList,
            hasUserTable,
            userRecord,
          };


          logger.sensitive(`1. responseMessage = ${JSON.stringify(responseMessage)}`)


          if (allRecords !== undefined && allRecords.length > 0) {
            logger.debug(` found some records!`)
            const tableList = [];
            const tablesRetrieved = {};
            for (let x = 0; x < Object.keys(allRecords).length; x += 1) {
              if (containedDatabase) {

                if (allRecords[x] && allRecords[x].user_record && !userRecord) {

                  userRecord = allRecords[x].user_record;
                }

                if (allRecords[x].users) {
                  hasUserTable = true;
                }
              }

              if (allRecords[x].tables && allRecords[x].date && allRecords[x].date) {
                tableList.push(allRecords[x]);
              } else {
                const objectKey = Object.keys(allRecords[x])[0];
                if (tablesRetrieved[objectKey] === undefined) {
                  tablesRetrieved[objectKey] = [];
                  tablesRetrieved[objectKey].push(allRecords[x]);
                } else {
                  tablesRetrieved[objectKey].push(allRecords[x]);
                }
              }
            }

            logger.sensitive(`-- Count tablesRetrieved = ${tablesRetrieved.length}`);
            logger.sensitive(` userRecord = ${userRecord}`);
            logger.sensitive(` tableList = = ${JSON.stringify(tableList)}`)
            logger.verbose(`  userAccount tablesRetrieved = ${JSON.stringify(tablesRetrieved)}`)

            // Once we have separated the records into table list and potentially table object list,
            // we then retrieve the last table record
            self.sortByDate(tableList);

            // This variable will represent the most recent and valid list of tables in the app
            let currentList = [];

            for (let y = 0; y < Object.keys(tableList).length; y += 1) {
              if (tableList[y].tables.length > currentList.length) {
                if (currentList.length === 0) {
                  currentList = tableList[y].tables;
                } else if (self.isSubtable(currentList, tableList[y].tables)) {
                  currentList = tableList[y].tables;
                }
              }
            }

            logger.verbose(` currentList count: ${currentList.length}`);

            // Now that we have a list with all the table records and the list of tables
            // that the app should be using. We go through the tablesRetrieved and get the
            // latest records of each table that the app is supposed to be using.
            const tableData = [];

            for (let i = 0; i < Object.keys(currentList).length; i += 1) {
              const thisKey = currentList[i];
              if (tablesRetrieved[thisKey]) {
                // We need to sort the the list we are about to call
                const tablesRetrievedAndSorted = _.sortBy(tablesRetrieved[thisKey], [`${thisKey}.date`, `${thisKey}.address`]);

                // Once we do this, we can obtain the last record and push to the tableData variable
                // NOTE: We'll expand validation of tables in future releases
                tableData.push(tablesRetrievedAndSorted[0]);
              }
            }

            logger.sensitive(`tableData = ${JSON.stringify(tableData)}`);

            self.appSchema.tables = tableData;
            self.appSchema.appData.name = appname;
            self.appSchema.address = account;
            responseMessage = {
              numberOfRecords,
              success: true,
              app: self.appSchema,
              message: 'Existing record found',
              tables: currentList,
              hasUserTable,
              userRecord,
            };


            logger.sensitive(`1. responseMessage = ${JSON.stringify(responseMessage)}`)
            resolve(responseMessage);
          } else {
            logger.debug(`NO RECORDS FOUND!`);
            responseMessage = {
              numberOfRecords,
              success: true,
              app: self.appSchema,
              hasUserTable,
              userRecord,
              message: 'No app record',
            };
            logger.sensitive(`responseMessage.numberOfRecords = ${JSON.stringify(responseMessage.numberOfRecords)}`)
            logger.sensitive(`responseMessage.success = ${JSON.stringify(responseMessage.success)}`)
            logger.sensitive(`responseMessage.app = ${JSON.stringify(responseMessage.app)}`)
            logger.sensitive(`responseMessage.hasUserTable = ${JSON.stringify(responseMessage.hasUserTable)}`)
            logger.sensitive(`responseMessage.userRecord = ${JSON.stringify(responseMessage.userRecord)}`)
            logger.sensitive(`responseMessage.message = ${JSON.stringify(responseMessage.message)}`)

            resolve(responseMessage);
          }

        })
        .catch((error) => {
          logger.error('Theres an error!');
          logger.error(error);
          reject({ success: false, error: 'There was an error loading records' });
        });
    });
  }

  //{"id":"2376166064047524148","user_record":"{\"id\":\"2376166064047524148\",\"account\":\"JUP-KMRG-9PMP-87UD-3EXSF\",\"accounthash\":\"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW\",\"alias\":\"sprtz\",\"secret_key\":null,\"twofa_enabled\":false,\"twofa_completed\":false,\"api_key\":\"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO\",\"encryption_password\":\"sprtz\"}","date":1625269463920,"confirmed":true}
  getCurrentTable(tables, tableName){
    const allSpecificTables = tables.filter( table => (table[tableName]) ?  true : false); // {"users":{"address":"JUP-DD4P-62WU-M9AE-74LDD","passphrase":"st"},"confirmed":true}
    let currentTable = null
    if(allSpecificTables.length > 0){
      currentTable = allSpecificTables[0]
      return {
        'name': tableName,
        'address': currentTable[tableName].address,
        'passphrase': currentTable[tableName].passphrase,
        'confirmed': currentTable.confirmed
      }
    }

    return {
      'name': tableName,
      'address': null,
      'passphrase': null,
      'confirmed': null
    }
  }

  // convertAttachTableResponseToProperTableContainer(attachTableResponse){
  //   return {
  //     'name':
  //   }
  //
  // }


  //"user_record":{"id":"16197549842640237948","account":"JUP-69A8-6EHC-JCJ9-6NARY","accounthash":"$2a$08$AUrbDXw.MKuZFTG3FIf8zejjWdELWmChA6USnM6WkW/iuWY3kKHiS","alias":"Port Rowenahaven","secret_key":null,"twofa_enabled":false,"twofa_complet

  // [{"id":"16197549842640237948","user_record":{"id":"16197549842640237948","account":"JUP-69A8-6EHC-JCJ9-6NARY","accounthash":"$2a$08$AUrbDXw.MKuZFTG3FIf8zejjWdELWmChA6USnM6WkW/iuWY3kKHiS","alias":"Port Rowenahaven","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"$2a$08$95NpQwE25wO0yGCSqj1WquultThC41snMXZ5kjCCTJE0LI9TCl1ie","encryption_password":"stackit"},"date":1628864236775,"confirmed":true}]

  getUserRecord(tables){
    const allSpecificTables = tables.filter( table => (table.user_record) ?  true : false);

    if(allSpecificTables.length == 0){
      return null;
    }

    let userRecord = null;
    if(allSpecificTables[0].user_record){
      userRecord = allSpecificTables[0].user_record;
    }
    logger.debug(JSON.stringify(userRecord));

    return userRecord;
  }


//   const allSpecificTables = tables.filter( table => (table[tableName]) ?  true : false); // {"users":{"address":"JUP-DD4P-62WU-M9AE-74LDD","passphrase":"st"},"confirmed":true}
//
//   let arrayOfTables = []
//
//   const x = allSpecificTables.map( table => {
//
//     return {
//       'name': tableName,
//       'address':
//     }
//   } )
//
//   if(allSpecificTables.length > 0){
//
//
//
//
//   return allSpecificTables[0]
// }
//
// return null



  getMessages(address, passphrase) {
    const eventEmitter = new events.EventEmitter();
    const self = this;

    return new Promise((resolve, reject) => {
      const records = [];
      const decryptedRecords = [];
      const decryptedPendings = [];
      // const pendingRecords = [];
      let recordsFound = 0;
      let responseData;
      let database = [];
      let completedNumber = 0;
      // let pendingNumber = 0;
      // let show_pending = scope.show_pending;

      eventEmitter.on('set_responseData', () => {
        responseData = {
          recordsFound,
          pending: decryptedPendings,
          records: decryptedRecords,
          last_record: decryptedRecords[0],
        };

        resolve(responseData);
      });

      eventEmitter.on('check_on_pending', async () => {
        eventEmitter.emit('set_responseData');
      });

      eventEmitter.on('records_retrieved', () => {
        if (records.length <= 0) {
          eventEmitter.emit('check_on_pending');
        } else {
          let recordCounter = 0;
          Object.keys(records).forEach((p) => {
            const transactionId = records[p];
            const thisUrl = `${self.jupiter_data.server}/nxt?requestType=readMessage&transaction=${transactionId}&secretPhrase=${passphrase}`;
            axios.get(thisUrl)
              .then((response) => {
                try {
                  // This decrypts the message from the blockchain using native encryption
                  // as well as the encryption based on encryption variable
                  if (response.data.decryptedMessage.includes('dataType')) {
                    decryptedRecords.push(JSON.parse(response.data.decryptedMessage));
                  }
                } catch (e) {
                  logger.error(e);
                  // Error here tend to be trying to decrypt a regular message from Jupiter
                  // rather than a gravity encrypted message
                }
                recordCounter += 1;
                if (recordCounter === completedNumber) {
                  eventEmitter.emit('check_on_pending');
                }
              })
              .catch((error) => {
                logger.error(error);
                reject(error);
              });
          });
        }
      });

      eventEmitter.on('database_retrieved', () => {
        for (let obj = 0; obj < Object.keys(database).length; obj += 1) {
          if (database[obj].attachment.encryptedMessage
            && database[obj].attachment.encryptedMessage.data != null
            && database[obj].recipientRS === address) {
            records.push(database[obj].transaction);
            completedNumber += 1;
            recordsFound += 1;
          }
        }
        eventEmitter.emit('records_retrieved');
      });

      axios.get(`${self.jupiter_data.server}/nxt?requestType=getBlockchainTransactions&account=${address}&withMessage=true&type=1`)
        .then((response) => {
          database = response.data.transactions;
          eventEmitter.emit('database_retrieved');
        })
        .catch((error) => {
          logger.error(error);
          resolve({ success: false, errors: error });
        });
    });
  }






  /**
   *
   * @param {string} ownerAddress - Retrieve transactions from this address
   * @param {array} transactionSender -
   * @param {string} transactionSenderPassphrase
   * @param {size, show_pending, show_unconfirmed, recipientOnly} scope - Filter the Properties
   * @param {string} ownerPassword - the owner account decryption address
   * @returns {Promise<{records,last_record,pending}>}
   */
  getRecords(
      ownerAddress,
      transactionSender,
      transactionSenderPassphrase,
      scope = {size: 'all', show_pending: null, show_unconfirmed: false, recipientOnly: false},
      ownerPassword = this.password)
  {
    logger.verbose('############################################################################################################################')
    logger.verbose(`                       getRecords(ownerAddress= ${ownerAddress}, transactionSender= ${transactionSender}, transactionSenderPassphrase, scope, ownerPass)`)
    logger.verbose('############################################################################################################################')

    logger.debug(`ownerAddress = ${ownerAddress}`);
    logger.debug(`transactionSender = ${transactionSender}`);

    const reportSection = `Information used for retrieving Account Properties for - ${ownerAddress}`
    gravityCLIReporter.addItem('Owner Account Address', ownerAddress, reportSection )
    gravityCLIReporter.addItem('Account Properties Holder', transactionSender,reportSection )

    const eventEmitter = new events.EventEmitter();
    const self = this;

    return new Promise((resolve, reject) => {
      const records = [];
      const decryptedRecords = [];
      const decryptedPendings = [];
      const pendingRecords = [];
      let recordsFound = 0;
      let responseData = {};
      let database = [];
      let completedNumber = 0;
      let pendingNumber = 0;
      // let show_pending = scope.show_pending;

      eventEmitter.on('set_responseData', () => {
        logger.debug('getRecords().on(set_responseData');
        if (scope.size !== 'last') {
          if (scope.show_pending !== undefined && scope.show_pending > 0) {
            responseData = {
              records: decryptedRecords,
              last_record: decryptedRecords[0],
              pending: decryptedPendings
            };
          } else {
            responseData = {
              records: decryptedRecords,
              last_record: decryptedRecords[0],
              pending: null
            };
          }
        } else if (scope.size === 'last') {
          responseData = {
            records: decryptedRecords[0],
            last_record: decryptedRecords[0],
            pending: null
          };
        } else {
          responseData = {
            records: null,
            last_record: null,
            pending: null,
            error: 'Invalid scope size'
          };
        }
        // logger.debug('getRecords().return()')
        // logger.sensitive(JSON.stringify(responseData));
        gravityCLIReporter.addItemsInJson('Records', responseData.records, reportSection);
        return resolve(responseData);
      });

      eventEmitter.on('check_on_pending', async () => {
        logger.debug('getRecords().on(check_on_pending)')
        if (scope.show_unconfirmed) {
          const filter = {};
          if (!scope.shared_table) {
            filter.account = transactionSender;
          }

          try {
            const unconfirmedObjects = await self.getUnconfirmedData(
              ownerAddress,
              transactionSenderPassphrase,
              filter,
              scope.accessData,
            );

            logger.verbose(`unconfirmed Data Count: ${unconfirmedObjects.length}`);

            for (let x = 0; x < unconfirmedObjects.length; x += 1) {
              const thisUnconfirmedRecord = unconfirmedObjects[x];

              if (thisUnconfirmedRecord.data) {
                decryptedRecords.push(thisUnconfirmedRecord.data);
              }
            }
            eventEmitter.emit('set_responseData');
          } catch (e) {
            logger.error(e);
            eventEmitter.emit('set_responseData');
          }
        } else if (Object.keys(pendingRecords).length > 0) {
          let recordCounter = 0;

          logger.verbose(`pendingRecords count: ${pendingRecords.length}`);

          pendingRecords.forEach((p) => {
            const thisUrl = `${self.jupiter_data.server}/nxt?requestType=readMessage&transaction=${p}&secretPhrase=${transactionSenderPassphrase}`;

            axios.get(thisUrl)
              .then((response) => {
                try {
                  //@TODO this needs to get fixed!  readMessage can also return data.message or both
                  const decriptedPending = JSON.parse(response.data.decryptedMessage);
                  decryptedPendings.push(decriptedPending);
                  logger.debug(`decryptedPendings count: ${decriptedPending.length}`);
                } catch (e) {
                  logger.error(JSON.stringify(e));
                }

                recordCounter += 1;

                if (recordCounter === pendingNumber) {
                  eventEmitter.emit('set_responseData');
                }
              })
              .catch((error) => {
                logger.error('ERROR!!!')
                logger.error(error);
                return reject({ success: false, errors: error });
              });
          });
        } else {
          eventEmitter.emit('set_responseData');
        }
      });

      eventEmitter.on('records_retrieved', () => {

        logger.debug(`getRecords().on(records_retrieved)`);
        logger.debug('  Calling readMessage for each MessageTransaction received from the Table Account')
        logger.debug(`Message Transaction count: ${records.length}`);

        if (records.length <= 0) {
          eventEmitter.emit('check_on_pending');
        } else {
          const recordsTotalCount = records.length;
          let messageResponses = [];
          for ( let index = 0; index < recordsTotalCount; index++ ){
            const transactionId = records[index];
            const thisUrl = `${self.jupiter_data.server}/nxt?requestType=readMessage&transaction=${transactionId}&secretPhrase=${transactionSenderPassphrase}`;
            // logger.sensitive(`calling endpoint: ${thisUrl}`);
            const messageResponse = new Promise((resolve, reject) => {
              axios.get(thisUrl)
                  .then((response) => {
                    // logger.verbose(`axios.get.then()`);

                    let copyOfData = _.clone(response.data);
                    copyOfData.decryptedMessage = 'REMOVED'
                    copyOfData.decryptedMessageLength = copyOfData.decryptedMessage.length;
                    // logger.debug(`readMessage.response.data = ${JSON.stringify(copyOfData)}`);

                    if(response.data.errorCode){
                      logger.error('readMessage call returned a 200 error!');
                      logger.error(JSON.stringify(response.data));
                      // return reject(response.data);
                      return resolve({error: true, message: response.data});
                    }
                    const { decryptedMessage } = response.data;
                    return resolve(decryptedMessage);

                  })
                  .catch((error) => {
                    logger.error('readMessage call return a non-200');
                    logger.error(JSON.stringify(error));
                    return resolve({error: true, message: error});
                  });
            })
            messageResponses.push(messageResponse);
          };


          Promise.all(messageResponses)
              .then(results => {
                logger.debug(`promise.all()`);
                logger.debug(`total results from readMessage(): ${results.length}`);

                let recordPassword = (scope.accessData) ? scope.accessData.encryptionPassword: ownerPassword;


                let totalSuccessfulMessageRequests = 0
                let totalUnsuccessfulMessageRequests = 0
                const messages = results.reduce((reduced, result) => {
                  if (result.error) {
                    logger.warn('FAILED TO READ_MESSAGE');
                    totalUnsuccessfulMessageRequests++;
                    return reduced
                  }
                  // logger.sensitive(`MESSAGE SUCCESSFULLY RETRIEVED: ${JSON.stringify(result)}`);
                  totalSuccessfulMessageRequests++
                  reduced.push(result)
                  return reduced;
                }, [])

                logger.debug(`Total messages that were successfully retrieved from Jupiter: ${messages.length}`);
                logger.debug(`Next step is to use the password to decrypt the messages`);
                logger.sensitive(`recordPassword = ${recordPassword}`);

                const decryptedMessages = [];
                let notAbleToDecrypt = 0;
                for(let index = 0; index < messages.length; index++){
                  try {
                    const decryptedMessage = self.decrypt(messages[index], recordPassword);
                    let decryptedAndParsedMessage = JSON.parse(decryptedMessage);

                    if(decryptedAndParsedMessage.user_record){

                      let parsedUserRecord = decryptedAndParsedMessage.user_record;

                      if (typeof parsedUserRecord === 'string'){
                        parsedUserRecord = JSON.parse(decryptedAndParsedMessage.user_record);
                      }

                      decryptedAndParsedMessage.user_record = parsedUserRecord;
                    }

                    decryptedAndParsedMessage.confirmed = true;
                    logger.sensitive(`decryptedAndParsedMessage= ${JSON.stringify(decryptedAndParsedMessage)}`)
                    decryptedMessages.push(decryptedAndParsedMessage);
                  } catch ( error ) {
                    notAbleToDecrypt++;
                    logger.error('Not Able to Decrypt: ' + JSON.stringify(error));
                  }
                }

                logger.debug(`Total messages decrypted with password: ${decryptedMessages.length}`);
                logger.debug(`Total messages NOT decrypted: ${notAbleToDecrypt}`);

                // The fact that array.push(item1, item2, ..., itemN) accepts multiple items to push, you can push an
                // entire array using the spread operator applied to arguments

                if (Array.isArray(decryptedMessages) && decryptedMessages.length > 0){
                  decryptedRecords.push(...decryptedMessages);
                }

                gravityCLIReporter.addItemsInJson('Jupiter GetMessages', {
                  'Total requests': messageResponses.length,
                  'Total successful requests': totalSuccessfulMessageRequests,
                  'Total failed requests': totalUnsuccessfulMessageRequests,
                  'Total decrypted Message Transactions': decryptedMessages.length,
                  'Total messages not able to be decrypted': notAbleToDecrypt
                }, reportSection);

                eventEmitter.emit('check_on_pending');
              })


          // promise.allSettled() available as of node 12.9.0.
          // Promise.allSettled(messages)
          //     .then(results => {
          //       const fulfilled = results.reduce((reduced,result) =>{
          //           if(result.fulfilled){
          //             reduced.push(result.value);
          //           }
          //       }, [])
          //
          //       const rejected =  results.reduce((reduced,result) =>{
          //         if(result.rejected){
          //           reduced.push(result.reason);
          //         }
          //       }, [])
          //
          //       decryptedRecords.push(fulfilled);
          //       eventEmitter.emit('check_on_pending');
          //     })

        }
      });

      eventEmitter.on('database_retrieved', () => {
        logger.debug('Parsing all the transactions')
        logger.debug(`transactionSender= ${transactionSender} `);

        for (let arrayIndex = 0; arrayIndex < Object.keys(database).length; arrayIndex += 1) {
          let completion = false;

          // console.log(database[arrayIndex])
          // console.log('start--------------------------');
          // logger.debug(`scope= ${JSON.stringify(scope)}`);
          // let copyOfTransaction = _.clone(database[obj]);
          // copyOfTransaction.signature = 'REMOVED';
          // copyOfTransaction.attachment.encryptedMessage.data_length = copyOfTransaction.attachment.encryptedMessage.data.length;
          // copyOfTransaction.attachment.encryptedMessage.data = 'REMOVED';
          // copyOfTransaction.attachment.encryptedMessage.nonce = 'REMOVED';
          // logger.debug(` Transaction content: ${JSON.stringify(database[obj])}`);
          //


          // logger.debug(`Transaction : ${JSON.stringify(database[obj])}`);
          // logger.debug(`Transaction  senderRS = ${database[obj].senderRS} recipientRS = ${database[obj].recipientRS} transaction = ${database[obj].transaction}`);

          if (database[arrayIndex].attachment.encryptedMessage && database[arrayIndex].attachment.encryptedMessage.data)
          {
            // console.log(1)

            // gravityCLIReporter.addItemsInJson('Transaction Info', {
            //   'senderRS': database[obj].senderRS,
            //   'recipientRS': database[obj].recipientRS
            // } ,  reportSection );

            if( database[arrayIndex].senderRS === transactionSender ){
              // console.log(2)
              // logger.debug(`Transaction payload: ${database[obj].transaction}`)
              if (scope.show_pending !== undefined && scope.show_pending > 0) {
                // console.log(3)
                if (database[arrayIndex].confirmations <= scope.show_pending) {
                  // console.log(4)
                  pendingRecords.push(arrayIndex.transaction);
                  pendingNumber += 1;
                } else {
                  // console.log(5)
                  // logger.debug(` ${arrayIndex} : Correct SenderRs  `)
                  records.push(database[arrayIndex].transaction);
                  completedNumber += 1;
                }
              } else if (scope.size === 'all') {
                // console.log(6)
                // logger.debug(` ${arrayIndex} : Correct SenderRs  `)
                records.push(database[arrayIndex].transaction);
                completedNumber += 1;
              } else if (scope.size === 'last') {
                // console.log(7)
                // logger.debug(` ${arrayIndex} : Correct SenderRs  `)
                records.push(database[arrayIndex].transaction);
                recordsFound += 1;
                completedNumber += 1;
                completion = true;
              }
              // console.log(8)
              recordsFound += 1;
            } else {
              // console.log(9)
              logger.warn(`${arrayIndex} : Wrong SenderRs: ${database[arrayIndex].senderRS}. Needs to be by the transactionSender ${transactionSender}`)
              gravityCLIReporter.addItem(
                  `Transaction Info for `,
                  ` # Wrong SenderRs: ${database[arrayIndex].senderRS}. Needs to be by the transactionSender ${transactionSender}`,
                  reportSection );
            }
            // console.log(10)
          } else {
            // console.log(11)
            logger.debug(`${arrayIndex} : Not a MessageTransaction: ${database[arrayIndex].transaction}`)
          }
          if (completion) {
            // console.log(12)
            logger.verbose(`records = ${JSON.stringify(records)}`);
            break;
          }
          // console.log(13)

          // console.log('*--------------------------end')
        }

        logger.debug(` Total Valid Records Found: ${records.length}`)
        logger.debug(` Total pending records: ${pendingRecords}`);
        eventEmitter.emit('records_retrieved');
      });

      const port = process.env.JUPITER_PORT ? `:${process.env.JUPITER_PORT}` : '';

      const includeExpiredPrunable = 'includeExpiredPrunable=true'; // This is done because metis was sending prunable user_record messages which cause the user to not be able to log in.
      const url = `${self.jupiter_data.server}${port}/nxt?requestType=getBlockchainTransactions&account=${ownerAddress}&withMessage=true&type=1&${includeExpiredPrunable}`;
      // logger.verbose(url);
      logger.debug(`getRecords().axios.get(url)`);
      logger.sensitive(`url=${url}`);
      axios.get(url)
        .then((response) => {
          logger.debug('---------------------------------------------------------------------------------------')
          logger.debug(`--  getRecords().axiosGet(url).then(response)`)
          logger.debug('---------------------------------------------------------------------------------------')
          database = response.data.transactions;
          logger.info(`-- Total transactions: ${database.length}`);

          // gravityCLIReporter.addItem('Total Transactions To Process', database.length, reportSection)
          eventEmitter.emit('database_retrieved');
        })
        .catch((error) => {
          logger.error('Error getting transactions');
          logger.error(error);
          return resolve({ success: false, errors: error });
        });
    });
  }

  getAppRecords(appAddress, appPassphrase) {
    logger.verbose(`getAppRecords()`)
    const eventEmitter = new events.EventEmitter();
    const self = this;

    return new Promise((resolve, reject) => {
      const records = [];
      const decryptedRecords = [];
      let recordsFound = 0;
      let responseData;
      let database = [];
      let completedNumber = 0;

      eventEmitter.on('set_responseData', () => {
        responseData = {
          recordsFound,
          records: decryptedRecords,
          last_record: decryptedRecords[0],
        };

        resolve(responseData);
      });

      eventEmitter.on('records_retrieved', () => {
        if (records.length <= 0) {
          eventEmitter.emit('set_responseData');
        } else {
          let recordCounter = 0;
          records.forEach((p) => {
            const thisUrl = `${self.jupiter_data.server}/nxt?requestType=readMessage&transaction=${p}&secretPhrase=${appPassphrase}`;
            axios.get(thisUrl)
              .then((response) => {
                try {
                  //  This decrypts the message from the blockchain using native encryption
                  // as well as the encryption based on encryption variable
                  const decrypted = JSON.parse(self.decrypt(response.data.decryptedMessage));
                  decryptedRecords.push(decrypted);
                  // console.log(decryptedRecords);
                } catch (e) {
                  logger.error(e);
                }
                recordCounter += 1;

                if (recordCounter === completedNumber) {
                  eventEmitter.emit('set_responseData');
                }
              })
              .catch((error) => {
                logger.error(error);
                reject({ success: false, error: error.response });
              });
          });
        }
      });

      eventEmitter.on('database_retrieved', () => {
        for (let obj = 0; obj < Object.keys(database).length; obj += 1) {
          if (database[obj].attachment && database[obj].attachment.encryptedMessages) {
            records.push(database[obj].transaction);
            completedNumber += 1;
            recordsFound += 1;
          }
        }
        eventEmitter.emit('records_retrieved');
      });

      axios.get(`${self.jupiter_data.server}/nxt?requestType=getBlockchainTransactions&account=${appAddress}&withMessage=true&type=1`)
        .then((response) => {
          database = response.data.transactions;
          eventEmitter.emit('database_retrieved');
        })
        .catch((error) => {
          logger.error(error);
          resolve({ success: false, errors: error });
        });
    });
  }


  getAllRecords(table, scope = { size: 'all', show_pending: null }) {
    logger.verbose(`getAllRecords()`);
    const eventEmitter = new events.EventEmitter();
    const self = this;

    return new Promise((resolve, reject) => {
      const records = [];
      const recordsDetails = {};
      const decryptedRecords = [];
      const decryptedPendings = [];
      const pendingRecords = [];
      let recordsFound = 0;
      let responseData;
      let database;
      let recordTable;
      let tableData;
      // let { show_pending } = scope;
      let completedNumber = 0;
      let pendingNumber = 0;

      eventEmitter.on('set_responseData', () => {
        if (scope.size !== 'last') {
          if (scope.show_pending !== undefined && scope.show_pending > 0) {
            responseData = {
              recordsFound,
              pending: decryptedPendings,
              records: decryptedRecords,
              last_record: decryptedRecords[0],
            };
          } else {
            responseData = {
              recordsFound,
              records: decryptedRecords,
              last_record: decryptedRecords[0],
            };
          }
        } else if (scope.size === 'last') {
          responseData = { record: decryptedRecords[0] };
        } else {
          responseData = { records: null, error: 'Invalid scope size' };
        }
        resolve(responseData);
      });

      eventEmitter.on('check_on_pending', () => {
        if (Object.keys(pendingRecords).length > 0) {
          let recordCounter = 0;

          pendingRecords.forEach((p) => {
            const thisUrl = `${self.jupiter_data.server}/nxt?requestType=readMessage&transaction=${p}&secretPhrase=${recordTable.passphrase}`;
            axios.get(thisUrl)
              .then((response) => {
                try {
                  const decriptedPending = JSON.parse(response.data.decryptedMessage);
                  decriptedPending.confirmed = true;
                  decryptedPendings.push(decriptedPending);
                } catch (e) {
                  logger.error(e);
                }
                recordCounter += 1;

                if (recordCounter === pendingNumber) {
                  eventEmitter.emit('set_responseData');
                }
              })
              .catch((error) => {
                reject(error);
              });
          });
        } else {
          eventEmitter.emit('set_responseData');
        }
      });

      eventEmitter.on('records_retrieved', () => {
        if (Object.keys(records).length <= 0) {
          eventEmitter.emit('check_on_pending');
        } else {
          let recordCounter = 0;
          records.forEach((p) => {
            const thisUrl = `${self.jupiter_data.server}/nxt?requestType=readMessage&transaction=${p}&secretPhrase=${recordTable.passphrase}`;
            axios.get(thisUrl)
              .then((response) => {
                try {
                  // This decrypts the message from the blockchain using native encryption
                  // as well as the encryption based on encryption variable
                  const decrypted = JSON.parse(self.decrypt(response.data.decryptedMessage));
                  decrypted.confirmed = true;

                  if (table !== 'users') {
                    decrypted.user = recordsDetails[p] ? recordsDetails[p].user : null;
                  }

                  decrypted.public_key = recordsDetails[p]
                    ? recordsDetails[p].recipientPublicKey : null;

                  decryptedRecords.push(decrypted);
                } catch (e) {
                  logger.error(e);
                }
                recordCounter += 1;

                if (recordCounter === completedNumber) {
                  eventEmitter.emit('check_on_pending');
                }
              })
              .catch((error) => {
                logger.error(error);
                reject(error);
              });
          });
        }
      });

      eventEmitter.on('table_retrieved', () => {
        for (let position = 0; position < Object.keys(tableData).length; position += 1) {
          const obj = tableData[position];
          let completion = false;
          if (obj.attachment.encryptedMessage.data && obj.recipientRS !== recordTable.address) {
            if (scope.show_pending && scope.show_pending > 0) {
              if (obj.confirmations <= scope.show_pending) {
                pendingRecords.push(obj.transaction);
                pendingNumber += 1;
              } else {
                records.push(obj.transaction);
                completedNumber += 1;
              }
            } else if (scope.size === 'all') {
              records.push(obj.transaction);
              completedNumber += 1;
            } else if (scope.size === 'last') {
              records.push(obj.transaction);
              recordsFound += 1;
              completedNumber += 1;
              completion = true;
            }

            recordsDetails[obj.transaction] = {
              recipientPublicKey: obj.attachment.recipientPublicKey,
              user: obj.recipientRS === recordTable.address ? obj.senderRS : obj.recipientRS,
              userId: obj.recipientRS === recordTable.address ? obj.sender : obj.recipient,

            };
            recordsFound += 1;
          }
          if (completion) {
            break;
          }
        }
        eventEmitter.emit('records_retrieved');
      });

      eventEmitter.on('table_access_retrieved', () => {
        axios.get(`${self.jupiter_data.server}/nxt?requestType=getBlockchainTransactions&account=${recordTable.address}&withMessage=true&type=1`)
          .then((response) => {
            tableData = response.data.transactions;
            eventEmitter.emit('table_retrieved');
          })
          .catch((error) => {
            logger.error(error);
            reject({ success: false, errors: error });
          });
      });

      logger.debug('-- ---- -- --- -- --- $$$$$ -- ---- -- --- -- --- 4')
      self.loadUserAndAppData(scope.containedDatabase)
        .then((res) => {
          database = res.app.tables;
          Object.keys(database).forEach((x) => {
            if (database[x][table]) {
              recordTable = database[x][table];
            }
          });
          eventEmitter.emit('table_access_retrieved');
        })
        .catch((err) => {
          logger.error(err);
          reject('There was an error');
        });
    });
  }


  /**
   *
   * @param {string} account
   * @param {string} passphrase
   * @param {object} containedDatabase
   * @returns {Promise<{user:
   * {account, id, email, firstname, lastname, secret_key,twofa_enabled,twofa_completed,public_key,papi_key,admin,secret} |
   * {recordsFound, usernoUserTables, hasUserTables, userNeedsSave, userRecordFound, databaseFound, tables, tableList}}>} |
   * {noUserTables, applicationTablesFound, userNeedsSave, tables, applicationTables}
   */
  getUser(account, passphrase, containedDatabase = null) {
    logger.verbose('###############################################################################################')
    logger.verbose(`###############################################################################################\n`)
    logger.verbose(`##    getUser(account=${JSON.stringify(account)}, passphrase, containedDatabase=${!!containedDatabase})\n`);
    logger.verbose('###############################################################################################')
    logger.verbose('###############################################################################################')


    const self = this;
    return new Promise((resolve, reject) => {
      if (account === process.env.APP_ACCOUNT_ADDRESS) {
        logger.debug('Using the application account');
        const userObject = {
          account,
          id: process.env.APP_ACCOUNT_ID,
          email: process.env.APP_EMAIL,
          firstname: 'Admin',
          lastname: '',
          secret_key: null,
          twofa_enabled: false,
          twofa_completed: false,
          public_key: process.env.APP_PUBLIC_KEY,
          api_key: process.env.APP_API_KEY,
          admin: true,
          secret: process.env.APP_ACCOUNT,
        };
        return resolve({ user: JSON.stringify(userObject) });
      } else if (containedDatabase) {
        logger.sensitive(`containedDatabase=${JSON.stringify(containedDatabase)}`);
        //Get Application UsersTable Account ID


        // ------------------------------------------------------------------------------------------------------------------------------
        logger.verbose(` Lets start by getting the Application Records to find the Application Users Table.`)
        logger.verbose(` With the Application Users Table we can find the user credentials inorder to authenticate the user`);
        logger.verbose(`getUser().getRecords(from application)`)
        // ------------------------------------------------------------------------------------------------------------------------------
        this.getRecords(
            process.env.APP_ACCOUNT_ADDRESS,
            process.env.APP_ACCOUNT_ADDRESS,
            process.env.APP_ACCOUNT,
            {size: 'all', show_pending: null, show_unconfirmed: false, recipientOnly: false},
            process.env.ENCRYPT_PASSWORD
        )
            .then(applicationRecordsResponse => {
              logger.debug('---------------------------------------------------------------------------------------')
              logger.verbose(`getUser().getRecords(from application).THEN`)
              logger.debug('---------------------------------------------------------------------------------------')
              const allApplicationRecords = applicationRecordsResponse.records;
              const applicationUsersTable = this.getCurrentTable(allApplicationRecords, 'users');
              if(!applicationUsersTable){
                logger.warn(`1. No Application Users Table found!!!!!`)
              }

              const applicationUsersTableAddress = applicationUsersTable.address;
              // const applicationUsersTableAddress = applicationUsersTable.users.address;

              logger.debug(`-- Count of all application records: ${allApplicationRecords.length}`);
              logger.debug(`-- applicationUsersTableAddress= ${applicationUsersTableAddress}`);


              // ------------------------------------------------------------------------------------------------------------------------------
              logger.verbose(`So now we have the Application Users Table! Next we need to find the user in ApplicationUsersTable.`)
              logger.verbose(`getUser().getRecords(from application).then().getRecords(applicationUsersTable)`)
              // ------------------------------------------------------------------------------------------------------------------------------
              this.getRecords(
                  account,
                  applicationUsersTableAddress,
                  passphrase,
                  {size: 'all', show_pending: null, show_unconfirmed: false, recipientOnly: false},
                  process.env.ENCRYPT_PASSWORD
              )
                  .then( applicationAccountUsersTableRecordsResponse => {
                    logger.debug('---------------------------------------------------------------------------------------')
                    logger.verbose(`getUser().getRecords(from application).then().getRecords(applicationUsersTable).THEN(applicationUsersTableRecordsResponse)`)
                    logger.debug('---------------------------------------------------------------------------------------')
                      const userRecord = this.getUserRecord(applicationAccountUsersTableRecordsResponse.records);
                      logger.sensitive(`-- userRecord=${JSON.stringify(userRecord)}`);

                      if (userRecord){
                        logger.sensitive(`-- retreived user password = ${userRecord.encryption_password}, containedDatabasePassword = ${containedDatabase.encryptionPassword}`);
                        logger.sensitive(`-- retreived user password = ${userRecord['encryption_password']}, containedDatabasePassword = ${containedDatabase.encryptionPassword}`);
                      }


                      let  isUserRecordInCurrentAppAccoutUsersTable = true;
                      if(!userRecord){
                        isUserRecordInCurrentAppAccoutUsersTable = false;
                        logger.warn(`The user record doesnt exists in this Metis Account`);
                        logger.warn(`Another metis account may have created this account. So we will need to create an account for this metis account.`);
                        throw new Error('Implement new user creation functionality!');
                      }

                    logger.debug('---------------------------------------------------------------------------------------')
                    logger.verbose(`--   Compare the given password with the password in the usersTable`)
                    logger.debug('---------------------------------------------------------------------------------------')
                      if(!(userRecord.encryption_password == containedDatabase.encryptionPassword)){
                        logger.warn('Not valid password');
                        throw new Error(`The password is not valid. Need to return the proper reject()`);
                      }

                      // ------------------------------------------------------------------------------------------------------------------------------
                      logger.verbose(`The user ${account} has been authenticated`);
                      logger.verbose(`The next task is to get the user's tables. (ie channels, invites, storage, etc)`);
                      // ------------------------------------------------------------------------------------------------------------------------------
                      self.retrieveAccountTables(containedDatabase, applicationUsersTableAddress)
                          .then((userAccountTablesResponse) => {
                            logger.debug('---------------------------------------------------------------------------------------')
                            logger.debug(`-- getUser().retrieveUserFromPassphrase(containedDatabase = ${!!containedDatabase}).THEN(userFromPassphraseResponse)`);
                            logger.debug('---------------------------------------------------------------------------------------')
                            logger.sensitive(`userAccountTablesResponse=${JSON.stringify(userAccountTablesResponse)}`);

                            logger.sensitive('-=-=-=-=-=--=-=-=-=-=--=-=-=-=-=--=-=-=-=-=--=-=-=-=-=-')
                            logger.sensitive(userAccountTablesResponse);
                            logger.sensitive('-=-=-=-=-=--=-=-=-=-=--=-=-=-=-=--=-=-=-=-=--=-=-=-=-=-')

                            // if (userFromPassphraseResponse.databaseFound && !userFromPassphraseResponse.userNeedsSave) {
                            //   logger.debug(`database found and userNeedsSave`);
                            //   resolve(userFromPassphraseResponse);
                            // } else


                            const resolveData = {
                              userRecord: userRecord,
                              userAccountTables: userAccountTablesResponse.userAccountTables,
                              appAccountTables: userAccountTablesResponse.appAccountTables
                            }

                            logger.sensitive('-=-=-=-=-=--=-=-=-=-=--=-=-=-=-=--=-=-=-=-=--=-=-=-=-=-')
                            logger.sensitive(resolveData);
                            logger.sensitive('-=-=-=-=-=--=-=-=-=-=--=-=-=-=-=--=-=-=-=-=--=-=-=-=-=-')

                            return resolve(resolveData);

                        })
                        .catch((error) => {
                          // logger.info('This is the second stage');
                          logger.error(`retrieveUserFromPassphrase().catch() error: ${JSON.stringify(error)}`);
                          reject(error);
                        });

                })

            })
      } else {
        logger.debug('No containedDatabase and not the application account.');
        logger.debug(`getUser().retrieveUserFromApp(account = ${account})`);
        self.retrieveUserFromApp(account, passphrase)
            .then((response) => {
              logger.debug('getUser().retrieveUserFromApp().then()');
              // logger.debug('No ContainedDatabase');
              logger.sensitive(`response = ${JSON.stringify(response)}`);
              resolve(response);
            })
            .catch((error) => {
              logger.error(`getUser().retrieveUserFromApp().catch() error: ${JSON.stringify(error)}`);
              // logger.info('This third the second stage');
              reject(error);
            });
      }
    });
  }

  /**
   *
   * @param {object} accessData
   * @returns {Promise<{userRecord, tableList, noUserTables, applicationTables, applicationTablesFound, userNeedsSave, recordsFound, tables, user}>}
   */
  retrieveAccountTables(accessData) {
    logger.verbose('########################################################################################')
    logger.verbose(`                      retrieveUserFromPassphrase(accessData =${!!accessData})`)
    logger.verbose('########################################################################################')
    logger.sensitive(`accessData=${JSON.stringify(accessData)}`);

    // const { passphrase } = accountProperties;
    let userAccountTables;

    return new Promise((resolve, reject) => {
      let applicationTables;
      let userRecord;
      logger.debug(`retrieveUserFromPassphrase(accessData=${!!accessData}).loadUserAndAppData(accessData = ${!!accessData})`)
      this.loadUserAndAppData(accessData)
          .then((userAndAppData) => {
            //{"app":{"tables":[]},"tables":{"usersTable":{"users":{"address":"JUP-DD4P-62WU-M9AE-74LDD","passphrase":"stolen candle completely blind power give cold lunch nine stare hunt gentle"},"confirmed":true},"channelsTable":null,"invitesTable":null,"storageTable":null},"userRecord":null}
          logger.debug('---------------------------------------------------------------------------------------')
          logger.debug(`-- retrieveUserFromPassphrase(accessData=${!!accessData}).loadUserAndAppData(accessData=${!!accessData}).THEN(userAndAppData=${!!userAndAppData})`)
          logger.debug('---------------------------------------------------------------------------------------')
          logger.sensitive(`-- userAndAppData=${JSON.stringify(userAndAppData)}`);
          applicationTables = userAndAppData.app.tables;
          logger.sensitive(`-- userAndAppData.app.tables=${JSON.stringify(applicationTables)}`)
          userAccountTables = userAndAppData.tables;
          logger.sensitive(`-- userAccountTables= ${JSON.stringify(userAccountTables)}`);
          userRecord = userAndAppData.userRecord;
          // if (userRecord) {
          //   logger.debug(`-- Found User Table.`);
          //   Object.keys(applicationTables).forEach((x) => {
          //     if (applicationTables[x].users) {
          //       applicationRecordTable = applicationTables[x].users;
          //     }
          //   });


          logger.verbose('retrieveAccountTables().done')
          logger.verbose('####################################')
          return resolve({
            userAccountTables: userAndAppData.tables,
            appAccountTables: applicationTables
          })
        })
          .catch((error) => {
            logger.error(error);
            reject({ success: false, errors: error });
          });

        })
  }

  /**
   *
   * @param {string} userAccount
   * @param {string} passphrase
   * @returns {Promise<{recordsFound, user} | {error, message}>} - {recordsFound, user} | {error, message}
   */
  retrieveUserFromApp(userAccount, passphrase) {
    logger.verbose('########################################################################')
    logger.verbose(`                       retrieveUserFromApp(userAccount = ${userAccount})`)
    logger.verbose('########################################################################')
    const eventEmitter = new events.EventEmitter();
    const self = this;

    return new Promise((resolve, reject) => {
      const appAcctUserTableTransactionsSentToUserAcct = [];
      const appAcctUserTableDecryptedMessagesSentToUser = [];
      let responseData;
      // let applicationTables;
      let applicationAccountUserTable;
      let applicationAccountUserTableTransactions;
      let completedNumber = 0;
      let appAcctUserTableTransactionsSentToUserAcctFound = 0;

      eventEmitter.on('set_responseData', () => {
        logger.verbose(`retrieveUserFromApp().on(set_responseData)`);
        logger.sensitive(`Total appAcctUserTableDecryptedMessagesSentToUser: ${appAcctUserTableDecryptedMessagesSentToUser.length}`);
        logger.sensitive(`appAcctUserTableDecryptedMessagesSentToUser= ${JSON.stringify(appAcctUserTableDecryptedMessagesSentToUser)}`);
        if (appAcctUserTableDecryptedMessagesSentToUser[0] === undefined
          || appAcctUserTableDecryptedMessagesSentToUser[0].user_record === undefined) {
          return resolve({ error: true, message: 'Account not on file!' });
        } else {
          logger.debug(`retrieveUserFromApp().on(set_responseDAta) return responseData`)
          responseData = {
            recordsFound: appAcctUserTableTransactionsSentToUserAcct.length,
            user: appAcctUserTableDecryptedMessagesSentToUser[0].user_record
          };

          logger.sensitive(`responseData = ${JSON.stringify(responseData)}`)
          return resolve(responseData);
        }

        logger.verbose('retrieveUserFromApp().done')
        logger.verbose('####################################')
      });

      eventEmitter.on('check_on_pending', () => {
        eventEmitter.emit('set_responseData');
      });

      eventEmitter.on('records_retrieved', () => {
        logger.debug(` retrieveUserFromApp().on(records_retrieved)`)
        logger.debug(`Total  appAcctUserTableTransactionsSentToUserAcct to process: ${appAcctUserTableTransactionsSentToUserAcct.length}`);

        if (Object.keys(appAcctUserTableTransactionsSentToUserAcct).length <= 0) {
          eventEmitter.emit('check_on_pending');
        } else {

          const appAcctUserTableTransactionsSentToUserAcctCount = appAcctUserTableTransactionsSentToUserAcct.length;
          const messages = [];

          for( let index = 0; index < appAcctUserTableTransactionsSentToUserAcctCount; index ++) {
            const thisUrl = `${self.jupiter_data.server}/nxt?requestType=readMessage&transaction=${appAcctUserTableTransactionsSentToUserAcct[index]}&secretPhrase=${passphrase}`;
            logger.sensitive(` calling endpoint: ${thisUrl}`);
            const message = new Promise( (resolve, reject) => {
              axios.get(thisUrl)
                  .then((response) => {
                    logger.verbose(`retrieveUserFromApp().on(records_retrieved).axios.get.then()`);
                    logger.debug(`response.data = ${JSON.stringify(response.data)}`);

                    if(response.data.errorCode){
                      logger.error('readMessage call returned a 200 error!');
                      logger.error(JSON.stringify(response.data));
                      return resolve({error: true, message: response.data});
                    }

                    try {
                      const decryptedMessage = response.data.decryptedMessage;
                      // logger.debug('_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*_*')
                      // logger.sensitive(`decrypting the message: ${decryptedMessage} with APP password`);
                      const decrypted = JSON.parse(self.decrypt(decryptedMessage));
                      // logger.sensitive(`decrypted Message: ${decrypted}`);
                      decrypted.confirmed = true;
                      return resolve(decrypted);
                    } catch ( error ) {
                      logger.error(error);
                      return resolve({error:true, message: error})
                    }
                  })
                  .catch((error) => {
                    logger.error('readMessage call return a non-200');
                    logger.error(JSON.stringify(error));
                    return resolve({error:true, message: error});
                  });
            })

            messages.push(message);
          }

          Promise.all(messages)
              .then(results =>{
                logger.debug(`promise.all()`);
                logger.debug(`total results: ${results.length}`);
                const decrypted = results.reduce((reduced, result) => {
                  if (result.error) {
                    logger.warn('ITEM NOTDECRYPTED');
                    return reduced
                  }
                  logger.sensitive(`DECRYPTED: ${JSON.stringify(result)}`);
                  reduced.push(result)
                  return reduced;
                }, [])

                if (Array.isArray(decrypted) && decrypted.length > 0){
                  logger.debug(`Total messages decrypted: ${decrypted.length}`);

                  appAcctUserTableDecryptedMessagesSentToUser.push(...decrypted);
                }
                eventEmitter.emit('check_on_pending');
              })
        }
      });

      eventEmitter.on('table_retrieved', () => {
        logger.debug(`retrieveUserFromApp().on(table_retrieved)`);
        // The some() method tests whether at least one element in the array passes the test implemented by the provided
        // function. It returns true if, in the array, it finds an element for which the provided function returns true;
        // otherwise it returns false. It doesn't modify the array.
        Object.keys(applicationAccountUserTableTransactions).some((arrayIndex) => {
          const transaction = applicationAccountUserTableTransactions[arrayIndex];
          let completion = false;
          logger.debug(` the recipient ${transaction.recipientRS} needs to be ${userAccount}`);
          if (transaction.attachment.encryptedMessage.data && transaction.recipientRS === userAccount) {
            appAcctUserTableTransactionsSentToUserAcct.push(transaction.transaction);
            appAcctUserTableTransactionsSentToUserAcctFound += 1;
            completedNumber += 1;
            completion = true;
          }
          return completion;
        });


        eventEmitter.emit('records_retrieved');
      });

      eventEmitter.on('table_access_retrieved', () => {
        logger.debug(`retrieveUserFromApp().on(table_access_retrieved)`);
        logger.sensitive(`getting transactions from applicationAccountUserTable: ${applicationAccountUserTable.address}`);
        const includeExpiredPrunable = '&includeExpiredPrunable=true';
        axios.get(`${self.jupiter_data.server}/nxt?requestType=getBlockchainTransactions&account=${applicationAccountUserTable.address}&withMessage=true&type=1${includeExpiredPrunable}`)
          .then((response) => {
            logger.debug(`retrieveUserFromaApp().axiosGet().then()`)
            // applicationAccountUserTableTransactions =
            // [ { signature, transactionIndex, type, phased, ecBlockId, signatureHash, attachment, senderRS,
            // subtype, amountNQT, recipientRS, block, blockTimestamp, deadline, timestamp, height, senderPublicKey,
            // feeNQT, confirmations, fullHash, version, sender, recipient, ecBlockHeight, transaction} ]
            applicationAccountUserTableTransactions = response.data.transactions;
            logger.sensitive(`applicationAccountUserTableTransactions Count: ${applicationAccountUserTableTransactions.length}`);

            eventEmitter.emit('table_retrieved');
          })
          .catch((error) => {
            logger.error(error);
            reject({ success: false, errors: error });
          });
      });

      logger.debug(`retrieveUserFromApp(account = ${userAccount}).loadUserAndAppData(empty)`);
      self.loadUserAndAppData()
        .then((res) => {
          logger.debug('---------------------------------------------------------------------------------------')
          logger.debug(`-- retrieveUserFromApp(account = ${userAccount}).loadUserAndAppData.then(res)`);
          logger.debug('---------------------------------------------------------------------------------------')
          logger.sensitive(`-- res.app=${JSON.stringify(res.app)}`);
          const applicationTables = res.app.tables;
          logger.sensitive(`-- applicationTables = ${JSON.stringify(res.app.tables)}`);
          Object.keys(applicationTables).forEach((x) => {
            if (applicationTables[x].users) {
              applicationAccountUserTable = applicationTables[x].users;
            }
          });
          logger.debug(`-- applicationAccountUserTable=${applicationAccountUserTable}`);
          eventEmitter.emit('table_access_retrieved');
        })
        .catch((err) => {
          logger.error(err);
          reject('There was an error');
        });
    });
  }

  // This method retrieves record info based on the table and id number given
  findById(id, model) {
    const eventEmitter = new events.EventEmitter();
    const self = this;
    const sameId = [];
    let allRecords = [];

    return new Promise((resolve, reject) => {
      const Record = require(`../models/${model}`);
      const record = new Record({ id: null });

      eventEmitter.on('records_retrieved', () => {
        // let userAddress;
        /* Object.keys(allRecords).forEach((x) => {
          if (allRecords[x].id && allRecords[x].id === id) {
            sameId.push(JSON.parse(allRecords[x][`${model}_record`]));
          }
        }); */

        for (let x = 0; x < Object.keys(allRecords).length; x += 1) {
          if (allRecords[x].id && allRecords[x].id === id) {
            sameId.push(JSON.parse(allRecords[x][`${model}_record`]));
          }
        }
        self.sortByDate(sameId);
        resolve({ success: true, record: sameId[0] });
      });

      self.getAllRecords(record.table)
        .then((response) => {
          allRecords = response.records;
          eventEmitter.emit('records_retrieved');
        })
        .catch((error) => {
          logger.error(error);
          reject({ success: false, errors: error });
        });
    });
  }

  getBalance(address, accountId, jupServ) {
    logger.verbose(`getBalance()`)
    const self = this;
    const eventEmitter = new events.EventEmitter();
    let account;
    const addressOwner = address || process.env.APP_ACCOUNT;
    const server = jupServ || process.env.JUPITERSERVER;

    return new Promise((resolve, reject) => {
      if (!addressOwner || !server) {
        return reject({ success: false, message: 'Missing parameters' });
      }

      eventEmitter.on('account_retrieved', () => {
        axios.post(`${server}/nxt?requestType=getBalance&account=${account}`)
          .then((response) => {
            if (response.data.errorDescription) {
              reject(response.data);
            } else {
              logger.info(`Balance: ${(parseFloat(response.data.balanceNQT) / (10 ** self.jupiter_data.moneyDecimals))} JUP.`);
              let minimumAppBalance = false;
              let minimumTableBalance = false;

              if (response.data.balanceNQT >= self.jupiter_data.minimumAppBalance) {
                minimumAppBalance = true;
              }

              if (response.data.balanceNQT >= self.jupiter_data.minimumTableBalance) {
                minimumTableBalance = true;
              }

              const responseData = {
                minimumAppBalance,
                minimumTableBalance,
                balance: response.data.balanceNQT,
                minAppBalanceAmount: self.jupiter_data.minimumAppBalance,
                minTableBalanceAmount: self.jupiter_data.minimumTableBalance,
              };
              resolve(responseData);
            }
          })
          .catch((error) => {
            logger.error(error);
            reject({ success: false, message: 'There was an error obtaining account Jupiter balance' });
          });
      });

      if (!accountId) {
        axios.get(`${server}/nxt?requestType=getAccountId&secretPhrase=${addressOwner}`)
          .then((response) => {
            ({ account } = response.data);
            eventEmitter.emit('account_retrieved');
          })
          .catch((error) => {
            logger.error(error);
            reject({ success: false, message: 'There was an error obtaining account Jupiter balance' });
          });
      } else {
        account = accountId;
        eventEmitter.emit('account_retrieved');
      }
    });
  }


  sendMoneyAndWait(recipient, transferAmount, sender, secondsToWait=50) {
    logger.verbose('#####################################################################################');
    logger.verbose(` sendMoneyAndWait(recipient=${recipient}, tansferMoney=${transferAmount}, sender=${sender}, seccondsToWait= ${secondsToWait})`);
    logger.verbose('#####################################################################################');

    const milliseconds = secondsToWait * 1000;
    return new Promise( (resolve, reject) => {
      this.sendMoney(recipient, transferAmount, sender)
          .then(response => {
            setTimeout(async () => {
              return resolve(response)
            }, milliseconds );
          })
          .catch(error => {
            return reject(error);
          })
    })
  }

  /**
   *
   * @param recipient
   * @param transferAmount
   * @param sender
   * @returns {Promise<unknown>}
   */
  sendMoney(recipient, transferAmount, sender) {
    logger.verbose('#####################################################################################');
    logger.verbose(`sendMoney(recipient= ${recipient}, transferAmount= ${transferAmount}, sender)`)
    logger.verbose('#####################################################################################');
    // This is the variable that will be used to send Jupiter from the app address to the address
    // that will be used as a database table or will serve a purpose in the Gravity infrastructure
    const feeNQT = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const tableCreation = 750;
    let amount = transferAmount;
    const senderPassphrase = sender || process.env.APP_ACCOUNT;
    const server = process.env.JUPITERSERVER;
    if (!amount) {
      // amount = this.jupiter_data.minimumAppBalance - feeNQT - tableCreation;
      amount = this.jupiter_data.minimumAppBalance;
    }

    return new Promise((resolve, reject) => {
      if (!recipient) {
        return reject({ error: true, data: 'recipient missing' });
      }

      const requestUrl = `${server}/nxt?requestType=sendMoney&secretPhrase=${senderPassphrase}&recipient=${recipient}&amountNQT=${amount}&feeNQT=${feeNQT}&deadline=60`

      logger.sensitive(`sendMoney: ${requestUrl}`);
      // gravityCLIReporter.addItemsInJson('Sending some Money', {
      //   'sender': senderPassphrase,
      //   'recepient': recipient,
      //   'amountNQT': amount,
      //   'feeNQT': feeNQT
      // }, `Funding` );


      return axios.post(requestUrl)
        .then((response) => {
          if (response.data.signatureHash != null) {
            return resolve({ success: true, data: response.data });
          }

          logger.error(JSON.stringify(response.data));
          return reject({ error: true, data: response.data });
        })
        .catch(error => reject({ error: true, fullError: error }));
    });
  }

  // We use axios to make the connection to pimcore server
  request(method, url, data, callback) {
    return axios({
      url,
      method,
      data,
    })
      .then((res) => {
        if (res.data) {
          // If callback exists, it is executed with axios response as a param
          if (callback) {
            return callback(res.data);
          }
          return res.data;
        }
        return ({ error: true, message: 'There was an error with the request' });
      })
      .catch(error => ({
        error: true,
        message: 'There was an error making axios request',
        fullError: error,
      }));
  }

  jupiterURL(givenParams) {
    const params = givenParams;
    if (!params.deadline) {
      params.deadline = this.jupiter_data.deadline;
    }

    if (!params.feeNQT) {
      params.feeNQT = this.jupiter_data.feeNQT;
    }

    const urlParams = Object.keys(params);
    let url = `${this.jupiter_data.server}/nxt?`;

    for (let x = 0; x < urlParams.length; x += 1) {
      const thisParam = urlParams[x];

      if (x === 0) {
        url += `${thisParam}=${params[thisParam]}`;
      } else {
        url += `&${thisParam}=${params[thisParam]}`;
      }
    }

    return url;
  }

  async jupiterRequest(rtype, params, data = {}, callback) {
    const url = this.jupiterURL(params);

    const response = await this.request(rtype, url, data, callback);

    return response;
  }

  async getAlias(aliasName) {
    logger.verbose('###############################################################################################')
    logger.verbose(`## getAlias(aliasName= ${aliasName}`);
    logger.verbose('###############################################################################################')
    const aliasCheckup = await this.jupiterRequest('get', {
      aliasName,
      requestType: 'getAlias',
    });

    logger.debug('Alias check up ' + JSON.stringify(aliasCheckup));
    if (
      aliasCheckup.errorDescription
      && aliasCheckup.errorDescription === 'Unknown alias'
    ) {
      return { available: true };
    }

    if (aliasCheckup.errorDescription) {
      aliasCheckup.error = true;
      return { aliasCheckup };
    }

    return aliasCheckup;
  }

  async setAlias(params) {
    logger.verbose('###############################################################################################')
    logger.info(`## params= ${JSON.stringify(params)}`);
    logger.verbose('###############################################################################################')
    return this.jupiterRequest('post', {
      requestType: 'setAlias',
      aliasName: params.alias,
      secretPhrase: params.passphrase,
      aliasURI: `acct:${params.account}@nxt`,
      feeNQT: 80,
    });
  }

  async deleteAlias(params) {
    return this.jupiterRequest('post', {
      requestType: 'deleteAlias',
      aliasName: params.alias,
      secretPhrase: params.passphrase,
      feeNQT: 80,
    });
  }

  async startFundingMonitor(params) {

    const postParams = {
      requestType: 'startFundingMonitor',
      property: params.fundingProperty || this.fundingProperty,
      secretPhrase: params.passphrase,
      feeNQT: 80,
      amount: params.amount || parseInt(this.jupiter_data.minimumTableBalance, 10),
      threshold: params.threshold || parseInt(this.jupiter_data.minimumTableBalance / 2, 10),
      interval: 10,
    }

    gravityCLIReporter.addItemsInJson('Funding Properties', postParams,'Funding')

    return this.jupiterRequest('post', postParams);
  }

  async getFundingMonitor(params = {}) {
    return this.jupiterRequest('post', {
      requestType: 'getFundingMonitor',
      property: params.fundingProperty || this.fundingProperty,
      secretPhrase: params.passphrase || process.env.APP_ACCOUNT,
      includeMonitoredAccounts: params.includeAccounts || false,
    });
  }


  async stopFundingMonitor(params) {
    return this.jupiterRequest('post', {
      requestType: 'stopFundingMonitor',
      property: params.fundingProperty || this.fundingProperty,
      secretPhrase: params.passphrase,
      feeNQT: 80,
    });
  }

  async setProperty(params) {
    return this.jupiterRequest('post', {
      requestType: 'startFundingMonitor',
      recipient: params.recipient,
      property: params.property,
      value: params.value,
      secretPhrase: params.passphrase,
      feeNQT: 80,
      interval: 10,
    });
  }

  async setFundingProperty(params) {
    const threshold = params.threshold || parseInt(this.jupiter_data.minimumTableBalance / 2, 10);

    return this.jupiterRequest('post', {
      requestType: 'startFundingMonitor',
      recipient: params.recipient,
      property: params.property || this.fundingProperty,
      value: params.value || `{"threshold":"${threshold}"}`,
      secretPhrase: params.passphrase,
      feeNQT: 80,
      amount: params.amount || parseInt(this.jupiter_data.minimumTableBalance, 10),
      interval: 10,
      threshold,
    });
  }

  async getAccountProperties(params) {
    return this.jupiterRequest('get', {
      requestType: 'getAccountProperties',
      recipient: params.recipient,
    });
  }

  async setAcountProperty(params) {
    const threshold = params.threshold || parseInt(this.jupiter_data.minimumTableBalance / 2, 10);

    return this.jupiterRequest('post', {
      requestType: 'setAccountProperty',
      secretPhrase: params.passphrase || process.env.APP_ACCOUNT,
      recipient: params.recipient,
      property: params.property || this.fundingProperty,
      feeNQT: params.feeNQT || 10,
      value: params.value || `{"threshold":"${threshold}"}`,
    });
  }

  async deleteAccountProperty(params) {
    return this.jupiterRequest('post', {
      requestType: 'deleteAccountProperty',
      recipient: params.recipient,
      property: params.property,
      secretPhrase: params.passphrase,
      feeNQT: params.feeNQT || 10,
      deadline: params.deadline || 60,
    });
  }

  async hasFundingProperty(params) {
    const { properties } = await this.getAccountProperties(params);
    const self = this;
    let hasFundingProperty = false;

    for (let x = 0; x < properties.length; x += 1) {
      const thisProperty = properties[x];
      if (thisProperty.property === self.fundingProperty) {
        hasFundingProperty = true;
      }
    }

    return hasFundingProperty;
  }

  async sendMessage(
    data,
    passphrase,
    recipientRS,
    recipientPublicKey,
    config = { appEncryption: false, specialEncryption: false },
  ) {
    logger.verbose(`sendMessage()`);
    let dataToBeSent;
    let callUrl;
    let response;

    if (config.appEncryption) {
      dataToBeSent = this.encrypt(data);
    } else {
      dataToBeSent = data;
    }
    let recipient;
    let aliasResponse;

    if (!recipientRS.toLowerCase().includes('jup-')) {
      try{
        aliasResponse = await this.getAlias(recipientRS);
        logger.info('Alias ' + JSON.stringify(aliasResponse));
        recipient = aliasResponse.accountRS;
      } catch (error){
       throw new Error('Not valid alias');
      }
    } else {
      recipient = recipientRS;
    }

    if (!recipient) {
      throw { error: true, message: 'Incorrect recipient', fullError: aliasResponse };
    }

    const feeInvitation = 200000;
    if (recipientPublicKey) {
      callUrl = `${this.jupiter_data.server}/nxt?requestType=sendMessage&secretPhrase=${passphrase}&recipient=${recipient}&messageToEncrypt=${dataToBeSent}&feeNQT=${feeInvitation}&deadline=${this.jupiter_data.deadline}&recipientPublicKey=${recipientPublicKey}&compressMessageToEncrypt=true`;
    } else {
      callUrl = `${this.jupiter_data.server}/nxt?requestType=sendMessage&secretPhrase=${passphrase}&recipient=${recipient}&messageToEncrypt=${dataToBeSent}&feeNQT=${feeInvitation}&deadline=${this.jupiter_data.deadline}&messageIsPrunable=true&compressMessageToEncrypt=true`;
    }

    try {
      response = await axios.post(callUrl);

      if (response.data.broadcasted && response.data.broadcasted === true) {
        return ({ success: true, message: 'Message sent' });
      }
      return ({ error: true, fullError: response.data });
    } catch (e) {
      return ({ error: true, fullError: e });
    }
  }

  /**
   *
   * @param {string} passphrase
   * @returns {Promise<{address, publicKey, success}>}
   */
  createNewJupiterAccount(passphrase) {
    return new Promise((resolve, reject) => {
      axios.get(`${this.jupiter_data.server}/nxt?requestType=getAccountId&secretPhrase=${passphrase}`)
        .then((response) => {
          const address = response.data.accountRS;
          resolve({ address, publicKey: response.data.publicKey, success: true });
        })
        .catch((error) => {
          logger.error(error);
          logger.info('There was an error in address creation');
          reject({ success: false, message: 'There was an error creating a new Jupiter address' });
        });
    });
  }

  getAccountInformation(passphrase) {
    logger.verbose('getAccountInformation()');
    const self = this;
    return new Promise((resolve, reject) => {
      axios.get(`${self.jupiter_data.server}/nxt?requestType=getAccountId&secretPhrase=${passphrase}`)
        .then((response) => {
          logger.verbose('getAccountInformation().axios.get().then()');
          logger.sensitive(`response = ${JSON.stringify(response.data)}`);

          const address = response.data.accountRS;
          resolve({
            address,
            accountId: response.data.account,
            publicKey: response.data.publicKey,
            success: true,
          });
        })
        .catch((error) => {
          logger.error(`getAccountInformation().axios.get().catch()`)
          logger.error(`error = ${error}`);
          logger.info('There was an error in address creation');
          reject({ success: false, message: 'There was an error in getting account information' });
        });
    });
  }

  /**
   *
   * @param {object} accountCredentials - database == transactions
   * @param {string} tableName - ex 'users' or 'invites' or 'channels' or 'storage'
   * @param {[]} currentTables - ?
   * @returns {Promise<unknown>}
   */
  async attachTable(accountCredentials, tableName, currentTables = null) {
    logger.verbose('#############################################################################################################')
    logger.verbose(`##  attachTable(database=${!!accountCredentials} , tableName=${tableName}, currentTables=${currentTables})`);
    logger.verbose('#############################################################################################################')
    logger.sensitive(`database=${JSON.stringify(accountCredentials)}`);

    const defaultTableNames =   ['users', 'channels','invites', 'storage']

    if( ! defaultTableNames.includes(tableName)){
      throw new Error('table name must be a string!');
    }

    const eventEmitter = new events.EventEmitter();
    // let valid_table = true;
    // let listOfTableNames = [];
    // let app;
    let newTableAddress;
    let newPassphrase;
    let newPublicKey;
    // let current_tables;
    let record;
    let tableNamesContainer;
    // let table_created = true;
    let listOfTableNames = []
    const transactionsReport = []

    return new Promise((resolve, reject) => {
      eventEmitter.on('insufficient_balance', () => {
        logger.verbose(`attachTable().on(insufficient_balance)`)
        reject("Please send JUP to your app's newTableAddress and retry command");
      });


      eventEmitter.on('table_created', () => {
        logger.verbose(`EVENT-EMITTER: attachTable().on(table_created)`)

        // This code will send Jupiter to the recently created table newTableAddress so that it is
        // able to record information
        logger.debug(`attachTable().sendMoneyAndWait(newTableAddress= ${newTableAddress})`)
        // sendMoney(recipient, transferAmount, sender) {

        this.sendMoney(newTableAddress, process.env.JUPITER_MININUM_TABLE_BALANCE )
          .then((response) => {
            logger.verbose('------------------------------------------------------------');
            logger.verbose(`-- attachTable().sendMoney(newTableAddress).then(response)`)
            logger.verbose('--');
            logger.verbose(`newTableName= ${tableName}`);
            logger.verbose(`newTableAddress= ${newTableAddress}`);

            transactionsReport.push({name: 'send-money', id: response.data.transaction})

            return resolve({
              name: tableName,
              address: newTableAddress,
              passphrase: newPassphrase,
              publicKey: newPublicKey,
              transactionsReport: transactionsReport
            })

            // resolve({
            //   success: true,
            //   message: `Table ${tableName} pushed to the blockchain and funded.`,
            //   data: response.data,
            //   jupiter_response: response.data,
            //   tables: listOfTableNames,
            //   others: this.tables,
            // });
          })
          .catch((err) => {
            logger.error(err);
            reject({ success: false, message: 'Unable to send Jupiter to new table newTableAddress' });
          });
      });

      eventEmitter.on('address_retrieved', async () => {
        logger.verbose(`EVENT-EMITTER: attachTable().on(address_retrieved)`)

        const encryptedData = this.encrypt(JSON.stringify(record), accountCredentials.encryptionPassword);

        if (tableName === 'channels' && tableNamesContainer.tables.length < 2) {
          tableNamesContainer.tables = ['users', 'channels'];
        }

        if (tableName === 'invites' && tableNamesContainer.tables.length < 3) {
          tableNamesContainer.tables = ['users', 'channels', 'invites'];
        }

        if (tableName === 'storage' && tableNamesContainer.tables.length < 4) {
          tableNamesContainer.tables = ['users', 'channels', 'invites', 'storage'];
        }

        const encryptedTableData = this.encrypt(
          JSON.stringify(tableNamesContainer),
          accountCredentials.encryptionPassword,
        );

        logger.sensitive(`tableListRecord= ${JSON.stringify(tableNamesContainer)}`);


        const recipientPublicKey = (accountCredentials.publicKey)?`&recipientPublicKey=${accountCredentials.publicKey}`:''

        logger.debug(`recipientPublicKey= ${recipientPublicKey}`);

        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record);
        const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}
        const callUrl = `${this.jupiter_data.server}/nxt?requestType=sendMetisMessage&secretPhrase=${accountCredentials.passphrase}&recipient=${accountCredentials.account}&messageToEncrypt=${encryptedData}&feeNQT=${fee}&subtype=${subtype}&deadline=${this.jupiter_data.deadline}&compressMessageToEncrypt=true${recipientPublicKey}`;
        let response;
        try {
          logger.debug(`Sending a jupiter message`);
          response = await axios.post(callUrl);
        } catch (e) {
          logger.error('********************');
          logger.error('ERROR ATTACHING TABLE!')
          console.log(e)
          response = { error: true, fullError: e };
        }

        if (response.data.broadcasted && !response.error) {
          logger.info(`Table ${tableName} pushed to the blockchain and linked to your account...`);
          // const recipientPublicKey = (database.publicKey | database.publicKey == 'undefined')? `&recipientPublicKey=${database.publicKey}`:''
          const tableListUpdateUrl = `${this.jupiter_data.server}/nxt?requestType=sendMetisMessage&secretPhrase=${accountCredentials.passphrase}&recipient=${accountCredentials.account}&messageToEncrypt=${encryptedTableData}&feeNQT=${fee}&subtype=${subtype}&deadline=${this.jupiter_data.deadline}&compressMessageToEncrypt=true${recipientPublicKey}`;
          logger.sensitive(`tableListUpdateUrl= ${tableListUpdateUrl}`);
          try {
            response = await axios.post(tableListUpdateUrl);
          } catch (e) {
            logger.error('********************');
            logger.error('ERROR ATTACHING TABLE!')
            console.log(e)
            logger.error('********************');
            response = { error: true, fullError: e };
          }

          if (response.data && response.data.broadcasted && response.data.broadcasted === true) {
            eventEmitter.emit('table_created');
          } else if (response.data && response.data.errorDescription != null) {
            reject({
              success: false,
              message: response.data.errorDescription,
              jupiter_response: response.data,
            });
          } else {
            reject({
              success: false,
              message: 'There was an error',
              fullError: response,
            });
          }
        } else if (response.data.errorDescription != null) {
          logger.error(`Error: ${JSON.stringify(response.data)}`);
          reject({
            success: false,
            message: response.data.errorDescription,
            jupiter_response: response.data,
          });
        } else {
          logger.error(`Error: ${JSON.stringify(response.data)}`);
          reject({ success: false, message: 'Unable to save data in the blockchain', jupiter_response: response.data });
        }
      });

      eventEmitter.on('tableName_obtained', () => {
        logger.verbose(`attachTable().on(tableName_obtained)`)
        logger.info(`this.tables = ${this.tables}`);
        logger.info(`listOfTableNames = ${listOfTableNames}`);
        logger.info(`currentTables = ${currentTables}`);
        // let databaseCurrentTableMatch = true;
        let tableInCurrentTableList = false;
        if (currentTables) {
          if (!(listOfTableNames.includes(tableName) && currentTables.includes(tableName))) {
            tableInCurrentTableList = currentTables.includes(tableName);
          }
        }

        logger.debug(`tableInCurrentTableList= ${tableInCurrentTableList}`)

        if ((
          this.tables.indexOf(tableName) >= 0 || listOfTableNames.indexOf(tableName) >= 0)
          && tableInCurrentTableList
        ) {
          reject(`Error: Unable to save table. ${tableName} is already in the database`);
        } else {
          newPassphrase = this.generate_passphrase();
          logger.debug(`CreateNewAddress()`)
          this.createNewJupiterAccount(newPassphrase)
            .then((newJupiterAccountResponse) => { //{address, publicKey, success}
              logger.debug('---------------------------------------------------------------------------------------')
              logger.debug(`-- attachTable(accountCredentials, tableName=${tableName}).createNewJupiterAccount(newPassphrase).THEN(newJupiterAccountResponse)`)
              logger.debug('---------------------------------------------------------------------------------------')
              logger.sensitive(`newJupiterAccountResponse= ${JSON.stringify(newJupiterAccountResponse)}`);

              if (newJupiterAccountResponse.success === true && newJupiterAccountResponse.address && newJupiterAccountResponse.address.length > 0) {
                logger.debug('The account was successfully created.')
                newTableAddress  = newJupiterAccountResponse.address;
                logger.debug(`newTableAddress=${newTableAddress}`);
                newPublicKey = newJupiterAccountResponse.public_key;
                record = {
                  [tableName]: {
                    address: newTableAddress,
                    passphrase: newPassphrase,
                    public_key: newJupiterAccountResponse.publicKey,
                  },
                };
                listOfTableNames.push(tableName);
                tableNamesContainer = {
                  tables: listOfTableNames,
                  date: Date.now(),
                };


                eventEmitter.emit('address_retrieved');
              } else {
                logger.error(`attachTable().createNewAddress().then() error: ${JSON.stringify(newJupiterAccountResponse)}`);
                reject('There was an error');
              }
            })
            .catch((error) => {
              logger.error(`attachTable().createNewAddress().catch()`);
              logger.error(`error = ${JSON.stringify(error)}`);
              reject('Error creating Jupiter newTableAddress for your table.');
            });
        }
      });

      eventEmitter.on('verified_balance', () => {
        logger.verbose(`attachTable().on(verified_balance)`)
        logger.debug(`attachTable().loadUserAndAppData(database=${!!accountCredentials})`)
        this.loadUserAndAppData(accountCredentials)
          .then((response) => { //  {numberOfRecords,success,app:{tables,appData,address}, message,tables,hasUserTable,userRecord}
            logger.verbose('---------------------------------------------------------------------------------------')
            logger.verbose(`-- attachTable().loadUserAndAppData(database=${!!accountCredentials}).then(response=${!!response})`);
            logger.verbose('---------------------------------------------------------------------------------------')
            logger.sensitive(`response=${JSON.stringify(response)}`);
            listOfTableNames = this.extractTableNamesFromTables(response.tables);
            eventEmitter.emit('tableName_obtained');
          })
          .catch((error) => {
            logger.error(error);
            reject('Error in creating table');
          });
      });
      eventEmitter.emit('verified_balance');
    });
  }


  /**
   *
   * @param {object} tables
   * @returns {array}
   */
  extractTableNamesFromTables(tables) {
    logger.verbose('#####################################################################################');
    logger.verbose(`## extractTableNamesFromTables(tables= ${!!tables})`)
    logger.verbose('#####################################################################################');

    if(!tables) {
      return []
    }
    /**
     * Example:
     * tables= [
     {"name":"users","address":null,"passphrase":null,"confirmed":null},
     {"name":"channels","address":null,"passphrase":null,"confirmed":null},
     {"name":"invites","address":null,"passphrase":null,"confirmed":null},
     {"name":"storage","address":null,"passphrase":null,"confirmed":null}]
     */

    const extractedTableNames = tables.reduce( (reduced, table) => {
      if(table.address){
        reduced.push(table.name);
      }
      return reduced;
    }, []);

    logger.debug(`extractedTableNames= ${extractedTableNames}`)
    return extractedTableNames
  }


  async getUnconfirmedData(address, passphrase, filter = {}, accessData) {
    const self = this;
    const unconfirmedData = [];

    let response;
    try {
      response = await axios.get(`${self.jupiter_data.server}/nxt?requestType=getUnconfirmedTransactions&account=${address}`);
    } catch (e) {
      response = ({ error: true, errors: e });
    }


    if (response.error) {
      return response;
    }

    const transactions = response.data.unconfirmedTransactions || [];

    for (let x = 0; x < transactions.length; x += 1) {
      const thisTransaction = transactions[x];

      // We use filters to remove unnecessary information
      if (
        (thisTransaction.senderRS === address
        || thisTransaction.recipientRS === address)
        && (
          thisTransaction.senderRS === filter.account
          || thisTransaction.recipientRS === filter.account
          || !filter.account
        )
      ) {
        const dataObject = {
          signature: thisTransaction.signature,
          fee: thisTransaction.feeNQT,
          sender: thisTransaction.senderRS,
          recipient: thisTransaction.recipientRS,
        };
        let decryptedData;

        try {
          // eslint-disable-next-line no-await-in-loop
          decryptedData = await self.decryptFromRecord(thisTransaction, address, passphrase);
        } catch (e) {
          logger.error(e);
          decryptedData = e;
        }

        try {
          let unconfirmedDataObject;

          if (accessData) {
            unconfirmedDataObject = JSON.parse(self.decrypt(
              decryptedData.decryptedMessage,
              accessData.encryptionPassword,
            ));
          }

          if (!unconfirmedDataObject) {
            unconfirmedDataObject = JSON.parse(self.decrypt(decryptedData.decryptedMessage));
          }
          dataObject.data = unconfirmedDataObject || decryptedData;
        } catch (e) {
          dataObject.data = decryptedData;
        }
        dataObject.data.confirmed = false;
        unconfirmedData.push(dataObject);
      }
    }

    return unconfirmedData;
  }

  async getTransactions(filter) {
    logger.verbose(`getTransactions()`)
    const self = this;
    let address;
    const validTransactions = [];

    if (typeof filter === 'object') {
      address = filter.account;
    } else {
      address = filter;
    }

    let rawTransactions;
    let rawUnconfirmedTransactions;
    let transactions;

    if (!filter.noUnconfirmed) {
      try {
        rawUnconfirmedTransactions = (await axios.get(`${this.jupiter_data.server}/nxt?requestType=getUnconfirmedTransactions&account=${address}`)).data;
      } catch (e) {
        logger.error('Error in gravity.js, line 1662, could not retrieve unconfirmed transactions');
        return { error: true, fullError: e };
      }
      transactions = _.get(rawUnconfirmedTransactions, 'unconfirmedTransactions', []);
      for (let x = 0; x < transactions.length; x += 1) {
        const thisTransaction = transactions[x];
        thisTransaction.confirmed = false;
        if (self.validateTransaction(thisTransaction, filter)) {
          validTransactions.push(thisTransaction);
        }
      }
    }

    if (!filter.noConfirmed) {
      try {
        const numberOfRecords = filter.numberOfRecords || 10;
        const firstIndex = filter.firstIndex || 0;
        const lastIndex = parseInt(firstIndex, 10) + parseInt(numberOfRecords, 10);
        const urlCall = `${this.jupiter_data.server}/nxt?requestType=getBlockchainTransactions&account=${address}&withMessage=true&type=1&firstIndex=${firstIndex}&lastIndex=${lastIndex}`;
        rawTransactions = (await axios.get(urlCall)).data;
      } catch (e) {
        logger.error('Error in gravity.js, line 1671, could not retrieve unconfirmed transactions');
        return { error: true, fullError: e };
      }
      transactions = _.get(rawTransactions, 'transactions', []);
      for (let x = 0; x < transactions.length; x += 1) {
        const thisTransaction = transactions[x];
        thisTransaction.confirmed = true;
        if (self.validateTransaction(thisTransaction, filter)) {
          validTransactions.push(thisTransaction);
        }
      }
    }

    return validTransactions;
  }

  async decryptSingleTransaction(thisTransaction, filter) {
    const dataObject = {
      signature: thisTransaction.signature,
      fee: thisTransaction.feeNQT,
      sender: thisTransaction.senderRS,
      recipient: thisTransaction.recipientRS,
      fullRecord: thisTransaction,
      confirmed: thisTransaction.confirmed,
    };
    let decryptedData;
    const encryptionPassword = filter.encryptionPassword || this.password;
    const encryptionPassphrase = filter.encryptionPassphrase || process.env.APP_ACCOUNT;
    let unEncryptedData;
    let encryptionLevel;

    if (!filter.blockchainEncryptionDisabled && thisTransaction.confirmed) {
      try {
        // eslint-disable-next-line no-await-in-loop
        decryptedData = await this.decryptMessage(
          thisTransaction.transaction,
          encryptionPassphrase,
        );
        if (decryptedData.errorDescription) {
          decryptedData = undefined;
        }
      } catch (e) {
        logger.error(e);
        logger.error('Error: Gravity file, line 1741, failed to decrypt message');
      }
    }

    if (filter.includeUnconfirmed && !thisTransaction.confirmed) {
      let targetAccount;
      if (!filter.targetAccount && filter.multiChannel) {
        targetAccount = thisTransaction.senderRS;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await this.decryptFromRecord(
          thisTransaction,
          targetAccount,
          encryptionPassphrase,
        );

        if (response.errorDescription) {
          decryptedData = undefined;
        } else {
          decryptedData = response;
        }
      } catch (e) {
        logger.error(e);
        logger.error('Error: Gravity file, line 1760, failed to decrypt message');
      }
    }

    if (decryptedData) {
      try {
        unEncryptedData = this.decrypt(
          decryptedData.decryptedMessage,
          encryptionPassword,
        );
        encryptionLevel = 'channel';
      } catch (e) {
        logger.error(e);
        logger.error('Error: Gravity file, line 2147, failed to decrypt messagee');
        try {
          unEncryptedData = this.decrypt(
            decryptedData.decryptedMessage,
            process.env.ENCRYPT_PASSWORD,
          );
          encryptionLevel = 'app';
        } catch (err) {
          logger.error(e);
          logger.error('Error: Gravity file, line 2155, failed to decrypt messagee');
        }
      }
    } else if (filter.blockchainEncryptionDisabled) {
      try {
        unEncryptedData = this.decrypt(
          thisTransaction.attachment.message,
          encryptionPassword,
        );
      } catch (e) {
        logger.error(e);
        logger.error('Error: Gravity file, line 1782, failed to decrypt thisTransaction.attachment.message');
      }
    }

    if (!unEncryptedData) {
      return { error: true, message: 'Cannot be encrypted' };
    }

    if (filter.dataLink) {
      const unEncryptedDataObject = JSON.parse(unEncryptedData);
      const messageRecord = unEncryptedDataObject[filter.dataLink];
      if (!messageRecord) {
        return { error: true, message: 'Cannot be encrypted' };
      }
      dataObject.data = JSON.parse(messageRecord);
      dataObject.data.date = JSON.parse(unEncryptedData).date;
    } else {
      dataObject.data = JSON.parse(unEncryptedData);
    }
    dataObject.date = dataObject.data.date || thisTransaction.fullRecord.date;
    dataObject.data.encryptionLevel = encryptionLevel;
    dataObject.encryptionLevel = encryptionLevel;
    return dataObject;
  }

  async getDataTransactions(filter) {
    logger.verbose(`getDataTransactions()`)
    // Filter must always contain an account
    // but it can be just the address if that is all devs are looking
    const dataTransactions = [];
    let query;

    if (typeof filter === 'string') {
      query = { account: filter, hasAttachment: true };
    } else if (typeof filter === 'object') {
      query = filter;
      query.hasAttachment = true;
    } else {
      return { error: true, message: 'Invalid account or filter data' };
    }

    const transactions = await this.getTransactions(query);

    if (!transactions.error) {
      for (let x = 0; x < transactions.length; x += 1) {
        const thisTransaction = transactions[x];
        let proceed = true;

        if (filter.noConfirmed && thisTransaction.confirmed) {
          proceed = false;
        }

        if (filter.noUnconfirmed && !thisTransaction.confirmed) {
          proceed = false;
        }

        if (proceed) {
          // eslint-disable-next-line no-await-in-loop
          const dataObject = await this.decryptSingleTransaction(thisTransaction, filter);
          if (!dataObject.error) {
            dataTransactions.push(dataObject);
          }
        }
      }
      if (dataTransactions.length > 1) {
        const order = filter.order || 'asc';
        this.sortByDate(dataTransactions, order);
      }

      return dataTransactions;
    }
    return transactions;
  }


  decryptFromRecord(transaction, address, passphrase) {
    const self = this;
    return new Promise((resolve, reject) => {
      if (transaction && transaction.attachment && transaction.attachment.encryptedMessage) {
        axios.get(`${self.jupiter_data.server}/nxt?requestType=decryptFrom&secretPhrase=${passphrase}&account=${address}&data=${transaction.attachment.encryptedMessage.data}&nonce=${transaction.attachment.encryptedMessage.nonce}`)
          .then((response) => {
            resolve(response.data);
          })
          .catch((error) => {
            reject({
              transaction,
              error: true,
              message: 'Error in retrieving first layer of decryption',
              fullError: error,
            });
          });
      } else {
        reject({ transaction, error: true, message: 'Incorrect transaction' });
      }
    });
  }

  //------------------------------------------------------------------------------------------
  // CONSOLE COMMANDS: This methods are related to database creation and can only be accessed
  // from the console. They generate files and make calls to Jupiter to record data
  //------------------------------------------------------------------------------------------

  makeQuestion(question) {
    const readline = require('readline');
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(question, (answer) => {
        if (!answer) {
          reject('Answer cannot be undefined');
        } else {
          resolve(answer);
        }
        rl.close();
      });
    });
  }

  // This method creates a table
  createTable() {
    logger.verbose(`createTable()`);

    const appAccount = process.env.APP_ACCOUNT;
    const appAccountAddress = process.env.APP_ACCOUNT_ADDRESS;
    const appPublickKey = process.env.APP_PUBLIC_KEY;
    const eventEmitter = new events.EventEmitter();
    const self = this;
    // let valid_table = true;
    let tableList = [];
    // let app;
    let tableName;
    let address;
    let passphrase;
    // let current_tables;
    let record;
    let tableListRecord;
    // let table_created = true;

    return new Promise((resolve, reject) => {
      eventEmitter.on('insufficient_balance', () => {
        reject("Please send JUP to your app's address and retry command");
      });

      eventEmitter.on('table_created', () => {
        // This code will send Jupiter to the recently created table address so that it is
        // able to record information
        self.sendMoney(address)
          .then((response) => {
            logger.info(`Table ${tableName} funded with JUP.`);
            resolve({
              success: true,
              message: `Table ${tableName} pushed to the blockchain and funded.`,
              data: response.data,
              jupiter_response: response.data,
              tables: tableList,
              others: self.tables,
            });
          })
          .catch((err) => {
            logger.error(err);
            reject({ success: false, message: 'Unable to send Jupiter to new table address' });
          });
      });

      eventEmitter.on('address_retrieved', () => {
        const encryptedData = self.encrypt(JSON.stringify(record));
        const encryptedTableData = self.encrypt(JSON.stringify(tableListRecord));

        const callUrl = `${self.jupiter_data.server}/nxt?requestType=sendMessage&secretPhrase=${appAccount}&recipient=${appAccountAddress}&messageToEncrypt=${encryptedData}&feeNQT=${self.jupiter_data.feeNQT}&deadline=${self.jupiter_data.deadline}&recipientPublicKey=${appPublickKey}&compressMessageToEncrypt=true`;


        axios.post(callUrl)
          .then((response) => {
            if (response.data.broadcasted && response.data.broadcasted === true) {
              logger.info(`Table ${tableName} pushed to the blockchain and linked to your account.....`);
              eventEmitter.emit('table_created');
            } else if (response.data.errorDescription != null) {
              logger.info('There was an Error');
              logger.info(response);
              logger.info(response.data);
              logger.error(`Error: ${response.data.errorDescription}`);
              reject({
                success: false,
                message: response.data.errorDescription,
                jupiter_response: response.data,
              });
            } else {
              logger.error('Unable to save data in the blockchain');
              logger.error(response.data);
              reject({ success: false, message: 'Unable to save data in the blockchain', jupiter_response: response.data });
            }
          })
          .catch((error) => {
            logger.error(error);
            reject({ success: false, message: 'There was an error', error: error.response });
          });

        const tableListUpdateUrl = `${self.jupiter_data.server}/nxt?requestType=sendMessage&secretPhrase=${appAccount}&recipient=${appAccountAddress}&messageToEncrypt=${encryptedTableData}&feeNQT=${(self.jupiter_data.feeNQT / 2)}&deadline=${self.jupiter_data.deadline}&recipientPublicKey=${appPublickKey}&compressMessageToEncrypt=true`;

        axios.post(tableListUpdateUrl)
          .then((response) => {
            if (response.data.broadcasted && response.data.broadcasted === true) {
            } else if (response.data.errorDescription != null) {
              logger.info('There was an Error');
              logger.info(response.data);
              logger.error(`Error:${response.data.errorDescription}`);
              logger.error(response.data);
            } else {
              logger.info(response.data);
              logger.info(encryptedTableData);
            }
          })
          .catch((error) => {
            logger.info('There was an error in updating table list');
            logger.error(error);
            logger.info(encryptedTableData);
          });
      });

      eventEmitter.on('tableName_obtained', () => {
        if (self.tables.indexOf(tableName) >= 0 || tableList.indexOf(tableName) >= 0) {
          reject(`Error: Unable to save table. ${tableName} is already in the database`);
        } else {
          passphrase = self.generate_passphrase();

          self.createNewJupiterAccount(passphrase)
            .then((response) => {
              if (response.success === true && response.address && response.address.length > 0) {
                ({ address } = response);
                record = {
                  [tableName]: {
                    address,
                    passphrase,
                    public_key: response.publicKey
                  },
                };
                tableList.push(tableName);
                tableListRecord = {
                  tables: tableList,
                  date: Date.now(),
                };

                eventEmitter.emit('address_retrieved');
              } else {
                logger.error(response);
                reject('There was an error');
              }
            })
            .catch((error) => {
              logger.error(error);
              reject('Error creating Jupiter address for your table.');
            });
        }
      });

      eventEmitter.on('verified_balance', () => {
        if (appAccount === undefined || appAccount === '' || appAccount == null) {
          reject('Error: The .env file does not contain APP_ACCOUNT. Please provide one.');
        } else {
          logger.debug('-- ---- -- --- -- --- $$$$$ -- ---- -- --- -- --- 8')
          self.loadUserAndAppData()
            .then(async (response) => {
              if (response.tables === undefined
                || response.tables == null
                || response.tables.length === 0) {
                tableList = [];
              } else {
                tableList = response.tables;
              }

              logger.info('You are about to create a new database table for your Gravity app.');
              logger.info('The following tables are already linked to your database:');
              logger.info(tableList);
              try {
                const answer = await self.makeQuestion('What will be the name of your new table?\n');
                tableName = answer;
                if (tableName === 'undefined' || tableName === undefined) {
                  reject('Table name cannot be undefined');
                } else {
                  eventEmitter.emit('tableName_obtained');
                }
              } catch (e) {
                reject(e);
              }
            })
            .catch((error) => {
              logger.error(error);
              reject('Error in creating table');
            });
        }
      });

      self.getBalance()
        .then((response) => {
          if (response.minimumAppBalance === true) {
            eventEmitter.emit('verified_balance');
          } else {
            logger.error('Error in creating new table: insufficient app balance.');
            logger.error(`A minimum of ${parseFloat((self.jupiter_data.minimumAppBalance) / (10 ** self.jupiter_data.moneyDecimals))} JUP is required to create a table with Gravity.`);
            eventEmitter.emit('insufficient_balance');
          }
        })
        .catch((error) => {
          logger.error('There was an error trying to create a new table in Jupiter.');
          logger.error(error);
          eventEmitter.emit('insufficient_balance');
        });
    });
  }

  // This class is meant to be used when creating tables from the command line
  createAppDatabase() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    let appname;
    let server;
    let password;
    let passphrase;

    logger.info('You are about to create a Gravity app. Please answer the following questions:');

    rl.question('What is the name of the app?\n', (answer1) => {
      appname = answer1;

      rl.question('Please provide an encryption password for your Jupiter data:\n', (answer2) => {
        password = answer2;
        rl.question('What is the URL/IP of your Jupiter server? Do not use IP unless you also use the port!\n', (answer) => {
          server = answer;
          const currentData = {
            'Name of the app': appname,
            'Password for encryption': password,
            'Jupiter server': server,
          };
          logger.info('Please verify the data you entered:');
          logger.info(JSON.stringify(currentData));
          logger.info('');
          rl.question("You are about to create a Jupiter account which will hold your Gravity app's data. Is the information provided above accurate? If so, press ENTER. If not, press CTRL+C to cancel and rerun command.\n", () => {
            passphrase = methods.generate_passphrase();

            axios.get(`${server}/nxt?requestType=getAccountId&secretPhrase=${passphrase}`)
              .then((response) => {
                const address = response.data.accountRS;
                const { publicKey } = response.data;

                if (address) {
                  const configuration = {
                    APPNAME: appname,
                    JUPITERSERVER: server,
                    APP_ACCOUNT: passphrase,
                    APP_ACCOUNT_ADDRESS: address,
                    APP_PUBLIC_KEY: publicKey,
                    ENCRYPT_ALGORITHM: 'aes-256-cbc',
                    ENCRYPT_PASSWORD: password,
                    APP_ACCOUNT_ID: publicKey,
                  };
                  const envVariables = configuration;
                  let envVariablesInString = '';
                  envVariables.SESSION_SECRET = 'session_secret_key_here';

                  const fs = require('fs');
                  // We prepare the string that will be used to create the .env file
                  Object.keys(envVariables).forEach((key) => {
                    envVariablesInString = `${envVariablesInString + key.toUpperCase()}='${envVariables[key]}'\n`;
                  });

                  fs.writeFile('.env', envVariablesInString, (error) => {
                    if (error) {
                      return logger.error(error);
                    }
                    logger.info('\nSuccess! .env file generated!');
                    logger.info('\nPlease write down the 12-word passphrase and account address assigned to your app as well as the password assigned for encryption (See .env or .gravity.js files). If you lose your passphrase or your encryption password, you will lose access to all saved data.');
                    logger.info('\nIn order to begin saving information into the Jupiter blockchain, you will need to obtain Jupiter tokens from https://exchange.darcr.us.');
                    rl.close();
                    return null;
                  });
                } else {
                  logger.info(response.data.message);
                  rl.close();
                }
              })
              .catch((error) => {
                logger.error(error);
                logger.error('There was an error in database creation');
                rl.close();
              });
          });
        });
      });
    });
  }
}


module.exports = {
  gravity: new Gravity(),
};
