const logger = require('../utils/logger')(module);
const crypto = require('crypto');
const gu = require('../utils/gravityUtils');


class GravityCrypto {

    constructor(decryptionAlgorithm, decryptionPassword) {
        if(!decryptionAlgorithm){throw new Error('missing decryptionAlgorithm')}
        if(!decryptionPassword){throw new Error('missing decryptionPassword')}

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
        // logger.verbose('################');
        // logger.verbose('## decrypt(data)');
        // logger.verbose('################');

        if(data === '') {
            throw new Error('the data to decrypt is empty');
        }

        if( !(typeof data === 'string')) {
            throw new Error('the data to decrypt is not a string');
        }

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
            logger.error(`not ablet to encrypt the json object`);
            throw error;
        }
    }

    encrypt(data) {
        if(data === '') {
            throw new Error('the data to decrypt is empty');
        }

        if( !(typeof data === 'string')) {
            throw new Error('the data to decrypt is not a string');
        }

        const cipher = crypto.createCipher(this.decryptionAlgorithm, this.decryptionPassword);
        let crypted = cipher.update(data, 'utf8', 'hex');
        crypted += cipher.final('hex');

        return crypted;
    }


    decryptOrNull(data) {
        try {
            return this.decrypt(data)
        } catch (error) {
            // logger.info(`not able to decrypt. returning null.  ${error}`);
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
        return gu.jsonParseOrNull(decryptedValue);
    }
}

module.exports.GravityCrypto = GravityCrypto;
