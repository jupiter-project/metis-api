// const isWellFormedJupiterAccountData = require("./gravityUtils");


/**
 *
 * @param value
 * @return {boolean}
 */
const convertToBooleanOrNull = function (value) {
    if(value === 'true'){
     return true;
    }
    if(value === 'false'){
        return false;
    }
    return null;
    // throw new Error(`Boolean conversion error: ${value}`);
}

module.exports = {
    convertToBooleanOrNull: convertToBooleanOrNull,
};



