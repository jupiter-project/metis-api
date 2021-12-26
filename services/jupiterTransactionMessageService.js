const {GravityCrypto} = require("./gravityCrypto");
const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');
const _ = require("lodash");
const {jupiterAPIService, JupiterAPIService} = require("./jupiterAPIService");
const {feeManagerSingleton} = require("./FeeManager");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {transactionUtils} = require("../gravity/transactionUtils");
const assert = require("assert");
const {BadJupiterAddressError} = require("../errors/metisError");

class JupiterTransactionMessageService {

    /**
     *
     * @param jupiterAPIService
     */
    constructor(jupiterAPIService,transactionUtils) {
        if(!(jupiterAPIService instanceof JupiterAPIService)){throw new Error('jupiterApiServer not valid')};
        this.jupiterAPIService = jupiterAPIService;
        this.transactionUtils = transactionUtils;
    }

    /**
     *
     * @param messageTransactions - [{signature, transactionIndex, type, phased, ecBlockId, signatureHash,
     * attachment: {encryptedMessage: {data,nonce, isText, isCompressed},version.ArbitraryMessage,version.EncryptedMessage},
     * senderRS,subtype,amountNQT,recipientRS,block,blockTimestamp,deadline,timestamp,height,senderPublicKey,feeNQT,
     * confirmations,fullHash,version,sender,recipient,ecBlockHeight,transaction}]
     * @param accountProperties
     * @returns {Promise<unknown>}
     */
    async putReadableMessagesIntoMessageTransactionsAndReturnTransactions(messageTransactions, accountProperties){
        logger.verbose(`#################################################`)
        logger.verbose(`## putReadableMessagesIntoMessageTransactionsAndReturnTransactions(messageTransactions.length= ${messageTransactions.length}, accountProperties)`)
        logger.verbose(`##`)
        if(!transactionUtils.areValidTransactions(messageTransactions)){throw new Error('messageTransactions is invalid')}
        if(!(accountProperties instanceof GravityAccountProperties)){throw new Error('accountProperties is invalid')}
        logger.sensitive(`accountProperties.address= ${accountProperties.address}`)

        return new Promise((resolve, reject) => {
            let transactions = _.clone(messageTransactions);
            let metisMessagePromises = [];
            transactions.forEach((transaction) => {
                const transactionId = transaction.transaction;
                logger.debug(`transactionId= ${transactionId}`)
                metisMessagePromises.push(
                    new Promise((res, rej) => {
                        this.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
                            transactionId,
                            accountProperties.passphrase.crypto,
                            accountProperties.passphrase
                        )
                            .then(messageContainer => {
                                logger.verbose(`-----------------------------------------------------`)
                                logger.verbose(`decipherMessagesFromMessageTransactionsAndReturnTransactions(messageTransactions).getReadableMessageFromMessageTransactionIdAndDecrypt().then()`)
                                logger.verbose(`-----------------------------------------------------`)
                                transaction.attachment.decryptedMessage = {};
                                transaction.attachment.decryptedMessage.data = messageContainer.message;
                                res(transaction)

                            })
                            .catch(error => {
                                rej({status: 'error', message: ''});

                            })
                    })
                )
            })

            Promise.all(metisMessagePromises)
                .then(transactions => {
                    resolve(transactions);
                })
                .catch(error => {
                    reject({status: 'error', message: `${error}`});
                })

            // const dataToDecipher = transaction.attachment.encryptedMessage.data;
            // const nonce = transaction.attachment.encryptedMessage.nonce;
            // metisMessagePromises.push(
            //     this.jupiterApi.decryptFrom(dataToDecipher, address, passphrase, nonce)
            //         .then((response) => {
            //             transaction.decryptedMessage = response.data.decryptedMessage;
            //             resolve(transaction);
            //         })
            //         .catch((error) => {
            //             logger.error(`jupiterDecryptMessagesFromMessageTransactions(): ${error}`);
            //             reject(error);
            //         }));
            // });

            // Promise.all(metisMessagePromises)
            //     .then((messages) => {
            //         resolve(messages);
            //     })
            //     .catch((error) => {
            //         logger.debug('PROMISE ERROR');
            //         logger.error(`${error}`);
            //     })
        })
    }




    /**
     *
     * @param messageTransactionIds
     * @param crypto
     * @param passphrase
     * @returns {Promise<Array>}
     */
    readMessagesFromMessageTransactionIdsAndDecryptOrNullAndReturnMessageContainer(messageTransactionIds, crypto, passphrase) {
        return this.readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(messageTransactionIds, crypto, passphrase)
            .then(messages => messages)
            .catch(error => null);
    }

    /**
     *
     * @param {array} messageTransactionIds
     * @param {GravityCrypto} crypto
     * @param {string} passphrase
     * @returns {Promise<[{message: {}, transactionId: string}]>}
     */
    readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(messageTransactionIds, crypto, passphrase) {
        logger.sensitive(`#### readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(messageTransactionIds, crypto, passphrase)`);
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is not valid')}
        if(!(crypto instanceof GravityCrypto)){throw new Error('crypto is not valid')}
        if(!Array.isArray(messageTransactionIds)){throw new Error(`messageTransactionIds is not array`)}
        // logger.verbose(`#### readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(messageTransactionIds, crypto, passphrase): messageTransactionIds.length=${messageTransactionIds.length}`);
        logger.verbose(`ids: ${JSON.stringify(messageTransactionIds)}`);
        return this.executeCallbackForEachTransactionIdInBatches(
            messageTransactionIds,
            (transactionId) => this.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(transactionId, crypto, passphrase)
        )
    }

    /**
     *
     * @param messageTransactionIds
     * @param crypto
     * @param passphrase
     * @returns {Promise<[{message, transactionId}]>}
     */
    async readMessagesFromMessageTransactionIdsAndDecryptOrPassThroughAndReturnMessageContainers(messageTransactionIds, crypto, passphrase) {
        logger.verbose('##############################################################################################');
        logger.verbose('## readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(messageTransactionIds, crypto, passphrase)');
        logger.verbose('##');
        logger.verbose(`messageTransactionIds.length=${messageTransactionIds.length}`);

        return await this.executeCallbackForEachTransactionIdInBatches(
            messageTransactionIds,
            (transactionId) => this.getReadableMessageContainerFromMessageTransactionIdAndDecryptOrPassThrough(transactionId, crypto, passphrase)
        )
    }

    /**
     *
     * @param messageTransactionIds
     * @param passphrase
     * @param password
     * @returns {Promise<[{message, transactionId}]>}
     */
    readMessagesFromMessageTransactionIdsAndReturnMessageContainers(messageTransactionIds, passphrase) {
        logger.verbose('#### readMessagesFromMessageTransactionIdsAndReturnMessageContainers(messageTransactionIds, passphrase)');
        if(!transactionUtils.areWellFormedJupiterTransactionIds(messageTransactionIds)){throw new Error('messageTransactionsIds is not valid')}
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is not valid')}
        logger.verbose(`messageTransactionIds.length=${messageTransactionIds.length}`);

        return this.executeCallbackForEachTransactionIdInBatches(
            messageTransactionIds,
            (transactionId) => this.getReadableMessageContainerFromMessageTransactionId(transactionId, passphrase)
        )
    }


    /**
     * Throughling
     * @param {string} messageTransactionIds
     * @param callback
     * @returns {Promise<[]>}
     */
    async executeCallbackForEachTransactionIdInBatches(messageTransactionIds, callback) {
        logger.verbose(`#### executeCallbackForEachTransactionIdInBatches(messageTransactionIds, callback): messageTransactionsIds.length= ${messageTransactionIds.length}`);
        if(!gu.isNonEmptyArray(messageTransactionIds)){
            logger.warn(`passed in messageTransactionIds is empty`);
            return []
        }
        if(!transactionUtils.areWellFormedJupiterTransactionIds(messageTransactionIds)){ throw new Error('messageTransactionIds are invalid')}
        try {
            const groupMaxSize = 50;
            let metisMessagePromises = [];
            let transactionGroupCount = Math.ceil((messageTransactionIds.length) / groupMaxSize);
            let results = [];
            for (let currentGroup = 0; currentGroup < transactionGroupCount; currentGroup++) {
                let transactionsCount = Math.min(messageTransactionIds.length, groupMaxSize);
                for (let j = 0; j < transactionsCount; j++) {
                    metisMessagePromises.push(callback(messageTransactionIds.shift()))
                }
                const metisMessages = await gu.filterPromisesByRemovingEmptyResults(metisMessagePromises);
                results = [...results, ...metisMessages];
            }
            logger.debug(`results.length =${results.length}`)
            return results;
        }catch(error){
            logger.error(`**** executeCallbackForEachTransactionIdInBatches(messageTransactionIds, callback).catch(error)`);
            logger.error(`**error= ${error}`)
            throw error;
        }
    }

    async readMessagesFromMessageTransactionsAndDecryptOrPassThroughAndReturnMessageContainers(transactions, crypto, passphrase) {
        logger.verbose('##############################################################################################');
        logger.verbose('## readMessagesFromUnconfirmedMessageTransactionsAndDecryptOrPassThroughAndReturnMessageContainers(unconfirmedTransactions, crypto, passphrase)');
        logger.verbose('##');

        const transactionIds = this.transactionUtils.extractTransactionIds(transactions);

        return await this.readMessagesFromMessageTransactionIdsAndDecryptOrPassThroughAndReturnMessageContainers(transactionIds, crypto, passphrase )
    }

    // allMessagePromises(promises){
    //     return new Promise((resolve, reject) => {
    //         /**
    //          * // [
    //          //   {status: "fulfilled", value: 33},
    //          //   {status: "fulfilled", value: 66},
    //          //   {status: "fulfilled", value: 99},
    //          //   {status: "rejected",  reason: Error: an error}
    //          // ]
    //          */
    //         Promise.all(promises)
    //             .then((results) => {
    //                 logger.verbose('---------------------------------------------------------------------------------------');
    //                 logger.verbose(`readMessagesFromMessageTransactionIdsAndDecrypt().Promise.all().then(results)`)
    //                 logger.verbose('---------------------------------------------------------------------------------------');
    //                 logger.verbose(`results.length= ${results.length}`);
    //
    //                 const decryptedMessages = results.reduce(function (filtered, result) {
    //                     if(!result){
    //                         // console.log('|')
    //                         return filtered;
    //                     }
    //                     filtered.push(result);
    //                     return filtered;
    //                 }, []);
    //                 logger.verbose(`decryptedMessages.length= ${decryptedMessages.length}`);
    //                 return resolve(decryptedMessages);
    //             })
    //             .catch((error) => {
    //                 logger.error('PROMISE ERROR');
    //                 logger.error(`${error}`);
    //                 return reject({status: 'error', message: error});
    //             })
    //
    //     })
    // }



    /**
     *
     * @param transactions
     * @param {GravityAccountProperties} gravityAccountProperties
     * @param {boolean} isMetisEncrypted
     * @return {Promise<Array|{message, transactionId}[]|*[]>}
     */
    async getReadableMessageContainers(transactions, gravityAccountProperties, isMetisEncrypted = true){
        logger.verbose(`#### getReadableMessageContainers(transactions, gravityAccountProperties, isMetisEncrypted= ${isMetisEncrypted})`);
        if(!Array.isArray(transactions)){throw new Error('transactions is not an array')}
        logger.verbose(`- transactions.length= ${transactions.length}`);
        if(!gu.isNonEmptyArray(transactions)){return []}
        if (!(gravityAccountProperties instanceof GravityAccountProperties)){
            throw new Error('memberAccountProperties is invalid')
        }
        if(!transactionUtils.areValidTransactions(transactions)){ throw new Error('transactions are not valid')}
        // logger.sensitive(`- gravityAccountProperties.length= ${JSON.stringify(gravityAccountProperties.length)}`);
        const transactionIds = this.transactionUtils.extractTransactionIds(transactions);
        const messages = isMetisEncrypted ?
            await this.readMessagesFromMessageTransactionIdsAndDecryptOrNullAndReturnMessageContainer(transactionIds, gravityAccountProperties.crypto, gravityAccountProperties.passphrase) :
            await this.readMessagesFromMessageTransactionIdsAndReturnMessageContainers(transactionIds, gravityAccountProperties.passphrase)

        if(messages === null) {
            logger.debug(`No messages were extracted from transactions: ${transactions.length}`)
            return []
        }
        logger.verbose(`messages.length= ${messages.length}`);
        if(!gu.isNonEmptyArray(messages)) {
            return []
        }

        return messages;
    }


    /**
     * Don't return rejections cause we are doing Promise.all()
     * @param messageTransactionId
     * @param crypto
     * @param passphrase
     * @returns {Promise<{message: *, transactionId: *}>}
     */
    async getReadableMessageContainerFromMessageTransactionIdAndDecrypt(messageTransactionId, crypto, passphrase) {
        // logger.sensitive(`#### getReadableMessageContainerFromMessageTransactionIdAndDecrypt(messageTransactionId, crypto, passphrase)`);
        if(!gu.isWellFormedJupiterTransactionId(messageTransactionId)){throw new Error('messageTransactionId is invalid')}
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is invalid')}
        if(!(crypto instanceof GravityCrypto)){throw new Error('crypto is invalid')}
        try {
            const decryptedMessageContainer = await this.getReadableMessageContainerFromMessageTransactionId(messageTransactionId, passphrase);
            if (!decryptedMessageContainer.message) {
                logger.warn(`message is EMPTY`)
                return '';
            }
            const messageToParse = crypto.decryptOrNull(decryptedMessageContainer.message);
            if (!messageToParse) {
                logger.warn(`unable to decrypt message: ${decryptedMessageContainer.message.substring(0,10)}`);
                return ''; // because of Promise.all we should not do reject.
            }
            const message = gu.jsonParseOrPassThrough(messageToParse);
            return {message: message, transactionId: messageTransactionId};
        } catch(error) {
            logger.error(`**** getReadableMessageContainerFromMessageTransactionIdAndDecrypt(messageTransactionId, crypto, passphrase).catch(error)`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }

    /**
     *
     * @param messageTransactionId
     * @param crypto
     * @param passphrase
     * @returns {Promise<unknown>}
     */
    async getReadableMessageContainerFromMessageTransactionIdAndDecryptOrPassThrough(messageTransactionId, crypto, passphrase) {
        // logger.verbose('#### getReadableMessageContainerFromMessageTransactionIdAndDecryptOrPassThrough(messageTransactionId, crypto, passphrase)');
        return new Promise((resolve, reject) => {
            this.getReadableMessageContainerFromMessageTransactionId(messageTransactionId, passphrase)
                .then(messageContainer => {
                    try {
                        // logger.error('what happens if i try to parse a non JSON String?');
                        // logger.debug(`decryptedMessage.message= ${decryptedMessage.message}`);
                        // logger.sensitive(`password= ${crypto.decryptionPassword}`);
                        const messageToParse = crypto.decryptOrPassThrough(messageContainer.message);

                        if(!messageToParse){
                            // logger.debug('messageToParse is null');
                            return resolve(''); // because of Promise.all we should not do reject.
                        }

                        // const message = JSON.parse(messageToParse);
                        const message = gu.jsonParseOrPassThrough(messageToParse);
                        return resolve({message: message, transactionId: messageContainer.transactionId});

                    } catch (error) {
                        logger.error(`********************`)
                        logger.error(`** getReadableMessageFromMessageTransactionIdAndDecrypt().getReadableMessageFromMessageTransactionId().then().catch(error)`)
                        console.log(error);
                        logger.error(`**`)
                        return resolve(''); // because of Promise.all we should not do reject.
                    }
                })
                .catch(error => {
                    logger.error(`********************`)
                    logger.error(`** getReadableMessageFromMessageTransactionIdAndDecrypt().getReadableMessageFromMessageTransactionId().catch(error)`);
                    console.log(error);
                    logger.error(`**`)
                    return resolve(''); // because of Promise.all we should not do reject.
                })
        })
    }

    getReadableMessageContainerFromMessageTransactionIdOrNull(messageTransactionId, passphrase) {
        return this.getReadableMessageContainerFromMessageTransactionId(messageTransactionId,passphrase)
            .catch( error => null);
    }

    /**
     *
     * @param messageTransactionId
     * @param passphrase
     * @returns {Promise<{message: *, transactionId: *}>}
     */
    getReadableMessageContainerFromMessageTransactionId(messageTransactionId, passphrase) {
        if(!gu.isWellFormedJupiterTransactionId(messageTransactionId)){throw new Error('messageTransactionId is invalid')}
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is invalid')}

        return this.jupiterAPIService.getMessage(messageTransactionId, passphrase)
            .then((response) => {
                const message = gu.jsonParseOrPassThrough(response.data.decryptedMessage);
                return {message: message, transactionId: messageTransactionId};
            })
    }

    /**
     *
     * @returns {Promise<unknown>}
     */
    // async fetchUnconfirmedMessages(transactions, accountProperties) {
    //     logger.verbose('#####################################################################################');
    //     logger.verbose(`## fetchUnconfirmedMessages(transactions, accountProperties= ${!!accountProperties})`);
    //     logger.verbose('#####################################################################################');
    //     logger.sensitive(`accountProperties= ${JSON.stringify(accountProperties)}`);
    //
    //     if(transactions.length < 1){
    //         return []
    //     }
    //
    //     const unconfirmedMessages = transactions.map(transaction => transaction.decryptedMessage);
    //     return unconfirmedMessages;
    // }


    /**
     *
     * @param senderAccountProperties
     * @param blockChainTransactions
     * @param decipherWith
     * @returns {Promise<unknown>}
     */
    async extractMessagesBySender(senderAccountProperties, blockChainTransactions, decipherWith= null){
        logger.verbose(`#### extractMessagesBySender(accountProperties, blockChainTransactions,  decipherWith=null)`);
        logger.debug(`blockChainTransactions.length= ${blockChainTransactions.length}`);
        logger.debug(`senderAccountProperties.address= ${senderAccountProperties.address}`);

        if(!(senderAccountProperties instanceof GravityAccountProperties)) throw new Error('senderAccountProperties is not GravityAccountProperties')

        if(!gu.isNonEmptyArray(blockChainTransactions)){
            logger.warn(`empty transactions array passed in`)
            return [];
        }
        // const filteredTransactions = transactionUtils.filterEncryptedMessageTransactions(blockChainTransactions)
        const messageTransactions = this.transactionUtils.filterEncryptedMessageTransactionsBySender(blockChainTransactions, senderAccountProperties.address);
        // if(! this.transactionUtils.areValidTransactions(blockChainTransactions)) throw new Error('blockChainTransactions is invalid')
        if( !(decipherWith === null || (decipherWith instanceof GravityCrypto) )) throw new Error('decipherWith is invalid')
        let crypto = senderAccountProperties.crypto;
        if (decipherWith){
            crypto = decipherWith;
        }
        logger.debug(`filterMessageTransactionsBySender.messageTransactions.length= ${messageTransactions.length}`);
        // const tp = transactionUtils.extractTransactionIds(messageTransactions);
        // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
        // console.log('tp.length');
        // console.log(tp.length);
        // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')

        const filteredTransactionIds = this.transactionUtils.extractTransactionIds(messageTransactions);
        logger.debug(`filteredTransactionIds.length= ${filteredTransactionIds.length}`);

        return this.readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(
            filteredTransactionIds,
            crypto,
            senderAccountProperties.passphrase
        )
            .then((messageContainers) => {
                logger.verbose(`---- extractMessagesBySender(senderAccountProperties, blockChainTransactions, decipherWith).readMessagesFromMessageTransactionIdsAndDecrypt(filteredTransactionIds).then(messages)`);
                logger.verbose(`senderAccountProperties.address= ${senderAccountProperties.address}`);
                logger.verbose(`blockChainTransactions.length= ${blockChainTransactions.length}`);
                logger.verbose(`filterMessageTransactionsBySender.messageTransactions.length= ${messageTransactions.length}`);
                logger.verbose(`filteredTransactionIds.length= ${filteredTransactionIds.length}`);
                logger.verbose(`messages.length= ${messageContainers.length}`);
                return messageContainers;
            })
    }

    /**
     *
     * @param {GravityAccountProperties} gravityAccountProperties
     * @param {[]} blockChainTransactions
     * @returns {Promise<unknown>}
     */
    async getAllMessagesFromBlockChainAndIncludeTransactionInformation(gravityAccountProperties, blockChainTransactions){
        logger.verbose(`#### getAllMessagesFromBlockChainAndIncludeTransactionInformation(accountProperties, blockChainTransactions)`);
        logger.verbose(`blockChainTransactions.length= ${JSON.stringify(blockChainTransactions.length)}`);
        // if( !(gravityAccountProperties instanceof GravityAccountProperties) ){throw new Error('invalid gravityAccountProperties')};
        if(!blockChainTransactions){throw new Error('blockChainTransactions is empty')};
        if(!Array.isArray(blockChainTransactions)){throw new Error('blockchaintransaction not array')};
        if(blockChainTransactions.length === 0){ return [] }
        const filteredTransactionIds = this.transactionUtils.extractTransactionIds(blockChainTransactions);

        const messages =  this.readMessagesFromMessageTransactionIdsAndDecryptOrPassThroughAndReturnMessageContainers(
            filteredTransactionIds,
            gravityAccountProperties.crypto,
            gravityAccountProperties.passphrase
        )

        return messages;
    }

    /**
     *
     * @param {GravityAccountProperties} accountProperties
     * @param {GravityCrypto || null} decipherWith
     * @returns {Promise<[]>}
     */
     fetchAllMessagesBySender(transactions, accountProperties, decipherWith= null) {
        logger.verbose('###########################################################################');
        logger.verbose(`## fetchAllMessagesBySender(accountProperties)`);
        logger.verbose('##');
        logger.debug(`transactions.length= ${JSON.stringify(transactions.length)}`);

        let crypto = accountProperties.crypto;
        if (decipherWith){
            crypto = decipherWith
        }

        const messageTransactions = this.transactionUtils.filterEncryptedMessageTransactionsBySender(transactions, accountProperties.address);
        const filteredTransactionIds = this.transactionUtils.extractTransactionIds(messageTransactions);
        return this.readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(
            filteredTransactionIds,
            crypto,
            accountProperties.passphrase
        )
            .then((messages) => {
                logger.verbose('---------------------------------------------------------------------------------------');
                logger.verbose(`fetchAllMessagesBySender().getAllBlockChainTransactions().readMessagesFromMessageTransactionIdsAndDecrypt().then(messages)`);
                logger.verbose('---------------------------------------------------------------------------------------');
                logger.verbose(`messages.length ${messages.length}`);

                return messages;
            })
    }

    /**
     *
     * @param {string} fromPassphrase
     * @param {string} toAddress
     * @param metisMessage
     * @param {string} tag
     * @param feeType
     * @param recipientPublicKey
     * @param prunable
     * @return {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async sendTaggedAndEncipheredMetisMessage(fromPassphrase, toAddress, metisMessage, tag, feeType, recipientPublicKey = null, prunable= false ) {
        logger.verbose(`#### sendTaggedAndEncipheredMetisMessage(fromPassphrase, toAddress, metisMessage, tag, feeType, recipientPublicKey, prunable )`);
        if(!gu.isWellFormedPassphrase(fromPassphrase)){throw new Error(`fromPassphrase is not valid: ${fromPassphrase}`)}
        if(!gu.isWellFormedJupiterAddress(toAddress)){throw new BadJupiterAddressError(toAddress)}
        logger.sensitive(`fromPassphrase= ${fromPassphrase}`);
        logger.debug(`toAddress= ${toAddress}`);
        logger.debug(`tag= ${tag}`);
        logger.debug(`recipientPublicKey= ${recipientPublicKey}`);
        let _recipientPublicKey = recipientPublicKey;
        if(!gu.isWellFormedPublicKey(recipientPublicKey)){
            const toPublicKeyResponse = await this.jupiterAPIService.getAccountPublicKey(toAddress);
            if( toPublicKeyResponse.hasOwnProperty('data') &&  toPublicKeyResponse.data.hasOwnProperty('publicKey')){
                _recipientPublicKey = toPublicKeyResponse.data.publicKey;
            }
        }
        if(!gu.isWellFormedPublicKey(_recipientPublicKey)){
            throw new Error(`recipientPublicKey is not valid: ${_recipientPublicKey}`)
        }
        const fee = feeManagerSingleton.getFee(feeType);
        const {subtype,type} = feeManagerSingleton.getTransactionTypeAndSubType(feeType); //{type:1, subtype:12}
        logger.debug(`subtype= ${subtype}`);
        logger.debug(`type= ${type}`);

        return this.jupiterAPIService.sendMetisMessageOrMessage(
            JupiterAPIService.RequestType.SendMetisMessage,
            toAddress,
            _recipientPublicKey,
            fromPassphrase,
            null,
            fee,
            process.env.JUPITER_DEADLINE,
            null,
            null,
            tag,
            null,
            null,
            metisMessage,
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
        );
    }

}

module.exports.JupiterTransactionMessageService = JupiterTransactionMessageService;
module.exports.jupiterTransactionMessageService = new JupiterTransactionMessageService(
    jupiterAPIService,
    transactionUtils
);
