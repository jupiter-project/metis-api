/* eslint-disable prefer-promise-reject-errors */
const { TableAccountProperties } = require('../gravity/tableAccountProperties')
const { feeManagerSingleton, FeeManager } = require('../services/FeeManager')
const logger = require('../utils/logger').default(module)

const gu = require('../utils/gravityUtils')
const { jupiterAPIService } = require('./jupiterAPIService')
const { jupiterTransactionsService } = require('./jupiterTransactionsService')
const { instantiateGravityAccountProperties } = require('../gravity/instantiateGravityAccountProperties')
const mError = require('../errors/metisError')

/**
 *
 */
class GravityTablesService {
  /**
   *
   * @param {GravityService} gravityService
   */
  constructor(gravityService, jupiterApiService) {
    if (!gravityService) {
      throw new Error('missing gravityService')
    }
    if (!jupiterApiService) {
      throw new Error('missing jupiterApiService')
    }

    this.gravityService = gravityService
    this.applicationTransactions = gravityService.applicationTransactions
    this.jupiterAccountService = gravityService.jupiterAccountService
    this.applicationAccountInfo = this.gravityService.applicationGravityAccountType
    this.jupiterApiService = jupiterApiService
  }

  /**
   *
   * @param mainTable
   * @param subTable
   * @returns {boolean}
   */
  tableIsSubsetOf(mainTable, subTable) {
    if (!this.isObject(mainTable) || !gu.isObject(subTable)) {
      throw new Error('function params need to be valid')
    }

    const mainTableString = mainTable.sort().join(',')
    const subTableString = subTable.sort().join(',')

    if (mainTableString.includes(subTableString)) {
      return true
    }
    return false
  }

  /**
   *
   * @param tables
   * @param tableName
   * @returns {boolean}
   */
  hasTable(tables, tableName) {
    let hasKey = false
    for (let x = 0; x < tables.length; x += 1) {
      const tableKeys = Object.keys(tables[x])
      if (tableKeys.includes(tableName)) {
        hasKey = true
        break
      }
    }

    return hasKey
  }

  /**
   *
   * @param databaseGravityAccountType
   * @param encryptedTableListRecord
   * @returns {Promise<unknown>}
   */
  async postTableListRecord(databaseGravityAccountType, encryptedTableListRecord) {
    return new Promise((resolve, reject) => {
      const feeNQT = this.jupiterAccountService.feeNQT / 2
      this.jupiterAccountService
        .postSimpleMessage(databaseGravityAccountType, encryptedTableListRecord, true, feeNQT)
        .then((res) => {
          if (res.data.broadcasted && res.data.broadcasted === true) {
            this.jupiterAccountService.provideInitialStandardFunds().then((response) => {
              logger.error('Needs Logic!!!')
              return reject('Needs Logic!')
            })
          }
          return reject(res)
        })
    })
  }

  /**
   *
   * @param databaseGravityAccountType
   * @param encryptedUserRecord
   * @param nameOfTableToAttach
   * @returns {Promise<unknown>}
   */
  async postUserRecord(databaseGravityAccountType, encryptedUserRecord, nameOfTableToAttach) {
    return new Promise((resolve, reject) => {
      this.jupiterAccountService.postSimpleMessage(databaseGravityAccountType, encryptedUserRecord).then((response) => {
        if (response.data.broadcasted && response.data.broadcasted) {
          logger.info(`Table ${nameOfTableToAttach} pushed to the blockchain and linked to your account.`)
          return resolve(response)
        }
        return reject(response)
      })
    })
  }

  /**
   *
   * @param nameOfTableToAttach
   * @param accountRS
   * @param publicKey
   * @param passphrase
   * @param databaseCrypto
   */
  constructAndEncryptUserRecord(nameOfTableToAttach, accountRS, publicKey, passphrase, databaseCrypto) {
    // ie {channels: {address, passphrase,public_key}
    const userRecord = {
      [nameOfTableToAttach]: {
        address: accountRS,
        passphrase,
        public_key: publicKey
      }
    }
    const encryptedUserRecord = databaseCrypto.encryptJson(userRecord)

    return encryptedUserRecord
  }

  /**
   *
   * @param database
   * @param nameOfTableToAttach
   * @param currentTables
   * @returns {Promise<unknown>}
   */
  async attachTable(database, nameOfTableToAttach, currentTables = []) {
    logger.verbose('#### attachTable(database, nameOfTableToAttach, currentTables=[])')
    logger.sensitive(`nameOfTableToAttach= ${JSON.stringify(nameOfTableToAttach)}`)
    logger.sensitive(`currentTables= ${JSON.stringify(currentTables)}`)
    return new Promise((resolve, reject) => {
      this.applicationTransactions
        .getAccountStatement()
        .then((accountStatement) => {
          logger.verbose('-----------------------------------------------------------------------------------')
          logger.verbose('-- attachTable().getAccountStatement().then()')
          logger.verbose('-- ')
          logger.sensitive(`accountStatement=${JSON.stringify(accountStatement)}`)

          if (!(accountStatement.hasMinimumAppBalance && accountStatement.hasMinimumTableBalance)) {
            return reject(accountStatement)
          }

          this.gravityService
            .getUserAccountData() // gravity.loadAppData
            .then((userAccountData) => {
              logger.verbose('-----------------------------------------------------------------------------------')
              logger.verbose('-- attachTable().getAccountStatement().then().getUserAccountData().then()')
              logger.verbose('-- ')
              logger.sensitive(`userAccountData=${JSON.stringify(userAccountData)}`)

              if (!gu.jsonPropertyIsNonEmptyArray('tables', userAccountData)) {
                return reject('Table name cannot be undefined')
              }

              const userAccountTableNames = userAccountData.tables // tableList

              if (currentTables.includes(nameOfTableToAttach) && userAccountTableNames.includes(nameOfTableToAttach)) {
                return reject(`Error: Unable to save table. ${nameOfTableToAttach} is already in the database`)
              }

              const passphrase = gu.generatePassphrase()
              logger.sensitive(`passphrase: ${passphrase}`)

              this.setUpNewGravityAccount(
                database.address,
                database.publicKey,
                nameOfTableToAttach,
                userAccountTableNames,
                passphrase,
                database.encryptionPassword,
                this.applicationAccountInfo.algorithm
              ).then((response) => {
                return resolve(response)
              })
            })
            .catch((error) => {
              logger.error(`${error}`)
              reject(error)
            })
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  /**
   *
   * @param database
   * @returns {*[]}
   */
  tableBreakdown(database) {
    const tableList = []
    for (let x = 0; x < database.length; x += 1) {
      const tableKeys = Object.keys(database[x])
      if (tableKeys.length > 0) {
        tableList.push(tableKeys[0])
      }
    }
    return tableList
  }

  /**
   *
   * @param appTables
   * @returns {null}
   */
  extractUsersTableFromAppTables(appTables) {
    logger.verbose('extractUsersTableFromAppTables()')
    logger.debug(appTables)

    Object.keys(appTables).forEach((table) => {
      if (appTables[table].users) {
        return appTables[table].users
      }
    })

    return null
  }

  /**
   *
   * @param records
   * @returns {null|*}
   */
  extractUsersTableFromRecords(records) {
    if (records.length === 0) {
      return null
    }
    const usersTable = records.filter((record) => record.users)
    return usersTable
  }

  /**
   *
   * @param records
   * @returns {null|*}
   */
  extractAccountRecordFromRecords(records) {
    logger.verbose('extractAccountRecordFromRecords()')
    if (records.length === 0) {
      return null
    }

    const accountRecords = records.filter((record) => record.user_record)
    if (accountRecords.length > 0) {
      return accountRecords[0].user_record
    }

    return null
  }

  /**
   *
   * @param records
   * @returns {{}}
   */
  extractTablesRetrievedFromRecords(records) {
    if (records.length === 0) {
      return {}
    }
    const tablesRetrieved = {}

    // console.log(records);

    for (let x = 0; x < Object.keys(records).length; x += 1) {
      // logger.debug(records[x]);
      // logger.debug(Object.keys(records[x]))
      // logger.debug(Object.keys(records[x])[0]);
      const objectKey = Object.keys(records[x])[0]
      if (tablesRetrieved[objectKey] === undefined) {
        tablesRetrieved[objectKey] = []
        tablesRetrieved[objectKey].push(records[x])
      } else {
        tablesRetrieved[objectKey].push(records[x])
      }
    }

    // console.log(tablesRetrieved.length)
    return tablesRetrieved
  }

  extractTableListFromRecords(records) {
    if (records.length === 0) {
      return []
    }
    return records.filter((record) => record.tables && record.date)
  }

  /**
   *
   * @param tableList
   * @returns {*[]}
   */
  extractCurrentListFromTableList(tableList) {
    logger.verbose('extractCurrentListFromTableList()')
    if (tableList.length === 0) {
      return []
    }
    let currentList = []

    for (let y = 0; y < Object.keys(tableList).length; y += 1) {
      if (tableList[y].tables.length > currentList.length) {
        if (currentList.length === 0) {
          currentList = tableList[y].tables
        } else if (this.tableIsSubsetOf(currentList, tableList[y].tables)) {
          currentList = tableList[y].tables
        }
      }
    }
    return currentList
  }

  /**
   *
   * @param currentListArray
   * @param tablesRetrievedJson
   * @returns {*[]}
   */
  extractTableData(currentListArray, tablesRetrievedJson) {
    if (currentListArray.length === 0 && Object.keys(tablesRetrievedJson).length === 0) {
      return []
    }
    const tableData = []

    for (let i = 0; i < Object.keys(currentListArray).length; i += 1) {
      const thisKey = currentListArray[i]
      if (tablesRetrievedJson[thisKey]) {
        // We need to sort the the list we are about to call
        this.sortBySubkey(tablesRetrievedJson[thisKey], thisKey, 'date')

        // Once we do this, we can obtain the last record and push to the tableData variable
        // NOTE: We'll expand validation of tables in future releases
        tableData.push(tablesRetrievedJson[thisKey][0])
      }
    }
    return tableData
  }

  /**
   *
   * @param array
   * @param key
   * @param subkey
   * @returns {*}
   */
  sortBySubkey(array, key, subkey) {
    return array.sort((a, b) => {
      const x = a[key][subkey]
      const y = b[key][subkey]
      const result = x !== undefined && x > y ? -1 : x === undefined || x < y ? 1 : 0

      return result
    })
  }
}

module.exports.GravityTablesService = GravityTablesService

class TableService {
  /**
   *
   * @param jupiterTransactionsService
   * @param jupiterAPIService
   */
  constructor(jupiterTransactionsService, jupiterApiService) {
    this.jupiterTransactionsService = jupiterTransactionsService
    this.jupiterApiService = jupiterApiService
  }

  // constructor( jupiterTransactionsService, jupiterAPIService ) {
  //     this.jupiterTransactionsService = jupiterTransactionsService;
  //     this.jupiterAPIService = jupiterAPIService;
  // }

  /**
   *
   * @param currentListArray
   * @param tablesRetrievedJson
   * @returns {*[]}
   */
  extractTableData(currentListArray, tablesRetrievedJson) {
    if (currentListArray.length === 0 && Object.keys(tablesRetrievedJson).length === 0) {
      return []
    }
    const tableData = []

    for (let i = 0; i < Object.keys(currentListArray).length; i += 1) {
      const thisKey = currentListArray[i]
      if (tablesRetrievedJson[thisKey]) {
        // We need to sort the the list we are about to call
        this.sortBySubkey(tablesRetrievedJson[thisKey], thisKey, 'date')

        // Once we do this, we can obtain the last record and push to the tableData variable
        // NOTE: We'll expand validation of tables in future releases
        tableData.push(tablesRetrievedJson[thisKey][0])
      }
    }
    return tableData
  }

  /**
   *
   * @param {GravityAccountProperties}accountProperties
   * @param {[]} arrayOfTableNames
   * @returns {Promise<{data, transactionReport: [{name, id}]}>}
   */
  async createTableListRecord(accountProperties, arrayOfTableNames) {
    logger.verbose(
      `#### tableService.createTableListRecord(accountProperties= ${accountProperties.address}, arrayOfTableNames=${arrayOfTableNames})`
    )
    const tablesList = {
      tables: arrayOfTableNames,
      date: Date.now()
    }
    const encrypted = accountProperties.crypto.encryptJson(tablesList)
    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record)
    const { subtype } = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record) // {type:1, subtype:12}
    return new Promise((resolve, reject) => {
      this.jupiterApiService
        .sendSimpleEncipheredMetisMessage(accountProperties, accountProperties, encrypted, fee, subtype, false)
        .then((response) => {
          // @TODO use extractTransactionId()
          resolve({
            responseData: response.data,
            transactionReport: { name: 'create-table-list-record', id: response.data.transaction }
          })
        })
    })
  }

  /**
   *
   * @param messages
   * @return {*[]|*}
   */
  extractLatestTableNamesFromMessages(messages) {
    logger.verbose(`#### extractLatestTableNamesFromMessages(messages): messages.length= ${messages.length})`)
    if (messages.length === 0) {
      logger.warn('empty messages. returning []')
      return []
    }
    const reducedMessages = messages.reduce((reduced, message) => {
      if (message.tables) {
        reduced.push(message)
        return reduced
      }
      return reduced
    }, [])

    logger.debug(`reducedMessages.length= ${reducedMessages.length}`)
    reducedMessages.sort(function (a, b) {
      return b.date - a.date
    }) // decending by date
    if (reducedMessages.length < 1) {
      return []
    }

    logger.sensitive(`Latest Table Names: ${JSON.stringify(reducedMessages[0].tables)}`)

    return reducedMessages[0].tables
  }

  // messages= [{"id":"2376166064047524148","user_record":"{\"id\":\"2376166064047524148\",\"account\":\"JUP-KMRG-9PMP-87UD-3EXSF\",\"accounthash\":\"$2a$08$61DAz/0mKPTxEPs6Mufr5.j3VVEKlI0BnolWMSQvJ3x9Qe5CZCAjW\",\"alias\":\"sprtz\",\"secret_key\":null,\"twofa_enabled\":false,\"twofa_completed\":false,\"api_key\":\"$2a$08$5swQ16YpeVGOF8oh.i8gDukGhf5fdsn.pjrJucKIy5TrQXS1x..AO\",\"encryption_password\":\"sprtz\"}","date":1625269463920},{"tables":["users","channels","invites","users"],"date":1625269444963},[{"users":{"address":"JUP-7WMJ-S9N6-3LQV-A3VCK","passphrase":"scratch neck before bullet glass hallway like sway very crush itself leg"}}],{"tables":["users","channels","invites"],"date":1625269431846},{"invites":{"address":"JUP-3GKU-CKKB-N5F5-FSTYJ","passphrase":"single commit gun screw beauty slice teeth six dad friendship paint autumn"}},{"tables":["users","channels"],"date":1625269431464},{"channels":{"address":"JUP-X5E2-MWPE-3FLC-GU3KU","passphrase":"look crimson some toward grand ask block holy tightly hello anyone lovely"}}]

  /**
   * {"users":{"address":"JUP-7WMJ-S9N6-3LQV-A3VCK","passphrase":"scratch neck before bullet glass hallway like sway very crush itself leg"}}
   * @param tableName
   * @param messages
   * @returns {null|*}
   */
  extractLatestTableFromMessages(tableName, messages) {
    logger.verbose(`##### extractLatestTableFromMessages(tableName= ${tableName}, messages= ${!!messages})  #####`)
    if (messages.length === 0) {
      return null
    }

    if (!tableName) {
      return null
    }

    const reducedMessages = messages.reduce((reduced, message) => {
      if (message[tableName]) {
        reduced.push(message[tableName])
        return reduced
      }
      return reduced
    }, [])

    if (reducedMessages.length < 1) {
      return null
    }
    // reducedMessages.sort(function(a, b){return b.date -a.date}); // decending by date
    // logger.debug(`reducedMessage= ${JSON.stringify(reducedMessages)}`);

    // @TODO there is no date property to get the latest table. Fix this!
    return reducedMessages[0]
  }

  extractTableListFromRecords(records) {
    if (records.length === 0) {
      return []
    }
    return records.filter((record) => record.tables && record.date)
  }

  /**
   *
   * @param tableName
   * @param tables
   * @returns {null|*}
   */
  extractTableFromTablesOrNull(tableName, tables) {
    logger.verbose('######################################')
    logger.verbose(`extractTableFromTablesOrNull(tableName= ${tableName}, tables)`)
    logger.verbose('######################################')

    if (!tableName) {
      return null
    }
    if (!tables) {
      return null
    }

    if (tables.length < 1) {
      return null
    }

    const filtered = tables.filter((tableProperties) => tableProperties.name === tableName)

    if (!filtered && filtered.length < 1) {
      return null
    }
    logger.debug(`found table: ${filtered[0].name}`)
    return filtered[0]
  }

  /**
   *
   * @param records
   * @returns {null|*}
   */
  extractTablePropertiesFromMessages(tableName, records) {
    logger.verbose('##############################################################')
    logger.verbose(`## extractAccountRecordFromRecords(tableName = ${tableName}, records= ${!!records})`)
    logger.verbose('##############################################################')
    if (records.length === 0) {
      return null
    }
    const recordName = `${tableName}_record`
    const accountRecords = records.filter((record) => record[recordName])
    if (accountRecords.length > 0) {
      return accountRecords[0][recordName]
    }

    return null
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
  extractRecordsFromMessages(messages) {
    logger.verbose(`#### extractRecordsFromMessages(messages): messges.length=${messages.length}`)
    // logger.debug(`  messages= ${JSON.stringify(messages)}`);
    // logger.sensitive(`extractedRecordsFromMessages= ${JSON.stringify(records)}`);
    return messages.reduce((reduced, message) => {
      const keys = Object.keys(message)
      for (let i = 0; i < keys.length; i++) {
        const re = /\w+_record/
        if (re.test(keys[i])) {
          // console.log('FOUND the key: ', keys[i]);
          let record = message[keys[i]]
          try {
            record = JSON.parse(message[keys[i]])
          } catch (error) {
            // do nothing
          }
          logger.insane(`record= ${JSON.stringify(record)}`)
          record.name = keys[i]
          record.date = message.date
          reduced.push(record)
          return reduced
        }
      }

      return reduced
    }, [])
  }

  /**
   * *  { id: '8381644747484745663',user_record:{"id":"123","account":"JUP-","accounthash":"123","email":"","firstname":"next"," +
   *      ""alias":"next","lastname":"","secret_key":null,"twofa_enabled":false,"twofa_completed":false,"api_key":"123",
   *      "encryption_password":"next"}, date: 1629813396685 },
   * @param {string} address
   * @param {{id,user_record:{id,account,accounthash,email,firstname,alias,lastname,secret_key,twofa_enabled,twofa_completed,api_key,encryption_password}, date }} records
   * @returns {null | GravityAccountProperties}
   */
  extractUserPropertiesFromRecordsOrNull(address, records) {
    if (!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address: ${address}`)
    // if(!gu.isWellFormedJupiterAddress(address)){throw new BadJupiterAddressError(address)}
    // if(!gu.isWellFormedJupiterAddress(address)){throw new Error('address is not valid')}
    if (!Array.isArray(records)) {
      throw new Error('records is not valid')
    }
    if (!records.hasOwnProperty('account')) {
      throw new Error('records is not valid')
    }
    if (!records.hasOwnProperty('secret_key')) {
      throw new Error('records is not valid')
    }
    if (!records.hasOwnProperty('encryption_password')) {
      throw new Error('records is not valid')
    }

    const record = records.filter((record) => record.account === address)

    if (record.length === 0) {
      return null
    }

    return instantiateGravityAccountProperties(record.secret_key, record.encryption_password)
  }

  /**
   *
   * @param messages
   * @returns {*[]}
   */
  extractTablesFromMessages(messages) {
    logger.verbose(`#### extractTablesFromMessages(messages.length= ${messages.length})`)
    if (messages.length === 0) {
      return []
    }
    const tableNames = this.extractLatestTableNamesFromMessages(messages)

    const unique = (value, index, self) => {
      return self.indexOf(value) === index
    }

    const uniqueTableNames = tableNames.filter(unique)
    const tables = []
    for (let i = 0; i < uniqueTableNames.length; i++) {
      const latestTable = this.extractLatestTableFromMessages(uniqueTableNames[i], messages) // { address: 'JUP----',passphrase:'single commit gun screw' }
      if (latestTable) {
        tables.push(
          new TableAccountProperties(
            uniqueTableNames[i],
            latestTable.address,
            latestTable.passphrase,
            latestTable.password
          )
        )
      }
    }
    // logger.sensitive(`tables= ${JSON.stringify(tables)}`);

    return tables
  }
}

module.exports.TableService = TableService
module.exports.tableService = new TableService(jupiterTransactionsService, jupiterAPIService)
