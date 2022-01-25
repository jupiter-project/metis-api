// const {jupiterTransactionsService} = require("../services/jupiterTransactionsService");
const gu = require("../utils/gravityUtils");
const {GravityAccountProperties} = require("./gravityAccountProperties");
const {jupiterAccountService} = require("../services/jupiterAccountService");
const mError = require("../errors/metisError");
const {GravityCrypto} = require("../services/gravityCrypto");
const {metisConf} = require("../config/metisConf");
const logger = require('../utils/logger')(module);
const encryptAlgorithm = process.env.ENCRYPT_ALGORITHM;

/**
 *
 * @param passphrase
 * @param password
 * @param address
 * @return {GravityAccountProperties}
 */
module.exports.instantiateMinimumGravityAccountProperties = (passphrase,password,address) => {
    logger.verbose(`#### instantiateGravityAccountProperties(passphrase, password)`);
    if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is invalid')}
    if(!gu.isNonEmptyString(password)){throw new Error('password is invalid')}
    if(!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address: ${address}`)
    // if(!gu.isWellFormedJupiterAddress(address)){throw new BadJupiterAddressError(address)}
    logger.sensitive(`password=${password}`);
    return new GravityAccountProperties(
        address,
        null,
        null,
        passphrase,
        password,
        metisConf.appPasswordAlgorithm
    );
}


/**
 * @description Using the passphrase fetch the jupiter account information from the blockchain along with any aliases associated with
 * this account.
 * @param {string} passphrase
 * @param {string} password
 * @return {Promise<GravityAccountProperties>}
 */
module.exports.instantiateGravityAccountProperties = (passphrase, password) => {
    logger.verbose(`#### instantiateGravityAccountProperties(passphrase, password)`);
    if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is invalid.')}
    if(!gu.isNonEmptyString(password)){throw new Error('password is invalid')}
    return jupiterAccountService.fetchAccountInfo(passphrase)
        .then(accountInfo => {
            // if(!gu.isWellFormedJupiterAddress(accountInfo.address)){throw new BadJupiterAddressError(accountInfo.address)}
            if(!gu.isWellFormedJupiterAddress(accountInfo.address)) throw new mError.MetisErrorBadJupiterAddress(`accountInfo.address: ${accountInfo.address}`)
            if(!gu.isWellFormedPublicKey(accountInfo.publicKey)){throw new Error('publicKey is invalid')}
            if(!gu.isWellFormedAccountId(accountInfo.accountId)){throw new Error('accountId is invalid')}
            const properties =  new GravityAccountProperties(
                accountInfo.address,
                accountInfo.accountId,
                accountInfo.publicKey,
                passphrase,
                password,
                metisConf.appPasswordAlgorithm
            );
            return jupiterAccountService.getAliasesOrEmptyArray(accountInfo.address)
                .then(aliases => {
                    properties.addAliases(aliases);
                    return properties;
                });
        }).catch( error => {
            logger.error(`***********************************************************************************`);
            logger.error(`** instantiateGravityAccountProperties().catch(error)`);
            logger.error(`***********************************************************************************`);
            logger.error(`${error}`)

            throw error;
        })
}

/**
 *
 * @return {Promise<void>}
 */
module.exports.refreshGravityAccountProperties= async (properties) => {
    const accountInfo = await jupiterAccountService.fetchAccountInfo(properties.passphrase);
    properties.address = accountInfo.address;
    properties.accountId = accountInfo.accountId;
    properties.publicKey = accountInfo.publicKey;
    properties.passwordHash =  gu.generateHash(properties.password);
    properties.crypto = new GravityCrypto(properties.algorithm, properties.password);
    const aliases = await jupiterAccountService.getAliasesOrEmptyArray(accountInfo.address);
    properties.removeAllAliases();
    properties.addAliases(aliases);
    properties.isMinimumProperties = false;
}
