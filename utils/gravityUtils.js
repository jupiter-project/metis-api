
const logger = require('./logger')(module);
const { words } = require('../config/_word_list');


/**
 * Helper Function
 * @param obj
 * @returns {boolean}
 */
const isObject = function (obj) {
  return obj !== undefined && obj !== null && obj.constructor === Object;
};


// @TODO please implement
const isWellFormedJupiterAddress = function (address) {
  return true;
};


const isWellFormedJupiterTransactionId = function (address) {
  return true;
};

// @TODO please implement
const isWellFormedTransaction = function (transaction) {
  return true;
};

/**
 *
 * @param {object} jupiterAccountData - { accountRS, publicKey, requestProcessingTime, account }
 * @returns {boolean}
 */
const isWellFormedJupiterAccountData = function (jupiterAccountData) {
  return true;
};


// @TODO please implement
const isWellFormedPassphrase = function (passphrase) {
  return true;
};

const isNumberGreaterThanZero = function (number) {
  if (typeof number !== 'number') {
    return false;
  }

  if (number > 0) {
    return true;
  }

  return false;
};


const jsonPropertyIsNonEmptyArray = function (key, json) {
  try {
    if (json[key] === undefined
            || json[key] == null
            || json[key].length === 0) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * The following is the code which will generate a list of 12 random words.
 * @returns {string}
 */
const generatePassphrase = function () {
  const numberOfWordsToGenerate = 12;
  let wordsString = '';
  for (let idx = 0; idx < numberOfWordsToGenerate; idx++) {
    wordsString += ` ${words[Math.floor(Math.random() * words.length)]}`;
  }
  return wordsString.trim();
};

module.exports = {
  isObject,
  jsonPropertyIsNonEmptyArray,
  generatePassphrase,
  isNumberGreaterThanZero,
  isWellFormedJupiterAddress,
  isWellFormedPassphrase,
  isWellFormedJupiterTransactionId,
  isWellFormedJupiterAccountData,
  isWellFormedTransaction,
};
