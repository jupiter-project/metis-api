const logger = require('../utils/logger')(module);
const gu = require("../utils/gravityUtils");
const crypto = require('crypto');

class GravityCrypto {

    constructor(decryptionAlgorithm, decryptionPassword) {
        if(!decryptionAlgorithm){throw new Error('missing decryptionAlgorithm')}
        if(!gu.isValidEncryptionAlgorithm(decryptionAlgorithm)) throw new mError.MetisError(`invalid algorithm: ${decryptionAlgorithm}`);
        if(!decryptionPassword){throw new Error('missing decryptionPassword')}
        if(decryptionPassword === undefined){throw new Error('password cannot be undefined')}
        if(decryptionPassword === 'undefined'){throw new Error('password cannot be undefined')}
        if(decryptionAlgorithm === undefined){throw new Error('decryptionAlgorithm cannot be undefined')}
        if(decryptionAlgorithm === 'undefined'){throw new Error('decryptionAlgorithm cannot be undefined')}
        this.decryptionAlgorithm = decryptionAlgorithm;
        this.decryptionPassword = decryptionPassword;
    }


    // decryptUsingApplicationAccount(data){
    //     return this.decrypt(data, this.password, this.algorithm)
    // }

    // encryptUsingApplicationAccount(data){
    //     return this.encrypt(data, this.password, this.algorithm)
    // }

    // decryptUsingApplicationAccountOrNull(data){
    //     try {
    //         return this.decryptUsingApplicationAccount(data)
    //     } catch(error){
    //         logger.error(`not able to decrypt ${error}`);
    //         return null;
    //     }
    // }

    decrypt(data) {
        if(data === '') throw new Error('the data to decrypt is empty');
        if( !(typeof data === 'string')) throw new Error('the data to decrypt is not a string');
        try {
            const decipher = crypto.createDecipher(this.decryptionAlgorithm, this.decryptionPassword);
            let dec = decipher.update(data, 'hex', 'utf8');
            dec += decipher.final('utf8');
            return dec;
        } catch (error){
            throw new Error('unable to decrypt');
        }
    }


    encryptJson(json){
        try {
            const jsonString = JSON.stringify(json);
            return this.encrypt(jsonString);
        } catch(error){
            logger.error(`not able to encrypt the json object`);
            logger.error(`${error}`)
            throw error;
        }
    }

    encrypt(data) {
        if(data === '') throw new Error('the data to decrypt is empty');
        if( !(typeof data === 'string')) throw new Error('the data to decrypt is not a string');
        const cipher = crypto.createCipher(this.decryptionAlgorithm, this.decryptionPassword);
        let crypted = cipher.update(data, 'utf8', 'hex');
        crypted += cipher.final('hex');
        return crypted;
    }


    decryptOrNull(data) {
        try {
            return this.decrypt(data)
        } catch (error) {
            // logger.info(`**** Not able to decrypt. returning null.  ${error}`);
            return null;
        }
    }

    decryptOrPassThrough(data) {
        try {
            return this.decrypt(data)
        } catch (error) {
            return data;
        }
    }

    /**
     *
     * @param data
     * @returns {*}
     */
    decryptAndParseOrNull(data){
        const decryptedValue = this.decryptOrPassThrough(data);
        try{
            return this.decryptAndParse(decryptedValue);
        } catch(error) {
            return null;
        }
    }

    /**
     *
     * @param data
     * @returns {any}
     */
    decryptAndParse(data){
        const decryptedValue = this.decryptOrPassThrough(data);
        return  JSON.parse(decryptedValue);
    }


}

module.exports.GravityCrypto = GravityCrypto;
