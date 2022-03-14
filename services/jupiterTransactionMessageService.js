const {GravityCrypto} = require("./gravityCrypto");
const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');
const _ = require("lodash");
const {jupiterAPIService, JupiterAPIService} = require("./jupiterAPIService");
const {feeManagerSingleton} = require("./FeeManager");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {transactionUtils} = require("../gravity/transactionUtils");
const assert = require("assert");
const mError = require("../errors/metisError");
import {metisConfig} from '../config/constants';

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
        logger.verbose(`#### readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(messageTransactionIds, crypto, passphrase)`);
        if(!gu.isWellFormedPassphrase(passphrase)) throw new mError.MetisErrorBadJupiterPassphrase(``);
        if(!(crypto instanceof GravityCrypto)) throw new mError.MetisError(`crypto is invalid`);
        if(!Array.isArray(messageTransactionIds)) throw new mError.MetisError(`messageTransactionIds is not array`);
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
     *  Fetch transaction messages from 'transactions' list.
     *
     * @param {array | null} transactions
     * @param {GravityAccountProperties} ownerAccountProperties
     * @param {boolean} isMetisEncrypted
     * @return {Promise<Array|{message, transactionId}[]|*[]>}
     */
    async getReadableMessageContainersFromTransactions(transactions, ownerAccountProperties, isMetisEncrypted = true){
        logger.verbose(`#### getReadableMessageContainersFromTransactions(transactions, gravityAccountProperties, isMetisEncrypted= ${isMetisEncrypted})`);
        if(!Array.isArray(transactions)){throw new mError.MetisError('transactions is not an array')}
        logger.verbose(`- transactions.length= ${transactions.length}`);
        if(!gu.isNonEmptyArray(transactions)) {
            console.log(`\n`);
            logger.warn('???????????????????????????????????????????????');
            logger.warn(`?? Empty Transactions Passed in`);
            logger.warn('???????????????????????????????????????????????\n');
            return []
        }
        if (!(ownerAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties('ownerAccountProperties is invalid')
        if(!transactionUtils.areValidTransactions(transactions)){ throw new Error('transactions are not valid')}
        // logger.sensitive(`- gravityAccountProperties.length= ${JSON.stringify(gravityAccountProperties.length)}`);
        const transactionIds = this.transactionUtils.extractTransactionIds(transactions);
        const messages = isMetisEncrypted ?
            await this.readMessagesFromMessageTransactionIdsAndDecryptOrNullAndReturnMessageContainer(transactionIds, ownerAccountProperties.crypto, ownerAccountProperties.passphrase) :
            await this.readMessagesFromMessageTransactionIdsAndReturnMessageContainers(transactionIds, ownerAccountProperties.passphrase)
        logger.verbose(`messages.length= ${messages.length}`);
        if(!gu.isNonEmptyArray(messages)) {
            console.log(`\n`);
            logger.warn('???????????????????????????????????????????????');
            logger.warn(`?? No messages were extracted from transactions: ${transactions.length}`);
            logger.warn('???????????????????????????????????????????????\n');
            return []
        }

        return messages;
    }


    /**
     *
     * @param transactionIds
     * @param passphrase
     * @param crypto
     * @return {Promise<unknown[]>}
     */
    async getReadableContainersFromMessageTransactionIdsAndDecrypt(transactionIds, passphrase, crypto){
        const promises = transactionIds.map( transactionId => {
            return this.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
                transactionId,
                crypto,
                passphrase
            )
        } )

        return Promise.all(promises)
    }

    async getReadableMessageContainersFromMessageTransactionIds(messageTransactionIds, passphrase){
        const promises = messageTransactionIds.map( transactionId => {
            return this.getReadableMessageContainerFromMessageTransactionId(transactionId, passphrase);
        } )
        return Promise.all(promises)
    }


    /**
     * Don't return rejections cause we are doing Promise.all()
     * @param messageTransactionId
     * @param crypto
     * @param passphrase
     * @returns {Promise<{message: *, transactionId: *}>}
     */
    async getReadableMessageContainerFromMessageTransactionIdAndDecrypt(messageTransactionId, crypto, passphrase) {
        // logger.verbose(`#### getReadableMessageContainerFromMessageTransactionIdAndDecrypt(messageTransactionId, crypto, passphrase)`);
        if(!gu.isWellFormedJupiterTransactionId(messageTransactionId)){throw new Error('messageTransactionId is invalid')}
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is invalid')}
        if(!(crypto instanceof GravityCrypto)){throw new Error('crypto is invalid')}
        try {
            const decryptedMessageContainer = await this.getReadableMessageContainerFromMessageTransactionId(messageTransactionId, passphrase);
            if (!decryptedMessageContainer.message) {
                console.log(`\n`);
                logger.warn('???????????????????????????????????????????????');
                logger.warn(`?? transaction encryptedMessage is empty`);
                logger.warn('???????????????????????????????????????????????\n');
                return '';
            }
            const messageToParse = decryptedMessageContainer.tag.includes(metisConfig.ev1)
                ? crypto.decryptOrNullGCM(decryptedMessageContainer.message)
                : crypto.decryptOrNull(decryptedMessageContainer.message);
            if (!messageToParse) {
                console.log(`\n`);
                logger.warn('???????????????????????????????????????????????');
                logger.warn(`?? unable to mDecrypt message: ${decryptedMessageContainer.message.substring(0,30)}  --- SIZE: ${decryptedMessageContainer.message.length}`);
                logger.warn('???????????????????????????????????????????????\n');
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
                        const messageToParse = messageContainer.tag.includes(metisConfig.ev1)
                            ? crypto.decryptOrPassThroughGCM(messageContainer.message)
                            : crypto.decryptOrPassThrough(messageContainer.message);

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
     * @returns {Promise<{message: *, transactionId: *, tag: *}>}
     */
    getReadableMessageContainerFromMessageTransactionId(messageTransactionId, passphrase) {
        if(!gu.isWellFormedJupiterTransactionId(messageTransactionId)){throw new Error('messageTransactionId is invalid')}
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is invalid')}

        return this.jupiterAPIService.getMessage(messageTransactionId, passphrase)
            .then((response) => {
                const message = gu.jsonParseOrPassThrough(response.data.decryptedMessage);
                return {message: message, transactionId: messageTransactionId, tag: response.data.message};
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
     * @return {Promise<{signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}>}
     */
    async sendTaggedAndEncipheredMetisMessage(fromPassphrase, toAddress, metisMessage, tag, feeType, recipientPublicKey, prunable= false ) {
        logger.verbose(`#### sendTaggedAndEncipheredMetisMessage(fromPassphrase, toAddress, metisMessage, tag, feeType, recipientPublicKey, prunable )`);
        if(!gu.isWellFormedPassphrase(fromPassphrase)){throw new Error(`fromPassphrase is not valid: ${fromPassphrase}`)}
        if(!gu.isWellFormedJupiterAddress(toAddress)) throw new mError.MetisErrorBadJupiterAddress(`toAddress: ${toAddress}`)
        logger.sensitive(`fromPassphrase= ${fromPassphrase}`);
        logger.debug(`toAddress= ${toAddress}`);
        logger.debug(`tag= ${tag}`);
        logger.debug(`recipientPublicKey= ${recipientPublicKey}`);
        let _recipientPublicKey = recipientPublicKey;
        if(!gu.isWellFormedPublicKey(_recipientPublicKey)){
            throw new Error(`recipientPublicKey is not valid: ${_recipientPublicKey}`)
        }
        const fee = feeManagerSingleton.calculateMessageFee(metisMessage.length);
        const {subtype,type} = feeManagerSingleton.getTransactionTypeAndSubType(feeType); //{type:1, subtype:12}
        logger.debug(`subtype= ${subtype}`);
        logger.debug(`type= ${type}`);
        logger.debug(`fee= ${fee}`);
        const response = await this.jupiterAPIService.sendMetisMessageOrMessage(
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

        return response.data
    }

}

module.exports.JupiterTransactionMessageService = JupiterTransactionMessageService;
module.exports.jupiterTransactionMessageService = new JupiterTransactionMessageService(
    jupiterAPIService,
    transactionUtils
);
