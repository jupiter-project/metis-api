import gu from "../utils/gravityUtils";
import {metisApplicationAccountProperties} from "../gravity/applicationAccountProperties";
import {FeeManager, feeManagerSingleton} from "./FeeManager";
import {jupiterAxios as axios} from "../config/axiosConf";
const logger = require('../utils/logger')(module);
const queryString = require('query-string');

/**
 *
 */
class JupiterAPIService {
    /**
     *
     * @param {string} jupiterHost
     * @param {ApplicationAccountProperties} applicationAccountProperties
     */
    constructor(jupiterHost, applicationAccountProperties) {
        if(!jupiterHost){throw new Error('missing jupiterHost')}
        if(!applicationAccountProperties){throw new Error('missing appAccountProperties')}

        this.jupiterHost = jupiterHost;
        this.appProps = applicationAccountProperties;
    }

    static get requestTypes() {
        return {sendMetisMessage: 'sendMetisMessage'}
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
    jupiterRequest(rtype, params, data = {}) {
        const url = this.jupiterUrl(params);
        return new Promise((resolve, reject) => {
            return axios({url: url, method: rtype, data: data})
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
        return this.jupiterRequest('get', params);
    }

    post(params, data = {}) {
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
    logger.verbose(`###################################################################################`);
    logger.verbose(`## getAccountId(passphrase)`);
    logger.verbose(`## `);
    logger.sensitive(`passphrase=${JSON.stringify(passphrase)}`);

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


    /**
     *
     * @param {string} address
     * @returns {Promise<{status, statusText,headers, config, request, data:
     *                      {aliases: [{aliasURI, aliasName, accountRS, alias, account, timestamp}],requestProcessingTime}
     *                  }>}
     */
    async getAliases(address){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getAliases(address)`);
        logger.verbose(`## `);
        logger.sensitive(`address=${JSON.stringify(address)}`);
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new Error(`Jupiter Address is not valid: ${address}`);
        }

        return this.post( {
                requestType: 'getAliases',
                account: address
            })
    }

    /**
     *
     * @param {string} address
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
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getAccountInformation(passphrase)`);
        logger.verbose(`## `);
        logger.sensitive(`passphrase=${JSON.stringify(passphrase)}`);
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
                    logger.error(`${error}`);

                    reject({ success: false, message: 'There was an error in getting accountId information' });
                })
        })
    };

    /**
     * All parameters: account,timestamp,type, subtype, firstIndex, lastIndex, numberOfConfirmations, withMessage,
     * phasedOnly, nonPhasedOnly, includeExpiredPrunable, includePhasingResult, executedOnly, message, requireBlock,
     * requireLastBlock
     *
     * @param {string} address - JUP-123
     * @param {string} message
     * @param {boolean} withMessage
     * @returns {Promise<*>} - { requestProcessingTime, transactions: [{signature, transactionIndex,type,phased,ecBlockId,
     * signatureHash,attachment: {encryptedMessage: {data, nonce, isText, isCompressed}, version.MetisMetaData,
     * version.EncryptedMessage},senderRS,subtype,amountNQT, recipientRS,block, blockTimestamp,deadline, timestamp,height,
     * senderPublicKey,feeNQT,confirmations,fullHash, version,sender, recipient, ecBlockHeight,transaction}]
     */
    async getBlockChainTransactions(address, message = null , withMessage = false, type = 1 , includeExpiredPrunable = true) {
        logger.sensitive(`#### getBlockChainTransactions(address= ${address}, message= ${message}, witMessage: ${!!withMessage}, type, includeExpiredPrunable)`);
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new Error(`Jupiter address not valid: ${address}`);
        }

        let params = {
            requestType: 'getBlockchainTransactions',
            account: address,
            type,
            withMessage,
            includeExpiredPrunable
        };

        if(withMessage && message){
            params = {...params, message}
        }

        return this.get( params);
    }




// {
//     "unconfirmedTransactions": [
//         {
//             "senderPublicKey": "c4fcfcb539ddd131db025923fdecdfb478feadd8fadfe5cc122f6ebb45bf5077",
//             "signature": "2cd667757ea07d266954fdc4822e05298854f87fde6d98159412cb8c26a0350983609ab3bd05c24ff35099aad112de060121653524d76c5cfa2fc8eb82fb98ce",
//             "feeNQT": "317500",
//             "type": 1,
//             "fullHash": "5d72d3a87dea7f8ea52fa7e64a233de4d2d4dec85b21156edd4771c267a53c84",
//             "version": 1,
//             "phased": false,
//             "ecBlockId": "9892207482531449821",
//             "signatureHash": "26bed089b5fdd24da101074da7e07f4cb36cec6aafac2687ab4b1ff38eda3d30",
//             "attachment": {
//                 "version.Message": 1,
//                 "encryptedMessage": {
//                     "data": "e07aa1d7ff92e606d07c91ecb3ea3f68b951eb27a27984f02f806a791bf108d584e59ea46ba477ec7385cb1c466b70c30c11ece5efedf1a44f79db6163ee66d0fbf9b6d5011cf05da93bf89c4924ba8f3848256d66c1c5c38247785ba2e31330",
//                     "nonce": "57a891f80b63a457ced76aac2265729c91841d0dd52e81863477265978d71af4",
//                     "isText": true,
//                     "isCompressed": true
//                 },
//                 "version.EncryptedMessage": 1,
//                 "version.PublicKeyAnnouncement": 1,
//                 "recipientPublicKey": "c4fcfcb539ddd131db025923fdecdfb478feadd8fadfe5cc122f6ebb45bf5077",
//                 "version.MetisAccountInfo": 0,
//                 "messageIsText": true,
//                 "message": "v1.metis.channel.public-key.list"
//             },
//             "senderRS": "JUP-4MT8-CKA7-EYPY-3P49S",
//             "subtype": 12,
//             "amountNQT": "0",
//             "sender": "2025587753023000358",
//             "recipientRS": "JUP-4MT8-CKA7-EYPY-3P49S",
//             "recipient": "2025587753023000358",
//             "ecBlockHeight": 508333,
//             "deadline": 60,
//             "transaction": "10268183500852261469",
//             "timestamp": 129535844,
//             "height": 2147483647
//         },
    /**
     * Currently the getUnconfirmedTransactions doesnt handle withMessage+Message.
     *
     * @param address
     * @param message
     * @param withMessage
     * @param type
     * @param includeExpiredPrunable
     * @returns {Promise<{
     *          unconfirmedTransactions: [
     *              {senderPublicKey,signature,feeNQT,type,fullHash,version,phased,ecBlockId,signatureHash, attachment: {
     *                  versionMessage,encryptedMessage: {data,nonce,isText,isCompressed},
     *                  versionEncryptedMessage,versionPublicKeyAnnouncement,recipientPublicKey,versionMetisAccountInfo,messageIsText,message},
     *               senderRS,subtype,amountNQT,sender,recipientRS,recipient,ecBlockHeight,deadline,transaction,timestamp,height}],
     *           requestProcessingTime }
     *           >}
     */
    async getUnconfirmedBlockChainTransactions(address, message = null, withMessage = false, type = 1, includeExpiredPrunable = true) {
        logger.sensitive(`#### getUnconfirmedBlockChainTransactions(address= ${address}, message= ${message}, witMessage: ${!!withMessage}, type, includeExpiredPrunable)`);
        if(!gu.isNonEmptyString(address)){throw new Error('address is empty')}
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new Error(`Jupiter address not valid: ${address}`);
        }

        let params = {
            requestType: 'getUnconfirmedTransactions',
            account: address,
            type,
            withMessage,
            includeExpiredPrunable
        };

        if(withMessage && message){ params = {...params, message}}

        return this.get( params);
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
     *
     * @description {
     * "encryptedMessageIsPrunable": false,
     * "decryptedMessage": "d12a43fa680ff6390e00707c7a0dc4aa07e0bc0e710647f8d973e9bf428e40383ca43682c61a5edcdf67cd6979ae5ee8b7da41ba1e4ce46548ff9334d76a32b26e8750ac20a146676202ca091f5f31000709a08b6d744ce91f1fbf1876a63ea0f851cc57453f2b747953372fe985ac27c3590ca28c5ea6a4e3821a045eb1a50dd90a9e7aae341c30aef2ed3401b5ca8219de379ed33f12ae9a5a348620172dd011fdf4bcc31a983f5a0978d213c100e9c0128b851a353bc7fdc08e859ebd516df1eccc352aab7e28491195e85f024634a72acb090a8565705d90a813fd82a1b9b045fb6f77a01f11ba318f0fb16e3458915e529f23cbcc10690f67dd715fc75f428ef8e30635ffc0d9fbdd843a406a68d2279eed0fea227b10327a8269ca96b25a7c571e5118f3f2a0560c65b93df49ee5bb1d9318966d9c98b93470485f697d27d95093e4db01a60d5927fbc48e6b730fa210b13ce503a8d6f532625df13d9ab3dc29d01348ff177dfbf562c969a0ad7c2467b180d5a598e63ebec320ff1f40f2911469fd581250a47fa081868e8c4e89c57c8f78c23f6a6f64264b3c1e5b4c0ea45dd97ed80dbf22e592a43716c3900bd4ce5b0717baee6d55f6656e584faa871261c0b48ad5982e2834f7793f2253004de1521da2112ee4939fa5a599445484cd9425f14206b4e0534db4d7d835ee",
     * "requestProcessingTime": 1
     *
     * {"encryptedMessageIsPrunable":false,"errorDescription":"Wrong secretPhrase or sharedKey: pad block corrupted","errorCode":4,"requestProcessingTime":1,"error":"java.lang.RuntimeException: pad block corrupted"}
     *{
     * "encryptedMessageIsPrunable": false,
     * "errorDescription": "Wrong secretPhrase or sharedKey: pad block corrupted",
     * "errorCode": 4,
     * "requestProcessingTime": 2,
     * "error": "java.lang.RuntimeException: pad block corrupted"
     * }
     * @param {string} transactionId
     * @param {string} passphrase
     * @returns {Promise<{data: {encryptedMessageIsPrunable, decryptedMessage, requestProcessingTime}} | {encryptedMessageIsPrunable,errorDescription,errorCode,requestProcessingTime,error}>}
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
        logger.verbose('#####################################################################################');
        logger.verbose(`## sendSimpleNonEncipheredMetisMessage(from: ${from}, to: ${to}, message, fee=${fee}, subtype=${subtype}, prunable=${prunable})`);
        logger.verbose('##');
        logger.sensitive(`message= ${message}`);

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
        logger.verbose('#####################################################################################');
        logger.verbose(`## sendSimpleNonEncipheredMessageOrMetisMessage(requestType: ${requestType}, from: ${from}, to: ${to}, message, fee=${fee}, subtype=${subtype}, prunable=${prunable})`);
        logger.verbose('##');
        logger.sensitive(`message= ${message}`);

        if(! (requestType == 'sendMessage' || requestType == 'sendMetisMessage' )){ throw new Error('invalid request type') }
        if(requestType == 'sendMetisMessage' && !subtype) {throw new Error('subtype is invalid')}

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
        logger.verbose('#####################################################################################');
        logger.verbose(`## sendEncipheredMetisMessageAndMessage(requestType: from, to, messageToEncrypt, message, fee, subtype, prunable, recipientPublicKey`);
        logger.verbose('##');
        logger.sensitive(`from: ${from}, to: ${to}, messageToEncrypt: ${messageToEncrypt}, message: ${message}, fee: ${fee}, subtype: ${subtype}, prunable: ${prunable}, recipientPublicKey: ${recipientPublicKey}`);
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
     * @returns {Promise<{status, statusText,headers, config, request, data:
     *                      {signatureHash,broadcasted, transactionJSON, unsignedTransactionBytes,requestProcessingTime,transactionBytes,fullHash,transaction }
     *                  }>}
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
        logger.verbose(`### jupiterApiService.sendMetisMessageOrMessage(*)`);
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

        logger.sensitive(`params= ${JSON.stringify(params)}`);

        return new Promise( (resolve, reject) => {
            this.post(params)
                .then( response => {
                    logger.debug(`then()`);



                    console.log(response)




                    if (response.data.broadcasted && response.data.broadcasted === true) {
                        return resolve(response);
                    }
                    logger.error(`then(error)`);
                    return reject({errorType: 'responseValueNotAsExpected', message: response});
                })
                .catch( error  => {
                    logger.error(`error()`);
                    console.log(error)
                    return reject({errorType: 'requestError', message: `${error}`});
                });
        })
    }


    /**
     *
     * @param {GravityAccountProperties} fromAccountProperties
     * @param {GravityAccountProperties} toAccountProperties
     * @param {int} amount
     * @param {number} feeNQT
     * @returns {Promise<unknown>}
     */
    async transferMoney(fromAccountProperties, toAccountProperties, amount, feeNQT = this.appProps.feeNQT) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## transferMoney(fromJupiterAccount, toJupiterAccount, amount, feeNQT)`);
        logger.verbose('## ');
        return new Promise((resolve, reject) => {
            if (!gu.isNumberGreaterThanZero(amount)) {
                return reject('problem with amount');
            }
            if(!fromAccountProperties){
                return reject('problem with fromAccountProperties');
            }

            if(!toAccountProperties){
                return reject('problem with toAccountProperties');
            }

            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
            logger.info(`++ Transferring Money`);
            logger.info(`++ from: ${fromAccountProperties.address}`);
            logger.info(`++ to: ${toAccountProperties.address}`);
            logger.info(`++ amount: ${amount}`);
            logger.info(`++ feeNQT: ${feeNQT}`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')


            this.post( {
                requestType: 'sendMoney',
                recipient: toAccountProperties.address,
                secretPhrase: fromAccountProperties.passphrase, //fromAccount
                amountNQT:amount,
                feeNQT: feeNQT,
                deadline: this.appProps.deadline //60
            })
                .then(response =>{
                    console.log('transferMoney().then()');
                    if (response.data.signatureHash != null) {
                        return resolve(response);
                    }
                    logger.info('Cannot send Jupiter to new accountId, Jupiter issuer has insufficient balance!');
                    return reject(response);
                })
                .catch( error =>{
                    logger.error('Error: [transferMoney]', error)
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
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getDecipheredData(dataToDecipher, address, passphrase, nonce)`);
        logger.verbose(`## `);
        logger.sensitive(`=${JSON.stringify()}`);

        if(!gu.isWellFormedPassphrase(passphrase)) {throw new Error('Please provide a valid passphrase')}
        if(!gu.isWellFormedJupiterAddress(address)) {throw new Error('Please provide a valid address');}

        return this.get( {
            requestType: 'decryptFrom',
            secretPhrase: passphrase,
            account: address,
            data: dataToDecipher,
            nonce: nonce
        });
    }


    /**
     *
     * @param aliasName
     * @returns {Promise<*>}
     */
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


    setAlias(params) {
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

    // async getUnconfirmedBlockChainTransactions(address) {
    //     logger.verbose('----------------------------------------');
    //     logger.verbose(`fetchUnconfirmedBlockChainTransactions(address)`);
    //     logger.verbose('--');
    //     return this.jupiterRequest('get', {
    //         requestType: 'getUnconfirmedTransactions',
    //         account: address,
    //     });
    // }

}

module.exports = {
    JupiterAPIService: JupiterAPIService,
    jupiterAPIService: new JupiterAPIService(process.env.JUPITERSERVER, metisApplicationAccountProperties)
};
