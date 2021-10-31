
const logger = require('./logger')(module);
const {words} = require('../config/_word_list');


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
    try {
        if (!Array.isArray(array)) {
            return false
        }

        if (array.length > 0) {
            return true
        }

        return false
    } catch(error){
        return false
    }
}

/**
 * example JUP-NFVU-KKGE-FFQF-7WT5G
 *         JUP-7WMJ-S9N6-3LQV-A3VCK
 * @param {string}  address
 * @returns {boolean}
 */
const isWellFormedJupiterAddress = function(address){

    return true;

    const re = /JUP-\w\w\w\w-\w\w\w\w-\w\w\w\w-\w\w\w\w\w/;
    if(re.test(address)){
        return true;
    }

    return false;
}

/**
 * 503065877100931330
 * @param {number} transactionId
 * @returns {boolean}
 */
const isWellFormedJupiterTransactionId = function(transactionId){
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

    return true; //@TODO Fix!!!

    const re = /^[0-9A-Fa-f]{64}$/
    if(re.test(publicKey)){
        return true;
    }


    return false;
}


/**
 *
 * @param {object} jupiterAccountData - { accountRS, publicKey, requestProcessingTime, account }
 * @returns {boolean}
 */
const isWellFormedJupiterAccountData = function(jupiterAccountData) {
    return true;
}


//@TODO please implement
const isWellFormedPassphrase = function(passphrase){

    return true;


    //^((\w+)\s){11}+\w+$
    const re = /^((\w+)\s){11}\w+$/
    if(re.test(passphrase)){
        return true;
    }

    return false;
}

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

module.exports = {
    isObject,
    jsonPropertyIsNonEmptyArray,
    generatePassphrase,
    isNumberGreaterThanZero,
    isWellFormedJupiterAddress,
    isWellFormedPassphrase,
    isWellFormedJupiterTransactionId,
    isWellFormedJupiterAccountData,
    isWellFormedPublicKey,
    jsonParseOrPassThrough,
};



