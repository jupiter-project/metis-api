// const isWellFormedJupiterAccountData = require("./gravityUtils");


/**
 *
 * @param value
 * @return {boolean}
 */
const convertToBooleanOrFail = function (value) {
    if(value === 'true'){
     return true;
    }
    if(value === 'false'){
        return false;
    }
    throw new Error('Needs to have a value');
}

module.exports = {
    convertToBooleanOrFail: convertToBooleanOrFail,
};



