"use strict";
const logger = require('../utils/logger').default(module);
const crypto = require('crypto');
const { hasJsonStructure  } = require('../utils/utils');
class GravityCrypto {
    constructor(decryptionAlgorithm, decryptionPassword){
        if (!decryptionAlgorithm) {
            throw new Error('missing decryptionAlgorithm');
        }
        if (!decryptionPassword) {
            throw new Error('missing decryptionPassword');
        }
        if (decryptionPassword === undefined) {
            throw new Error('password cannot be undefined');
        }
        if (decryptionPassword === 'undefined') {
            throw new Error('password cannot be undefined');
        }
        if (decryptionAlgorithm === undefined) {
            throw new Error('decryptionAlgorithm cannot be undefined');
        }
        if (decryptionAlgorithm === 'undefined') {
            throw new Error('decryptionAlgorithm cannot be undefined');
        }
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
    /**
   * @deprecated
   * Decrypt data
   * @param data
   * @returns {string}
   */ decrypt(data) {
        if (data === '') throw new Error('the data to decrypt is empty');
        if (!(typeof data === 'string')) throw new Error('the data to decrypt is not a string');
        try {
            const decipher = crypto.createDecipher(this.decryptionAlgorithm, this.decryptionPassword);
            let dec = decipher.update(data, 'hex', 'utf8');
            dec += decipher.final('utf8');
            return dec;
        } catch (error) {
            throw new Error('unable to decrypt');
        }
    }
    encryptJson(json) {
        try {
            const jsonString = JSON.stringify(json);
            return this.encrypt(jsonString);
        } catch (error) {
            logger.error('not able to encrypt the json object');
            throw error;
        }
    }
    encryptJsonGCM(json) {
        try {
            const jsonString = JSON.stringify(json);
            return this.encryptGCM(jsonString);
        } catch (error) {
            logger.error('not able to encrypt the json object');
            throw error;
        }
    }
    /**
   * @deprecated
   * Encrypt data
   * @param data
   * @returns {string}
   */ encrypt(data) {
        if (data === '') {
            throw new Error('the data to decrypt is empty');
        }
        if (!(typeof data === 'string')) {
            throw new Error('the data to decrypt is not a string');
        }
        const cipher = crypto.createCipher(this.decryptionAlgorithm, this.decryptionPassword);
        let crypted = cipher.update(data, 'utf8', 'hex');
        crypted += cipher.final('hex');
        return crypted;
    }
    /**
   * Encrypting using AES-GCM
   * @param plainText
   * @returns {string}
   */ encryptGCM(plainText) {
        if (plainText === '') {
            throw new Error('the data to decrypt is empty');
        }
        if (!(typeof plainText === 'string')) {
            throw new Error('the data to decrypt is not a string');
        }
        const encryptionMethod = 'aes-256-gcm';
        // random initialization vector
        const iv = crypto.randomBytes(16);
        // random salt
        const salt = crypto.randomBytes(64);
        // derive encryption key: 32 byte key length
        // in assumption the masterkey is a cryptographic and NOT a password there is no need for
        // a large number of iterations. It may can replaced by HKDF
        // the value of 2145 is randomly chosen!
        const key = crypto.pbkdf2Sync(this.decryptionPassword, salt, 2145, 32, 'sha512');
        // AES 256 GCM Mode
        const cipher = crypto.createCipheriv(encryptionMethod, key, iv);
        // encrypt the given text
        const encrypted = Buffer.concat([
            cipher.update(plainText, 'utf8'),
            cipher.final()
        ]);
        // extract the auth tag
        const tag = cipher.getAuthTag();
        // generate output
        return Buffer.concat([
            salt,
            iv,
            tag,
            encrypted
        ]).toString('base64');
    }
    /**
   * Decrypting using AES-GCM
   * @param encdata
   * @returns {string}
   */ decryptGCM(encdata) {
        // base64 decoding
        const bData = Buffer.from(encdata, 'base64');
        // convert data to buffers
        const salt = bData.slice(0, 64);
        const iv = bData.slice(64, 80);
        const tag = bData.slice(80, 96);
        const text = bData.slice(96);
        const encryptionMethod = 'aes-256-gcm';
        // derive key using; 32 byte key length
        const key = crypto.pbkdf2Sync(this.decryptionPassword, salt, 2145, 32, 'sha512');
        // AES 256 GCM Mode
        const decipher = crypto.createDecipheriv(encryptionMethod, key, iv);
        decipher.setAuthTag(tag);
        // encrypt the given text
        return decipher.update(text, 'binary', 'utf8') + decipher.final('utf8');
    }
    decryptOrNullGCM(data) {
        try {
            return this.decryptGCM(data);
        } catch (error) {
            // logger.info(`**** Not able to decrypt. returning null.  ${error}`);
            return null;
        }
    }
    decryptOrNull(data) {
        try {
            return this.decrypt(data);
        } catch (error) {
            // logger.info(`**** Not able to decrypt. returning null.  ${error}`);
            return null;
        }
    }
    decryptOrPassThrough(data) {
        try {
            return this.decrypt(data);
        } catch (error) {
            return data;
        }
    }
    decryptOrPassThroughGCM(data) {
        try {
            return this.decryptGCM(data);
        } catch (error) {
            return data;
        }
    }
    /**
   *
   * @param data
   * @returns {*}
   */ decryptAndParseOrNull(data) {
        const decryptedValue = this.decryptOrPassThrough(data);
        try {
            return this.decryptAndParse(decryptedValue);
        } catch (error) {
            return null;
        }
    }
    /**
   *
   * @param data
   * @returns {*}
   */ decryptAndParseOrNullGCM(data) {
        const decryptedValue = this.decryptOrPassThroughGCM(data);
        try {
            return this.decryptAndParseGCM(decryptedValue);
        } catch (error) {
            return null;
        }
    }
    /**
   *
   * @param data
   * @returns {any}
   */ decryptAndParse(data) {
        const decryptedValue = this.decryptOrPassThrough(data);
        if (typeof decryptedValue === 'object') {
            return decryptedValue;
        }
        if (hasJsonStructure(decryptedValue)) {
            return JSON.parse(decryptedValue);
        }
        return decryptedValue;
    }
    /**
   *
   * @param data
   * @returns {any}
   */ decryptAndParseGCM(data) {
        const decryptedValue = this.decryptOrPassThroughGCM(data);
        return typeof decryptedValue === 'object' ? decryptedValue : JSON.parse(decryptedValue);
    }
}
module.exports.GravityCrypto = GravityCrypto;
