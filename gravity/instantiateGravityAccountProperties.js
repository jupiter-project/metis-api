// const {jupiterTransactionsService} = require("../services/jupiterTransactionsService");
const gu = require("../utils/gravityUtils");
const {GravityAccountProperties} = require("./gravityAccountProperties");
const {jupiterAccountService} = require("../services/jupiterAccountService");
const logger = require('../utils/logger')(module);
const encryptAlgorithm = process.env.ENCRYPT_ALGORITHM;

/**
 *
 * @param passphrase
 * @param password
 * @return {Promise<GravityAccountProperties>}
 */
module.exports.instantiateGravityAccountProperties = (passphrase, password) => {
    logger.sensitive(`#### instantiateGravityAccountProperties(passphrase, password=${password})`);
    if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is invalid')}
    if(!gu.isNonEmptyString(password)){throw new Error('password is invalid')}

    return jupiterAccountService.fetchAccountInfo(passphrase)
        .then(accountInfo => {
            if(!gu.isWellFormedJupiterAddress(accountInfo.address)){throw new Error('address is invalid')}
            if(!gu.isWellFormedPublicKey(accountInfo.publicKey)){throw new Error('publicKey is invalid')}
            if(!gu.isWellFormedAccountId(accountInfo.accountId)){throw new Error('accountId is invalid')}
            const properties =  new GravityAccountProperties(
                accountInfo.address,
                accountInfo.accountId,
                accountInfo.publicKey,
                passphrase,
                gu.generateHash(password),
                password,
                encryptAlgorithm
            );

            return jupiterAccountService.getAliasesOrEmptyArray(accountInfo.address)
                .then(aliases => {
                    properties.addAliases(aliases);
                    return properties;
                })
        }).catch( error => {
            logger.error(`***********************************************************************************`);
            logger.error(`** instantiateGravityAccountProperties().catch(error)`);
            logger.error(`** `);
            logger.error(`${error}`)

            throw error;
        })
}
