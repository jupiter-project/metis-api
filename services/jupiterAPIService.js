import gu from "../utils/gravityUtils";
const logger = require('../utils/logger')(module);
const axios = require('axios');
const queryString = require('query-string');

/**
 *
 *
 */
class JupiterAPIService {
    /**
     *
     * @param {string} jupiterHost
     * @param {ApplicationAccountProperties} applicationAccountProperties
     */
    constructor(jupiterHost, applicationAccountProperties) {
        this.jupiterHost = jupiterHost;
        this.appProps = applicationAccountProperties;
    }

    /**
     *
     * @param {object} givenParams
     * @returns {string}
     */
    jupiterUrl(givenParams) {
        const params = givenParams;
        // params.deadline = this.deadline;
        // params.feeNQT = this.feeNQT;
        const url = `${this.jupiterHost}/nxt?`;
        const query = queryString.stringify(params);
        return url + query
    }

    /**
     *
     * @param {string} rtype - GET POST PUT etc
     * @param {object} params - json object with all parameters
     * @param {object} data [data={}] - the payload to send
     * @returns {Promise<*>}
     */
    async jupiterRequest(rtype, params, data = {}) {
        // logger.debug(`jupiterRequest(rtype: ${rtype}, params: ${params}, data: ${data})`)
        const url = this.jupiterUrl(params);
        // logger.debug(url);

        return new Promise((resolve, reject) => {
            axios(url, rtype, data)
                .then(response => {
                    if(response.error) {
                        return reject(response)
                    }

                    if(response.data && response.data.errorDescription !== null) {
                        return reject(response);
                    }

                    return resolve(response);
                })
                .catch(error => {
                    reject(error);
                })
        }  )

    }

    async get(params) {
        return this.jupiterRequest('get', params);
    }

    async post(params, data = {}) {
        return this.jupiterRequest('post', params, data);
    }


    /**
     *
     * @param {string} address
     * @returns {Promise<*>}
     */
    async getAccountProperties(address) {
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new Error(`Jupiter address not valid: ${address}`);
        };

        return this.get({
            requestType: 'getAccountProperties',
            recipient: address,
        })
    }

    /**
     * If doesnt exists then create a new accountId.
     * @param {string} passphrase
     * @returns {Promise<object>} -
     */
    async getAccountId(passphrase) {
        if(!gu.isWellFormedPassphrase(passphrase)){
            throw new Error(`Jupier passphrase is not valid: ${passphrase}`);
        }
        return this.get({
            requestType: 'getAccountId',
            secretPhrase: passphrase,
        });
    }

    async getAccountInformation(passphrase) {
        return new Promise((resolve, reject) => {
            this.getAccountId(passphrase)
                .then(response => {
                    const address = response.data.accountRS;
                    resolve({
                        address,
                        accountId: response.data.account,
                        publicKey: response.data.publicKey,
                        success: true,
                    })
                })
                .catch( error => {
                    logger.error(error);
                    logger.info('There was an error in address creation');
                    reject({ success: false, message: 'There was an error in getting accountId information' });
                })
        })
    };

    /**
     *
     * @param {string} address - JUP-123
     * @returns {Promise<*>} - { requestProcessingTime, transactions: [{signature, transactionIndex,type,phased,ecBlockId,
     * signatureHash,attachment: {encryptedMessage: {data, nonce, isText, isCompressed}, version.MetisMetaData,
     * version.EncryptedMessage},senderRS,subtype,amountNQT, recipientRS,block, blockTimestamp,deadline, timestamp,height,
     * senderPublicKey,feeNQT,confirmations,fullHash, version,sender, recipient, ecBlockHeight,transaction}]
     */
    async getBlockChainTransactions(address) {
        logger.verbose(`_________________________________________________________________________`)
        logger.verbose(`getBlockChainTransactions(account: ${address})`);
        logger.verbose('-------------------------------------------------------------------------')
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new Error(`Jupiter address not valid: ${address}`);
        };

        return this.get( {
            requestType: 'getBlockchainTransactions',
            account: address,
            withMessage: true,
            type: 1
        });
    }









    /**
     *
     * @param {string} transactionId
     * @param {string} passphrase
     * @returns {Promise<{data: {encryptedMessageIsPrunable, decryptedMessage, requestProcessingTime}}>} - {encryptedMessageIsPrunable, decryptedMessage, requestProcessingTime} | {encryptedMessageIsPrunable,
     * errorDescription,errorCode,requestProcessingTime,error}
     */
    async getMessage(transactionId, passphrase) {
        return new Promise( (resolve, reject) => {
            this.get( {requestType: 'readMessage', transaction: transactionId, secretPhrase: passphrase})
                .then( response => {
                    if(response.data.errorCode){
                        return reject(response)
                    }
                    resolve(response);
                })
                .catch( error => reject(error))
        })
    }


// (response.data.errorCode) {}:


    async getBalance(address) {
        return this.get( {
            requestType: 'getBalance',
            account: address
        });
    }


    /**
     *
     * @param {JupiterAccountProperties} fromJupiterProperties
     * @param {JupiterAccountProperties} toJupiterProperties
     * @param {string} message
     * @param {boolean} encipher
     * @param {string} feeNQT
     * @returns {Promise<*>}
     */
    async sendMessage(fromJupiterProperties, toJupiterProperties,  message, encipher= true, feeNQT = this.appProps.feeNQT) {
        return this.postSimpleMessage(fromJupiterProperties, toJupiterProperties, message, encipher, feeNQT);
    }


    /**
     *
     * @param toJupiterProperties
     * @param fromJupiterProperties
     * @param message
     * @param feeNQT
     * @returns {Promise<*>}
     */
    async postEncipheredPrunableMessage(fromJupiterProperties, toJupiterProperties,message, feeNQT = this.appProps.feeNQT) {
        logger.verbose(`postSimplePrunableMessage()`);
        const isPrunable = true;
        const encipher = true;
        return this.postSimpleMessage(fromJupiterProperties, toJupiterProperties, message, encipher, feeNQT, isPrunable )
    }

    async postEncipheredMessage(fromJupiterProperties, toJupiterProperties,message, feeNQT = this.appProps.feeNQT) {
        logger.verbose(`postSimplePrunableMessage()`);
        const isPrunable = false;
        const encipher = true;
        return this.postSimpleMessage(fromJupiterProperties, toJupiterProperties, message, encipher, feeNQT, isPrunable )
    }

    /**
     *
     * @param {JupiterAccountProperties} toJupiterProperties
     * @param {JupiterAccountProperties} fromJupiterProperties
     * @param {string} message
     * @param {boolean} encipher
     * @param {string} feeNQT
     * @returns {Promise<*>}
     */
    async postSimpleMessage(fromJupiterProperties, toJupiterProperties, message, encipher= true, feeNQT = this.appProps.feeNQT, isPrunable = false) {
        logger.verbose(`postSimpleMessage()`);

        let params = {}

        if(isPrunable){
            params.encryptedMessageIsPrunable = 'true';
        }

        if(encipher){
            params.messageToEncrypt = message;
        } else {
            params.message = message;
        }

        return new Promise( (resolve, reject) => {
            this.post( {
                ...params,
                ...{
                    requestType: 'sendMessage',
                    secretPhrase: fromJupiterProperties.passphrase,
                    recipient: toJupiterProperties.address,
                    recipientPublicKey: toJupiterProperties.publicKey,
                    feeNQT: feeNQT,
                    deadline: this.appProps.deadline
                }
            })
                .then((response) => {
                    if (response.data.broadcasted && response.data.broadcasted === true) {
                        return resolve(response);
                    }
                    return reject({errorType: 'responseValueNotAsExpected', message: response});
                })
                .catch( error  => {
                    reject({errorType: 'requestError', message: error});
                });
        })
    }

    /**
     *
     * @param fromJupiterAccount
     * @param toJupiterAccount
     * @returns {Promise<unknown>}
     */
    async provideInitialStandardFunds(fromJupiterAccount, toJupiterAccount){
        logger.verbose(`provideInitialStandardFunds()`);

        logger.error('fix this!')
        const applicationJupiterAccount = this.sdf
        // const standardFeeNQT = 100;
        // const accountCreationFee = 750; // 500 + 250
        const initialAmount = this.appProps.minimumAppBalance - this.appProps.standardFeeNQT - this.appProps.accountCreationFeeNQT;

        return this.transferMoney(fromJupiterAccount, toJupiterAccount,initialAmount, this.appProps.standardFeeNQT);
    }


    /**
     *
     * @param fromJupiterAccount
     * @param toJupiterAccount
     * @param amount
     * @param feeNQT
     * @returns {Promise<unknown>}
     */
    async transferMoney(fromJupiterAccount, toJupiterAccount, amount, feeNQT = this.appProps.feeNQT) {
        logger.verbose(`transferMoney()`);
        return new Promise((resolve, reject) => {
            if (!gu.isNumberGreaterThanZero(amount)) {
                return reject();
            }
            if(fromJupiterAccount){
                return reject();
            }

            if(toJupiterAccount){
                return reject();
            }

            this.post( {
                requestType: 'sendMoney',
                recipient: toJupiterAccount.address,
                secretPhrase: fromJupiterAccount.passphrase, //fromAccount
                amountNQT:amount,
                feeNQT: feeNQT,
                deadline: this.appProps.deadline //60
            })
                .then(response =>{
                    if (response.data.signatureHash != null) {
                        return resolve(response);
                    }
                    logger.info('Cannot send Jupiter to new accountId, Jupiter issuer has insufficient balance!');
                    return reject(response);
                })
                .catch( error =>{
                    reject(error);
                })

        })
    }



//     if (recipientPublicKey) {
//         callUrl = `${this.jupiter_data.server}/nxt?requestType=sendMessage&secretPhrase=${passphrase}&recipient=${recipient}&messageToEncrypt=${dataToBeSent}&feeNQT=${this.jupiter_data.feeNQT}&deadline=${this.jupiter_data.deadline}&recipientPublicKey=${recipientPublicKey}&compressMessageToEncrypt=true`;
//     } else {
//     callUrl = `${this.jupiter_data.server}/nxt?requestType=sendMessage&secretPhrase=${passphrase}&recipient=${recipient}&messageToEncrypt=${dataToBeSent}&feeNQT=${this.jupiter_data.feeNQT}&deadline=${this.jupiter_data.deadline}&messageIsPrunable=true&compressMessageToEncrypt=true`;
// }




    /**
     *
     * @param {string} dataToDecipher
     * @param {string} address
     * @param {string} passphrase - 12 word passphrase
     * @param {string} nonce
     * @returns {Promise<*>}
     */
    async getDecipheredData(dataToDecipher, address, passphrase, nonce){
        logger.verbose('getDecipheredData()')

        // @TODO need to validate all params!!!

        if(!gu.isWellFormedPassphrase(passphrase)) {
            throw new Error();
        }


        if(!gu.isWellFormedJupiterAddress(address)) {
            throw new Error();
        }


        return this.get( {
            requestType: 'decryptFrom',
            secretPhrase: passphrase,
            account: address,
            data: dataToDecipher,
            nonce: nonce
        });

    }

}

module.exports.JupiterAPIService = JupiterAPIService;