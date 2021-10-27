import gu from "../utils/gravityUtils";
import {applicationAccountProperties} from "../gravity/applicationAccountProperties";
import {FeeManager, feeManagerSingleton} from "./FeeManager";
import {jupiterAxios as axios} from "../config/axiosConf";
const logger = require('../utils/logger')(module);
const queryString = require('query-string');

class JupiterAPIService {
    /**
     *
     * @param {string} jupiterHost
     * @param {ApplicationAccountProperties} applicationAccountProperties
     */
    constructor(jupiterHost, applicationAccountProperties) {
        if(!jupiterHost){throw new Error('missing jupiterHost')}
        if(!applicationAccountProperties){throw new Error('missing applicationAccountProperties')}

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
    const url = `${this.jupiterHost}/nxt?`;
    const query = params ? queryString.stringify(params) : '';

    return url + query;
    }

    /**
     *
     * @param {string} rtype - GET POST PUT etc
     * @param {object} params - json object with all parameters
     * @param {object} data [data={}] - the payload to send
     * @returns {Promise<*>}
     */
    async jupiterRequest(rtype, params, data = {}) {
        const url = this.jupiterUrl(params);
        // logger.sensitive(`jupiterRequest > url= ${url}`);
        return new Promise((resolve, reject) => {
            axios({url: url, method: rtype, data: data})
                .then(response => {
                    if(response.error) {
                        logger.error(`jupiterRequest().response.error`)
                        logger.error(`error= ${JSON.stringify(response.error)}`);
                        logger.sensitive(`url= ${url}`)
                        logger.sensitive(`request data= ${JSON.stringify(data)}`)

                        return reject(response.error)
                    }

                    if(response.data && response.data.errorDescription  && response.data.errorDescription !== null) {
                        logger.error(`jupiterRequest().response.data.error`);
                        logger.sensitive(`response.data= ${JSON.stringify(response.data)}`);
                        logger.error(`error= ${JSON.stringify(response.data.errorDescription)}`)
                        logger.sensitive(`url= ${url}`)
                        logger.sensitive(`request data= ${JSON.stringify(data)}`)

                        return reject(response.data.errorDescription);
                    }

                    return resolve(response);
                })
                .catch( error => {
                    logger.error(`jupiterRequest().axios.catch(error)`)
                    logger.sensitive(`url= ${url}`);
                    logger.sensitive(`request data= ${JSON.stringify(data)}`)
                    logger.error(`error= ${error}`);

                    reject(error);
                })
        }  )

    }

    async get(params) {
        // logger.verbose('##########################');
        // logger.verbose(`## get(params)`)
        // logger.verbose('##');
        // logger.sensitive(`params=${JSON.stringify(params)}`);

        return this.jupiterRequest('get', params);
    }

    async post(params, data = {}) {
        // logger.verbose('##########################');
        // logger.verbose(`## post(params, data)`)
        // logger.verbose('##');
        // logger.sensitive(`params=${JSON.stringify(params)}`);
        // logger.sensitive(`data=${JSON.stringify(data)}`);

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
        return new Promise((resolve, reject) => {
            this.get({
                requestType: 'getAccountId',
                secretPhrase: passphrase,
            }).then( response => {
                resolve(response.data);
            })
        })
    }



    async getAliases(address){
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new Error(`Jupiter Address is not valid: ${address}`);
        }

        return new Promise((resolve, reject) => {
            this.post( {
                requestType: 'getAliases',
                account: address
            }).then( response =>{
                resolve(response.data.aliases);
            })
        })
    }





    /**
     *
     * @param address
     * @returns {Promise<*>}
     */
    async getAccount(address) {
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new Error(`Jupiter Address is not valid: ${address}`);
        }

        return this.post( {
            requestType: 'getAccount',
            account: address
        })
    };

    /**
     *
     * @param passphrase
     * @returns {Promise<unknown>}
     */
    async getAccountInformation(passphrase) {
        return new Promise((resolve, reject) => {
            this.getAccountId(passphrase)
                .then(response => {

                    if(!response){
                        logger.error('Theres a problem with getAccountId()');
                        logger.error(JSON.stringify(response));
                        throw new Error('There is a problem with getAccountId()')
                    }
                    // {"accountRS":"JUP-KMRG-9PMP-87UD-3EXSF","publicKey":"8435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb068","requestProcessingTime":0,"account":"1649351268274589422"}
                    const address = response.accountRS;
                    resolve({
                        address,
                        accountId: response.account,
                        publicKey: response.publicKey,
                        success: true,
                    })
                })
                .catch( error => {
                    logger.error(`********************************************`)
                    logger.error('** getAccountInformation().getAccountId().catch(error)')
                    logger.error('**')
                    logger.error(error);

                    reject({ success: false, message: 'There was an error in getting accountId information' });
                })
        })
    };

    /**
     *
     * @param {string} address - JUP-123
     * @param {string} message
     * @param {boolean} withMessage
     * @returns {Promise<*>} - { requestProcessingTime, transactions: [{signature, transactionIndex,type,phased,ecBlockId,
     * signatureHash,attachment: {encryptedMessage: {data, nonce, isText, isCompressed}, version.MetisMetaData,
     * version.EncryptedMessage},senderRS,subtype,amountNQT, recipientRS,block, blockTimestamp,deadline, timestamp,height,
     * senderPublicKey,feeNQT,confirmations,fullHash, version,sender, recipient, ecBlockHeight,transaction}]
     */
    async getBlockChainTransactions(address, message , withMessage = true ) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## getBlockChainTransactions(account: ${address})`);
        logger.verbose('##');
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new Error(`Jupiter address not valid: ${address}`);
        };

        return this.get( {
            requestType: 'getBlockchainTransactions',
            account: address,
            message,
            withMessage,
            type: 1
        });
    }


    /**
     *
     * @param {string} transactionId
     * @returns {Promise<*>}
     */
    async getTransaction(transactionId) {
        // logger.verbose('#####################################################################################');
        // logger.verbose(`## getTransaction(transactionId: ${transactionId})`);
        // logger.verbose('#####################################################################################');
        if(!gu.isWellFormedJupiterTransactionId(transactionId)){
            throw new Error(`Jupiter transaction id not valid: ${transactionId}`);
        };

        return this.get( {
            requestType: 'getTransaction',
            transaction: transactionId
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




    async sendSimpleNonEncipheredMessage(from, to, message, fee, prunable) {
        return this.sendSimpleNonEncipheredMessageOrMetisMessage('sendMessage', from, to, message, fee, null, prunable)
    }


    /**
     *
     * @param {GravityAccountProperties} from
     * @param {GravityAccountProperties} to
     * @param message
     * @param fee
     * @param subtype
     * @param prunable
     * @returns {Promise<*>}
     */
    async sendSimpleNonEncipheredMetisMessage(from, to, message, fee, subtype, prunable) {
        return this.sendSimpleNonEncipheredMessageOrMetisMessage('sendMetisMessage', from, to, message, fee, subtype, prunable)
    }





    /**
     * sends an enciphered, non-prunable , compressed message*
     * @param {GravityAccountProperties} from
     * @param {GravityAccountProperties} to
     * @param {string} message
     * @param {number} fee
     * @param {boolean} prunable
     * @returns {Promise<unknown>}
     */
    async sendSimpleNonEncipheredMessageOrMetisMessage(requestType, from, to, message, fee, subtype, prunable) {

        if(! (requestType == 'sendMessage' || requestType == 'sendMetisMessage' )){ throw new Error('invalid request type') }

        console.log(subtype)
        if(requestType == 'sendMetisMessage' && !subtype) {
            throw new Error('subtype is invalid');
        }

        return this.sendMetisMessageOrMessage(
            requestType,
            to.address,
            to.publicKey,
            from.passphrase,
            from.publicKey,
            fee,
            this.appProps.deadline,
            null,
            null,
            message,
            true,
            prunable,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            subtype
        )
    }


    /**
     * sends an enciphered, non-prunable , compressed message*
     * @param {GravityAccountProperties} from
     * @param {GravityAccountProperties} to
     * @param {string} message
     * @param {number} fee
     * @param {boolean} prunable
     * @returns {Promise<unknown>}
     */
    async sendSimpleEncipheredMessage(from, to, message, fee, prunable) {
        return this.sendSimpleEncipheredMessageOrMetisMessage('sendMessage', from, to, message, fee, prunable, null)
    }

    /**
     *
     * @param from
     * @param to
     * @param message
     * @param fee
     * @param prunable
     * @param subtype
     * @returns {Promise<*>}
     */
    async sendSimpleEncipheredMetisMessage(from, to, message, fee, subtype, prunable) {
        return this.sendSimpleEncipheredMessageOrMetisMessage('sendMetisMessage', from, to, message, fee, subtype, prunable)
    }


    async sendSimpleEncipheredMessageOrMetisMessage(requestType, from, to, message, fee, subtype, prunable ) {

        if(! (requestType == 'sendMessage' || requestType == 'sendMetisMessage' )){ throw new Error('invalid request type') }

        if(requestType == 'sendMetisMessage' && !subtype) {
            throw new Error('subtype is invalid');
        }

        return this.sendMetisMessageOrMessage(
            requestType,
            to.address,
            to.publicKey,
            from.passphrase,
            from.publicKey,
            fee,
            this.appProps.deadline,
            null,
            null,
            null,
            null,
            null,
            message,
            true,
            null,
            null,
            prunable,
            true,
            null,
            null,
            null,
            null,
            null,
            subtype
        )
    }


    /**
     * Send encrypted metis message and message
     * @param from
     * @param to
     * @param messageToEncrypt
     * @param message
     * @param fee
     * @param subtype
     * @param prunable
     * @param recipientPublicKey
     * @returns {Promise<*>}
     */
    sendEncipheredMetisMessageAndMessage(from, to, messageToEncrypt, message, fee, subtype, prunable, recipientPublicKey ) {
        return this.sendMetisMessageOrMessage(
            'sendMetisMessage',
            to,
            recipientPublicKey,
            from,
            null,
            fee,
            this.appProps.deadline,
            null,
            null,
            message,
            null,
            null,
            messageToEncrypt,
            true,
            null,
            null,
            prunable,
            true,
            null,
            null,
            null,
            null,
            null,
            subtype
        )
    }

    /**
     *
     * @param {string} recipient
     * @param {string} recipientPublicKey
     * @param {string} secretPhrase
     * @param {string} publicKey
     * @param {number} feeNQT
     * @param {number} deadline
     * @param {string} referencedTransactionFullHash
     * @param {string} broadcast
     * @param {string} message
     * @param {boolean} messageIsText
     * @param {boolean} messageIsPrunable
     * @param {string} messageToEncrypt
     * @param {boolean} messageToEncryptIsText
     * @param {string} encryptedMessageData
     * @param {string} encryptedMessageNonce
     * @param {boolean} encryptedMessageIsPrunable
     * @param {string} compressMessageToEncrypt
     * @param {string} messageToEncryptToSelf
     * @param {boolean} messageToEncryptToSelfIsText
     * @param {string} encryptToSelfMessageData
     * @param {string} encryptToSelfMessageNonce
     * @param {boolean} compressMessageToEncryptToSelf
     * @returns {Promise<unknown>}
     */
    async sendMetisMessageOrMessage(
        requestType,
        recipient,
        recipientPublicKey,
        secretPhrase,
        publicKey,
        feeNQT,
        deadline,
        referencedTransactionFullHash,
        broadcast,
        message,
        messageIsText,
        messageIsPrunable,
        messageToEncrypt,
        messageToEncryptIsText,
        encryptedMessageData,
        encryptedMessageNonce,
        encryptedMessageIsPrunable,
        compressMessageToEncrypt,
        messageToEncryptToSelf,
        messageToEncryptToSelfIsText,
        encryptToSelfMessageData,
        encryptToSelfMessageNonce,
        compressMessageToEncryptToSelf,
        subtype
    ) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## sendMetisMessageOrMessage(*)`);
        logger.verbose('#####################################################################################');

        let params = {}

        if(! (requestType === 'sendMessage' || requestType === 'sendMetisMessage' )){
            throw new Error('invalid request type')
        } else {
            params.requestType = requestType;
        }
        if(requestType === 'sendMetisMessage' && !subtype) {
            throw new Error('subtype is invalid');
        } else {
            params.subtype = subtype
        }
        if(recipient){ params.recipient = recipient } else { throw new Error('recipient is required') }
        if(recipientPublicKey){ params.recipientPublicKey = recipientPublicKey }
        if(secretPhrase){ params.secretPhrase = secretPhrase } else { throw new Error('secretPhrase is required')}
        // if(publicKey){ params.publicKey = publicKey } else { throw new Error('publicKey is required')}
        if(feeNQT){ params.feeNQT = feeNQT } else { throw new Error('feeNQT is required')}
        if(deadline){ params.deadline = deadline } else { throw new Error('deadline is required')}
        if(referencedTransactionFullHash){ params.referencedTransactionFullHash = referencedTransactionFullHash }
        if(broadcast){ params.broadcast = broadcast }
        if(message){ params.message = message }
        if(messageIsText || messageIsText === 'true'){ params.messageIsText = 'true'}
        if(messageIsPrunable){ params.messageIsPrunable = 'true'}
        if(messageToEncrypt){ params.messageToEncrypt = messageToEncrypt}
        if(messageToEncryptIsText){ params.messageToEncryptIsText = 'true'}
        if(encryptedMessageData){ params.encryptedMessageData = encryptedMessageData}
        if(encryptedMessageNonce){ params.encryptedMessageNonce = encryptedMessageNonce}
        if(encryptedMessageIsPrunable || encryptedMessageIsPrunable === 'true'){ params.encryptedMessageIsPrunable = 'true'}
        if(compressMessageToEncrypt || compressMessageToEncrypt == 'true' ){ params.compressMessageToEncrypt = 'true'}
        if(messageToEncryptToSelf){ params.messageToEncryptToSelf = messageToEncryptToSelf }
        if(messageToEncryptToSelfIsText){ params.messageToEncryptToSelfIsText = 'true'}
        if(encryptToSelfMessageData){ params.encryptToSelfMessageData = encryptToSelfMessageData}
        if(encryptToSelfMessageNonce){ params.encryptToSelfMessageNonce = encryptToSelfMessageNonce}
        if(compressMessageToEncryptToSelf  || compressMessageToEncryptToSelf == 'true' ){ params.compressMessageToEncryptToSelf = 'true'}

        return new Promise( (resolve, reject) => {
            this.post(null, params)
                .then((response) => {
                    logger.debug(`then()`);
                    if (response.data.broadcasted && response.data.broadcasted === true) {
                        return resolve(response);
                    }
                    logger.error(`then(error)`);
                    return reject({errorType: 'responseValueNotAsExpected', message: response});
                })
                .catch( error  => {
                    logger.error(`error()`);
                    return reject({errorType: 'requestError', message: error});
                });
        })
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
        logger.verbose('#####################################################################################');
        logger.verbose(`## transferMoney(fromProperties, toPropertie, amount, feeNQT)`);
        logger.verbose('## ');
        return new Promise((resolve, reject) => {
            if (!gu.isNumberGreaterThanZero(amount)) {
                return reject('problem with amount');
            }
            if(!fromJupiterAccount){
                return reject('problem with fromProperty');
            }

            if(!toJupiterAccount){
                return reject('problem with toProperties');
            }

            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
            logger.info(`++ Transferring Money`);
            logger.info(`++ from: ${fromJupiterAccount.address}`);
            logger.info(`++ to: ${toJupiterAccount.address}`);
            logger.info(`++ amount: ${amount}`);
            logger.info(`++ feeNQT: ${feeNQT}`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')

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

        // @TODO we need to create Custom Errors. for example: FundingNotConfirmedError

        if(!gu.isWellFormedPassphrase(passphrase)) {
            // @TODO we need to create Custom Errors
            throw new Error('Please provide a valid passphrase');
        }

        if(!gu.isWellFormedJupiterAddress(address)) {
            // @TODO we need to create Custom Errors. for example: FundingNotConfirmedError
            throw new Error('Please provide a valid address');
        }

        return this.get( {
            requestType: 'decryptFrom',
            secretPhrase: passphrase,
            account: address,
            data: dataToDecipher,
            nonce: nonce
        });

    }


    async getAlias(aliasName) {
        logger.verbose('#################################################')
        logger.verbose(`## getAlias(aliasName= ${aliasName})`);
        logger.verbose('##')

        if(!aliasName) {throw new Error('aliasName cannot be empty')}

        const params = {
            aliasName,
            requestType: 'getAlias',
        }

        return this.get(params)
    }


    async setAlias(params) {
        logger.verbose('#####################################################');
        logger.verbose(`## setAlias(params`);
        logger.verbose('##');
        logger.sensitive(`params=${JSON.stringify(params)}`);

        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.alias_assignment);
        if(!params.passphrase) {throw new Error('need a passphrase value')}
        if(!params.alias) {throw new Error('need an alias value')}
        if(!params.account) {throw new Error('need an account value')}

        const newParams = {
            requestType: 'setAlias',
            aliasName: params.alias,
            secretPhrase: params.passphrase,
            aliasURI: `acct:${params.account}@nxt`,
            feeNQT: fee,
            deadline: this.appProps.deadline
        }

        return this.post(newParams)
    }

}

module.exports.JupiterAPIService = JupiterAPIService;
module.exports.jupiterApiService = new JupiterAPIService(process.env.JUPITERSERVER, applicationAccountProperties)
