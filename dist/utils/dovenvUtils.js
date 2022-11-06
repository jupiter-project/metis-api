// const isWellFormedJupiterAccountData = require("./gravityUtils");
/**
 *
 * @param value
 * @return {boolean}
 */ "use strict";
const convertToBooleanOrNull = function(value) {
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    return null;
// throw new Error(`Boolean conversion error: ${value}`);
};
module.exports = {
    convertToBooleanOrNull
};
