const logger = require('./logger')(module);
const {words} = require('../config/_word_list');
const checksum = require('checksum');
import bcrypt from 'bcrypt-nodejs';
import _ from 'lodash';


/**
 *
 * @param value
 * @returns {string}
 */
const generateHash = function (value) {
    return bcrypt.hashSync(value, bcrypt.genSaltSync(8), null);
}


const jsonParseOrPassThrough = function (stringToParse)
{
    let json = null;
    try{
        json = JSON.parse(stringToParse);
    } catch(error) {
        return stringToParse
    }

    return json;
};



const isNonEmptyString = function(value) {
    if(!isString(value)){return false}
    if (value === "") {return false}
    return true;
}

const isString = function(value){
    if((typeof value === 'string')){return true}
    return false;
}

/**
 * Helper Function
 * @param obj
 * @returns {boolean}
 */
const isObject = function (obj)
{
    return obj !== undefined && obj !== null && obj.constructor == Object;
};

/**
 *
 * @param array
 * @returns {boolean}
 */
const isNonEmptyArray = function(array)
{
    if (!Array.isArray(array)) {
        return false
    }

    if (array.length > 0) {
        return true
    }

    return false
}

const arrayShiftOrNull = function(array){
    if (!Array.isArray(array)) {
        return null;
    }
    if(array.length === 0){
        return null;
    }
    return array.shift();
}

/**
 * @param {any} address - for example JUP-NFVU-KKGE-FFQF-7WT5G
 * @returns {boolean}
 */
const isWellFormedJupiterAddress = function(address){
    if(!isNonEmptyString(address)){return false};
    const re = /^JUP-\w\w\w\w-\w\w\w\w-\w\w\w\w-\w\w\w\w\w$/;
    if(re.test(address)){
        return true;
    }
    return false;
}


/**
 *
 * @param {any} alias
 * @return {boolean}
 */
const isWellFormedJupiterAlias = function(alias){
    if(!isNonEmptyString(alias)){return false};
    // must contain only digits and latin letters)
    const re = /^([a-zA-Z]|[0-9])*$/;
    if(re.test(alias)){
        return true;
    }

    return false;
}

/**
 *
 * @param {any} addressOrAlias
 * @return {boolean}
 */
const isWellFormedJupiterAddressOrAlias = function(addressOrAlias){
    if(isWellFormedJupiterAlias(addressOrAlias) || isWellFormedJupiterAddress(addressOrAlias)){
        return true
    }
    return false
}

/**
 * 503065877100931330
 * @param {any} transactionId
 * @returns {boolean}
 */
const isWellFormedJupiterTransactionId = function(transactionId){
    if(!transactionId){return false}
    const re = /^[0-9]{15,25}$/
    if(re.test(transactionId)){
        return true;
    }
    return false;
}




/**
 *          d7eb6f6854193941a7d45738e763331c28bd947956d7fe96b6b5969dea9af967
 * example: 0cd7ba1e744ab9aa316d02b45d14088e01d11906199fac34a9c4f0835902cb31
 * @param publicKey
 * @returns {boolean}
 */
const isWellFormedPublicKey = function(publicKey) {
    logger.sensitive(`#### isWellFormedPublicKey(publicKey= ${publicKey})`);
    if(!publicKey){
        // logger.warn('publicKey is empty');
        return false;
    }

    if(typeof publicKey === 'undefined'){
        // logger.warn('publickey is undefined')
        return false;
    }

    const re = /^[0-9A-Fa-f]{64}$/
    if(re.test(publicKey)){
        return true;
    }

    // logger.warn(`publickey is not well formed: ${publicKey}`)
    return false;
}

/**
 *
 * @param accountId
 * @returns {boolean}
 */
const isWellFormedAccountId = function(accountId) {
    logger.sensitive(`#### isWellFormedAccountId(accountId= ${accountId})`);
    if(!accountId){
        logger.warn('accountId is empty');
        return false;
    }

    if(typeof accountId === 'undefined'){
        logger.warn('accountId is undefined')
        return false;
    }

    return true;

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
const isWellFormedJupiterAccountData = function(jupiterAccountData) {
    return true;
}


/**
 *
 * @param passphrase
 * @return {boolean}
 */
const isWellFormedPassphrase = function(passphrase){
    if(!passphrase){
        logger.sensitive(`passphrase not well formed! : ${passphrase}`)
        return false
    }
    const re = /^(\w+\s){11}\w+$/
    if(re.test(passphrase)){
        return true;
    }
    return false;
}

/**
 *
 * @param number
 * @return {boolean}
 */
const isNumberGreaterThanZero = function(number) {
    if(typeof number !== 'number'){
        return false;
    }

    if(number > 0){
        return true;
    }

    return false
}


const jsonPropertyIsNonEmptyArray = function (key, json) {
    try {
        if (json[key] === undefined
            || json[key] == null
            || json[key].length === 0) {
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
const generatePassphrase = function() {
    const numberOfWordsToGenerate = 12;
    let wordsString = ''
    for(let i = 0; i < numberOfWordsToGenerate; i++){
        wordsString += ` ${words[Math.floor(Math.random() * words.length)]}`;
    }
    return wordsString.trim();
}

const generateRandomPassword = function () {
    return Math.random()// Generate random number, eg: 0.123456
        .toString(36) // Convert  to base-36 : "0.4fzyo82mvyr"
        .substr(2, 8)
}

const generateChecksum = (text) => {
    if(typeof text !== 'string'){
        throw new Error('text must be string');
    }

    return checksum(text);
}

/**
 *
 * @param stringToParse
 * @returns {null|*}
 */
const jsonParseOrNull = function (stringToParse) {
    let json = null;
    try{
        json = JSON.parse(stringToParse);
    } catch(error) {
        return null;
    }

    return json;
};

const formatNQT = function(NQT){
    const formatter = Intl.NumberFormat(
        'de-DE',
        {
            style: 'currency',
            currency: 'NQT',
            minimumFractionDigits: 0
        }
    );
    return formatter.format(NQT);
}


/**
 * @TODO come up with a strategy to ensure strong passwords
 * @param password
 * @return {boolean}
 */
const isStrongPassword = function(password){
    if(_.isEmpty(password)){
        return false;
    }
    return true;
}

/**
 *
 * @param promises
 * @returns {Promise<unknown>}
 */
const filterPromisesByRemovingEmptyResults = function(promises){
    logger.verbose(`#### filterPromisesByRemovingEmptyResults(promises): promises.length= ${promises.length}`);

    return Promise.all(promises)
        .then( results => {
            const reduced =  results.reduce( (reduced, result) => {
                if(!result){ return reduced }
                reduced.push(result);
                return reduced;
            }, []);
            logger.verbose(`filtered promises.length= ${reduced.length}`)
            return reduced;
        })
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
    formatNQT
};



