const logger = require('./logger')(module)
const { words } = require('../config/_word_list')
const checksum = require('checksum')
const Decimal = require('decimal.js')
const NewAccountIp = require('../models/newAccountIp')
const moment = require('moment') // require
const axios = require('axios')
const { randomFillSync } = require('crypto')
const bcrypt = require('bcryptjs')
const _ = require('lodash')

/**
 *
 * @param value
 * @returns {string}
 */
const generateHash = function (value) {
  return bcrypt.hashSync(value, bcrypt.genSaltSync(8), null)
}

/**
 *
 * @param stringToParse
 * @return {*}
 */
const jsonParseOrPassThrough = function (stringToParse) {
  let json = null
  try {
    json = JSON.parse(stringToParse)
  } catch (error) {
    return stringToParse
  }
  return json
}

/**
 *
 * @param value
 * @return {boolean}
 */
const isNonEmptyString = function (value) {
  if (!isString(value)) {
    return false
  }
  if (value === '') {
    return false
  }
  return true
}

/**
 *
 * @param value
 * @return {boolean}
 */
const isString = function (value) {
  if (typeof value === 'string') {
    return true
  }
  return false
}

/**
 * Helper Function
 * @param obj
 * @returns {boolean}
 */
const isObject = function (obj) {
  return obj !== undefined && obj !== null && obj.constructor == Object
}

/**
 *
 * @param array
 * @returns {boolean}
 */
const isNonEmptyArray = function (array) {
  if (!Array.isArray(array)) {
    return false
  }

  if (array.length > 0) {
    return true
  }

  return false
}

/**
 *
 * @param array
 * @return {null|*}
 */
const arrayShiftOrNull = function (array) {
  if (!Array.isArray(array)) {
    return null
  }
  if (array.length === 0) {
    return null
  }
  return array.shift()
}

/**
 * @param {any} address - for example JUP-NFVU-KKGE-FFQF-7WT5G
 * @returns {boolean}
 */
const isWellFormedJupiterAddress = function (address) {
  if (!isNonEmptyString(address)) {
    return false
  }
  const re = /^JUP-\w\w\w\w-\w\w\w\w-\w\w\w\w-\w\w\w\w\w$/
  if (re.test(address)) {
    return true
  }
  return false
}

/**
 *
 * @param {any} alias
 * @return {boolean}
 */
const isWellFormedJupiterAlias = function (alias) {
  if (!isNonEmptyString(alias)) {
    return false
  }
  // must contain only digits and latin letters
  const re = /^([a-zA-Z]|[0-9])*$/
  if (re.test(alias)) return true
  return false
}

/**
 *
 * @param {any} addressOrAlias
 * @return {boolean}
 */
const isWellFormedJupiterAddressOrAlias = function (addressOrAlias) {
  if (isWellFormedJupiterAlias(addressOrAlias) || isWellFormedJupiterAddress(addressOrAlias)) {
    return true
  }
  return false
}

/**
 * 503065877100931330
 * @param {any} transactionId
 * @returns {boolean}
 */
const isWellFormedJupiterTransactionId = function (transactionId) {
  if (!transactionId) {
    return false
  }
  const re = /^[0-9]{15,25}$/
  if (re.test(transactionId)) {
    return true
  }
  return false
}

const arraysEqual = (a1, a2) => {
  if (!Array.isArray(a1) || !Array.isArray(a2)) {
    return false
  }
  /* WARNING: arrays must not contain {objects} or behavior may be undefined */
  return JSON.stringify(a1) === JSON.stringify(a2)
}

const isWellFormedE2EPublicKey = function (e2ePublicKey) {
  return !!e2ePublicKey
}

/**
 *          d7eb6f6854193941a7d45738e763331c28bd947956d7fe96b6b5969dea9af967
 * example: 0cd7ba1e744ab9aa316d02b45d14088e01d11906199fac34a9c4f0835902cb31
 * @param publicKey
 * @returns {boolean}
 */
const isWellFormedPublicKey = function (publicKey) {
  logger.verbose(`#### isWellFormedPublicKey(publicKey= ${publicKey})`)
  if (!publicKey) {
    // logger.warn('publicKey is empty');
    return false
  }

  if (typeof publicKey === 'undefined') {
    // logger.warn('publickey is undefined')
    return false
  }

  const re = /^[0-9A-Fa-f]{64}$/
  if (re.test(publicKey)) {
    return true
  }

  // logger.warn(`publickey is not well formed: ${publicKey}`)
  return false
}

/**
 *
 * @param accountId
 * @returns {boolean}
 */
const isWellFormedAccountId = function (accountId) {
  logger.verbose(`#### isWellFormedAccountId(accountId= ${accountId})`)
  if (!accountId) {
    logger.warn('accountId is empty')
    return false
  }

  if (typeof accountId === 'undefined') {
    logger.warn('accountId is undefined')
    return false
  }

  return true

  // const re = /^[0-9A-Fa-f]{64}$/
  // if(re.test(publicKey)){
  //     return true;
  // }
  //
  // logger.warn(`publickey is not well formed: ${publicKey}`)
  // return false;
}

/**
 *
 * @param {object} jupiterAccountData - { accountRS, publicKey, requestProcessingTime, account }
 * @returns {boolean}
 */
const isWellFormedJupiterAccountData = function (jupiterAccountData) {
  return true
}

/**
 *
 * @param uuid
 * @return {boolean}
 */
const isWellFormedUuid = function (uuid) {
  if (!uuid) {
    return false
  }
  const re = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/
  if (re.test(uuid)) {
    return true
  }
  return false
}

/**
 *
 * @param passphrase
 * @return {boolean}
 */
const isWellFormedPassphrase = function (passphrase) {
  if (!passphrase) {
    return false
  }
  const re = /^(\w+\s){11}\w+$/
  if (re.test(passphrase)) {
    return true
  }
  return false
}

/**
 *
 * @param number
 * @return {boolean}
 */
const isNumberGreaterThanZero = function (number) {
  if (typeof number !== 'number') return false
  if (number > 0) return true
  return false
}

/**
 *
 * @param key
 * @param json
 * @return {boolean}
 */
const jsonPropertyIsNonEmptyArray = function (key, json) {
  try {
    if (json[key] === undefined || json[key] == null || json[key].length === 0) {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

/**
 * The following is the code which will generate a list of 12 random words.
 * @returns {string}
 */
const generatePassphrase = function () {
  const numberOfWordsToGenerate = 12
  let wordsString = ''
  for (let i = 0; i < numberOfWordsToGenerate; i++) {
    wordsString += ` ${words[Math.floor(Math.random() * words.length)]}`
  }
  return wordsString.trim()
}

/**
 *
 * @param size
 * @return {string}
 */
const generateRandomBytes = function (size = 16) {
  const buf = Buffer.alloc(size)
  return randomFillSync(buf).toString('hex')
}

/**
 *
 * @return {string}
 */
const generateRandomPassword = function () {
  return Math.random() // Generate random number, eg: 0.123456
    .toString(36) // Convert  to base-36 : "0.4fzyo82mvyr"
    .substr(2, 8)
}

/**
 *
 * @param text
 * @return {*}
 */
const generateChecksum = (text) => {
  if (typeof text !== 'string') {
    throw new Error('text must be string')
  }

  return checksum(text)
}

/**
 *
 * @param stringToParse
 * @returns {null|*}
 */
const jsonParseOrNull = function (stringToParse) {
  let json = null
  try {
    json = JSON.parse(stringToParse)
  } catch (error) {
    return null
  }

  return json
}

/**
 *
 * @param nqt
 * @return {*}
 */
const formatNqt = function (nqt) {
  const formatter = Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'NQT',
    minimumFractionDigits: 0
  })
  return formatter.format(nqt)
}

/**
 *
 * @param jup
 * @return {*}
 */
const formatJup = function (jup) {
  const formatter = Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'JUP',
    minimumFractionDigits: 0
  })
  return formatter.format(jup)
}

/**
 *
 * @param usd
 * @return {*}
 */
const formatUsd = function (usd) {
  const formatter = Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  })
  return formatter.format(usd)
}

/**
 *
 * @param nqt
 * @param decimalPlaces
 * @return {*}
 */
const convertNqtToJup = function (nqt, decimalPlaces) {
  const bigNqt = new Decimal(nqt)
  const bigJup = bigNqt.div(Decimal.pow(10, decimalPlaces))
  return bigJup.toFixed()
}

/**
 *
 * @param jup
 * @param decimalPlaces
 * @return {number}
 */
const convertJupToNqt = function (jup, decimalPlaces) {
  return jup * Math.pow(10, decimalPlaces)
}

/**
 *
 * @param nqt
 * @param decimalPlaces
 * @return {Promise<*>}
 */
const convertNqtToUsd = async function (nqt, decimalPlaces) {
  const jup = convertNqtToJup(nqt, decimalPlaces)
  const oneJupToUsd = await getCurrentJupiterValueOrNull()
  const bigOneJupToUsd = new Decimal(oneJupToUsd)
  const usd = bigOneJupToUsd.times(jup)
  return usd.toFixed()
}

/**
 * @TODO come up with a strategy to ensure strong passwords
 * @param password
 * @return {boolean}
 */
const isStrongPassword = function (password) {
  if (_.isEmpty(password)) {
    return false
  }
  return true
}

/**
 *
 * @param promises
 * @returns {Promise<unknown>}
 */
const filterPromisesByRemovingEmptyResults = function (promises) {
  logger.verbose(`#### filterPromisesByRemovingEmptyResults(promises): promises.length= ${promises.length}`)

  return Promise.all(promises).then((results) => {
    const reduced = results.reduce((reduced, result) => {
      if (!result) {
        return reduced
      }
      reduced.push(result)
      return reduced
    }, [])
    logger.verbose(`filtered promises.length= ${reduced.length}`)
    return reduced
  })
}

/**
 *
 * @return {Promise<null|number>}
 */
const getCurrentJupiterValueOrNull = async function () {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=jupiter&vs_currencies=usd'
  const response = await axios({ url: url, method: 'GET' })
  if (
    response.hasOwnProperty('data') &&
    response.data.hasOwnProperty('jupiter') &&
    response.data.jupiter.hasOwnProperty('usd')
  ) {
    const usd = parseFloat(response.data.jupiter.usd)
    return usd
  }
  return null
}

/**
 *
 * @param jupAddress
 * @param alias
 * @param ipAddress
 * @return {newAccountIp}
 */
const ipLogger = function (jupAddress, alias, ipAddress) {
  logger.verbose(`#### ipLogger(jupAddress, alias, ipAddress) ${jupAddress}, ${alias}, ${ipAddress}`)
  if (!isWellFormedJupiterAddress(jupAddress)) {
    throw new Error('Jup address is not well formed')
  }

  if (!isWellFormedJupiterAlias(alias)) {
    throw new Error('Alias is not well formed')
  }

  if (!ipAddress) {
    throw new Error('IP address should not be empty or null')
  }

  const newAccountIp = { ipAddress, jupAddress, alias, timestamp: new Date() }
  NewAccountIp.create(newAccountIp)
    .then((result) => console.log('NewAccountIp successfully created', result))
    .catch((error) => logger.error(`Error saving logger record ${error}`))
  ipLoggerCleanUp()
}

const ipLoggerRepeatedIpAddress = function () {
  return NewAccountIp.aggregate([
    {
      $group: {
        _id: '$ipAddress',
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ])
}

/**
 *
 */
const ipLoggerCleanUp = function () {
  const currentDate = new Date()
  const sinceDate = moment(currentDate).subtract(24, 'hours').toDate()
  NewAccountIp.deleteMany({ timestamp: { $lt: sinceDate } })
    .then((result) => logger.info('NewAccountIp successfully removed'))
    .catch((error) => logger.error(`Error cleaning up logger record ${error}`))
}

module.exports = {
  isObject,
  jsonPropertyIsNonEmptyArray,
  generatePassphrase,
  isNumberGreaterThanZero,
  isWellFormedJupiterAddress,
  isWellFormedJupiterAddressOrAlias,
  isWellFormedJupiterAlias,
  isWellFormedPassphrase,
  isWellFormedAccountId,
  isWellFormedJupiterTransactionId,
  isWellFormedJupiterAccountData,
  isWellFormedPublicKey,
  jsonParseOrPassThrough,
  generateChecksum,
  generateHash,
  jsonParseOrNull,
  generateRandomPassword,
  isNonEmptyString,
  isString,
  isNonEmptyArray,
  arrayShiftOrNull: arrayShiftOrNull,
  filterPromisesByRemovingEmptyResults,
  isStrongPassword,
  formatJup,
  formatNqt,
  generateRandomBytes,
  convertNqtToJup,
  convertJupToNqt,
  convertNqtToUsd,
  formatUsd,
  getCurrentJupiterValueOrNull,
  isWellFormedE2EPublicKey,
  isWellFormedUuid,
  ipLogger,
  ipLoggerCleanUp,
  ipLoggerRepeatedIpAddress,
  arraysEqual
}
