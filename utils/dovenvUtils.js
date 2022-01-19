
/**
 *
 * @param value
 * @return {boolean}
 */
const evaluateBoolean = function (value) {
    if(value.toLowerCase() === 'true'){
        return true;
    }
    if(value === '1'){
        return true;
    }
    if(value === 1){
        return true;
    }
    if(value === true){
        return true;
    }
    return false;
}

module.exports = {
    evaluateBoolean,
};



