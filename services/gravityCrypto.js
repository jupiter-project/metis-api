const logger = require('../utils/logger')(module);
const crypto = require('crypto');


class GravityCrypto {

    constructor(decryptionAlgorithm, decryptionPassword) {
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

        if(data === '') {
            throw new Error('the data to decrypt is empty');
        }

        if( !(typeof data === 'string')) {
            throw new Error('the data to decrypt is not a string');
        }

        const decipher = crypto.createDecipher(this.decryptionAlgorithm, this.decryptionPassword);
        let dec = decipher.update(data, 'hex', 'utf8');
        dec += decipher.final('utf8');

        return dec;
    }


    encryptJson(json){
        try {
            const jsonString = JSON.stringify(json);
            this.encrypt(jsonString);
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
            logger.info(`not able to decrypt. returning null.  ${error}`);
            return null;
        }
    }
}

module.exports.GravityCrypto = GravityCrypto;