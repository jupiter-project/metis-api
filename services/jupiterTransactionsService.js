const gu = require('../utils/gravityUtils');
const _ = require("lodash");
const logger = require('../utils/logger')(module);
const {jupiterAPIService, JupiterAPIService} = require("./jupiterAPIService");
const {jupiterTransactionMessageService} = require("./jupiterTransactionMessageService");
const {transactionUtils} = require("../gravity/transactionUtils");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {MetisError} = require("../errors/metisError");
const mError = require("../errors/metisError");
const {validator} = require("./validator");
const {GravityCrypto} = require("./gravityCrypto");

class JupiterTransactionsService {

    /**
     *
     * @param jupiterAPIService
     * @param jupiterTransactionMessageService
     * @param transactionUtils
     * @param validator
     */
    constructor(jupiterAPIService, jupiterTransactionMessageService, transactionUtils, validator) {
        if(!(jupiterAPIService instanceof JupiterAPIService)){throw new Error('jupiterApiServer not valid')}
        this.jupiterAPIService = jupiterAPIService;
        this.messageService = jupiterTransactionMessageService;
        this.transactionUtils = transactionUtils;
        this.validator = validator;
    }

    /**
     *
     * @param {string} account
     * @returns {Promise<array>} - [{signature, transactionIndex,type,phased,ecBlockId,
     * signatureHash,attachment: {encryptedMessage: {data, nonce, isText, isCompressed}, version.MetisMetaData,
     * version.EncryptedMessage},senderRS,subtype,amountNQT, recipientRS,block, blockTimestamp,deadline, timestamp,height,
     * senderPublicKey,feeNQT,confirmations,fullHash, version,sender, recipient, ecBlockHeight,transaction}]
     */
    async getAllBlockChainTransactions(account) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## getAllBlockChainTransactions(account=${account})`);
        logger.verbose('#####################################################################################');
        return new Promise((resolve, reject) => {
            this.jupiterAPIService.getBlockChainTransactions(account)
                .then((response) => {
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`getAllBlockChainTransactions(account= ${account})`);
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.debug(`Total number of transactions found: ${response.data.transactions.length}`)
                    const blockChainTransactions = response.data.transactions;
                    resolve(blockChainTransactions);
                })
                .catch((error) => {
                    logger.error(`*****************************************`)
                    logger.error(`** jupiterAPIService.getBlockChainTransactions().catch()}`);
                    logger.error(`** error= ${JSON.stringify(error)}`);
                    logger.error(`** `)
                    reject(error);
                });
        });
    }


    /**
     *
     * @param account
     * @returns {Promise<unknown>}
     */
    // async getBlockChainMessageTransactions(account) {
    //     logger.verbose(`getBlockChainMessageTransactions(account ${account})`);
    //     return new Promise((resolve, reject) => {
    //         this.jupiterAPIService.getBlockChainTransactions(account)
    //             .then((blockChainTransactions) => {
    //                 logger.debug(`getBlockChainMessageTransactions().getBlockChainTransactions(account: ${account}).then()`);
    //                 logger.debug(`blockChainTransactions count ${blockChainTransactions.length}`)
    //
    //                 const messageTransactions = this.transactionFilter.filterMessageTransactions(blockChainTransactions);
    //                 resolve(messageTransactions);
    //             })
    //             .catch((error) => {
    //                 logger.error(`${error}`);
    //                 reject(error);
    //             });
    //     });
    // }

    /**
     *
     * @param {GravityAccountProperties} gravityAccountProperties
     * @param {string} tag
     * @param {boolean} [isMetisEncrypted=true]
     * @param {number|null} [firstIndex=null]
     * @param {number|null} [lastIndex=null]
     * @return {Promise<Array|{message, transactionId}[]|*[]>}
     */
    async getReadableTaggedMessageContainers(
        gravityAccountProperties,
        tag,
        isMetisEncrypted = true,
        firstIndex = null,
        lastIndex = null,
        transactionFilterCallback = null
    ){
        console.log(`\n`)
        logger.verbose(`#### getReadableTaggedMessageContainers(gravityAccountProperties, tag, isMetisEncrypted)`);
        if(!(gravityAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`gravityAccountProperties`)
        if(!gu.isNonEmptyString(tag)){throw new MetisError('tag is invalid')};
        logger.verbose(`tag= ${tag}`);
        logger.verbose(`isMetisEncrypted= ${isMetisEncrypted}`);
        logger.verbose(`gravityAccountProperties.address= ${gravityAccountProperties.address}`);
        const transactions = await this.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(
            gravityAccountProperties.address,
            tag,
            firstIndex,
            lastIndex
        );
        let filteredTransactions = transactions;
        if(transactionFilterCallback){
            filteredTransactions = transactions.filter(transactionFilterCallback);
        }
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        logger.info(`++ transactions before filter: ${transactions.length}`);
        logger.info(`++ transactions after filter: ${filteredTransactions.length}`);
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        return this.messageService.getReadableMessageContainersFromTransactions(filteredTransactions, gravityAccountProperties, isMetisEncrypted);
    }

    /**
     *
     * @param transactionId
     * @param sharedKey
     * @param isEncrypted
     * @returns {Object}
     */
    async getReadableMessageContainersBySharedKey(transactionId, sharedKey, isEncrypted = false){
        console.log(`\n`)
        logger.verbose(`########################################################################`);
        logger.verbose(`## getReadableTaggedMessageContainersBySharedKey( transactionId,sharedKey)`);
        logger.verbose(`########################################################################\n`);
        if(!gu.isNonEmptyString(transactionId)){throw new MetisError('transactionId is invalid')}
        if(!gu.isNonEmptyString(sharedKey)){throw new MetisError('sharedKey is invalid')}
        logger.verbose(`transactionId= ${transactionId}`);
        logger.verbose(`sharedKey= ${sharedKey}`);

        const transaction = await this.jupiterAPIService.getReadableMessageBySharedKey(transactionId, sharedKey);

        if (!isEncrypted){
            return gu.jsonParseOrPassThrough(transaction.decryptedMessage);
        }

        const crypto = new GravityCrypto(process.env.ENCRYPT_ALGORITHM, sharedKey);
        return crypto.decryptAndParseOrNull(transaction.decryptedMessage);
    }


    /**
     *
     * @param {[]} messageTransactions - [{signature, transactionIndex, type, phased, ecBlockId, signatureHash,
     * attachment: {encryptedMessage: {data,nonce, isText, isCompressed},version.ArbitraryMessage,version.EncryptedMessage},
     * senderRS,subtype,amountNQT,recipientRS,block,blockTimestamp,deadline,timestamp,height,senderPublicKey,feeNQT,
     * confirmations,fullHash,version,sender,recipient,ecBlockHeight,transaction}]
     * @param {string} address - ie JUP-123-12345
     * @param {string} passphrase - 12 Word passphrase
     * @param {string} nonce
     * @returns {Promise<unknown>}
     */
    async putReadableMessagesIntoMessageTransactionsAndReturnTransactions(messageTransactions, accountProperties){
        logger.verbose(`#################################################`)
        logger.verbose(`## decipherMessagesFromMessageTransactionsAndReturnTransactions(messageTransactions.length= ${messageTransactions.length}, accountProperties)`)
        logger.verbose(`##`)
        logger.verbose(`##`)
        logger.debug(`accountProperties.address= ${accountProperties.address}`)
        logger.sensitive(`accountProperties.passphrase= ${accountProperties.passphrase}`)
        logger.sensitive(`accountProperties.crypto= ${JSON.stringify(accountProperties.crypto)}`)


        return new Promise((resolve, reject) => {
            let transactions = _.clone(messageTransactions);
            let metisMessagePromises = [];
            transactions.forEach((transaction) => {
                const transactionId = transaction.transaction;
                logger.debug(`transactionId= ${transactionId}`)
                metisMessagePromises.push(
                    new Promise((res, rej) => {
                        this.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
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
     * @param {string} address
     * @param {string} tag
     * @param {number | null} [firstIndex=null]
     * @param {number | null} [lastIndex=null]
     *
     * @returns {Promise<[{senderPublicKey,signature,feeNQT,type,fullHash,version,phased,ecBlockId,signatureHash, attachment: {
     *                  versionMessage,encryptedMessage: {data,nonce,isText,isCompressed},
     *                  versionEncryptedMessage,versionPublicKeyAnnouncement,recipientPublicKey,versionMetisAccountInfo,messageIsText,message},
     *               senderRS,subtype,amountNQT,sender,recipientRS,recipient,ecBlockHeight,deadline,transaction,timestamp,height}]
     *           >}
     */
    async fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(address, tag, firstIndex = null, lastIndex = null, orderBy = 'desc'){
        logger.verbose(`#### fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(address, tag, firstIndex, lastIndex)`);
        if(!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address: ${address}`)
        // if(!gu.isWellFormedJupiterAddress(address)){throw new BadJupiterAddressError(address)}
        if(!gu.isNonEmptyString(tag)){throw new Error('tag is empty')}
        logger.debug(`address= ${JSON.stringify(address)}`);
        logger.debug(`tag= ${JSON.stringify(tag)}`);
        const unconfirmedTransactionsPromise = this.getUnconfirmedTransactionsByTag(address,tag, firstIndex, lastIndex);
        const confirmedTransactionsPromise = this.fetchConfirmedBlockChainTransactionsByTag(address,tag,firstIndex,lastIndex);
        const [confirmedTransactionsResponse, unconfirmendTransactionsResponse] = await Promise.all([confirmedTransactionsPromise, unconfirmedTransactionsPromise]);
        const combinedTransactions = [ ...unconfirmendTransactionsResponse, ...confirmedTransactionsResponse ];
        const hasInvalidTransactions = combinedTransactions.every(t => {
            const valid = this.validator.validateBaseTransaction(t);
            if(!valid.isValid){
                logger.warn(`Transactions from Jupiter are invalid!`)
                logger.sensitive(`${valid.error}`);
                // console.log(valid.errors)
            }
            return valid.isValid;
        })
        if(!hasInvalidTransactions){
            throw new mError.MetisError(`Transactions from Jupiter are invalid!`);
        }
        const sortedCombinedTransactions = this.transactionUtils.sortTransactionsByTimestamp(combinedTransactions, orderBy);
        logger.debug(`sortedCombinedTransactions.length= ${sortedCombinedTransactions.length}`);
        // @TODO Jupiter needs to be fixed!
        return combinedTransactions.filter(transaction => {
            return transaction.hasOwnProperty('attachment') &&
                transaction.attachment.hasOwnProperty('message') &&
                transaction.attachment.message.includes(tag)
        });
    }

    /**
     *
     * @param {string} address
     * @param {string} tag
     * @param {number|null} [firstIndex=null]
     * @param {number|null} [lastIndex=null]
     * @return {Promise<{unconfirmedTransactions: {senderPublicKey, signature, feeNQT, type, fullHash, version, phased, ecBlockId, signatureHash, attachment: {versionMessage, encryptedMessage: {data, nonce, isText, isCompressed}, versionEncryptedMessage, versionPublicKeyAnnouncement, recipientPublicKey, versionMetisAccountInfo, messageIsText, message}, senderRS, subtype, amountNQT, sender, recipientRS, recipient, ecBlockHeight, deadline, transaction, timestamp, height}[], requestProcessingTime}>}
     */

    /**
     *
     * @param address
     * @param tag
     * @param firstIndex
     * @param lastIndex
     * @return {Promise<{senderPublicKey, signature, feeNQT, type, fullHash, version, phased, ecBlockId, signatureHash, attachment: {versionMessage, encryptedMessage: {data, nonce, isText, isCompressed}, versionEncryptedMessage, versionPublicKeyAnnouncement, recipientPublicKey, versionMetisAccountInfo, messageIsText, message}, senderRS, subtype, amountNQT, sender, recipientRS, recipient, ecBlockHeight, deadline, transaction, timestamp, height}[]|*[]>}
     */
    async getUnconfirmedTransactionsByTag(address, tag, firstIndex = null, lastIndex = null) {
        logger.verbose(`#### getUnconfirmedTransactionsByTag(address=${address}, tag=${tag}, firstIndex, lastIndex)`);
        if(!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address: ${address}`)
        if(!gu.isNonEmptyString(tag)){throw new Error('tag is empty')}
        if(firstIndex && !Number.isInteger(firstIndex)){throw new Error(`firstIndex needs to be an int or null`) }
        if(lastIndex && !Number.isInteger(lastIndex)){throw new Error(`lastIndex needs to be an int or null`) }
        if(firstIndex && !lastIndex){
            lastIndex = firstIndex+10;
        }
        try {
            const response = await this.jupiterAPIService.getUnconfirmedBlockChainTransactions(
                address,
                tag,
                true,
                1,
                true,
                firstIndex,
                lastIndex
            )

            if (!response.hasOwnProperty('data')) {
                throw new mError.MetisError('getUnconfirmedBlockChainTransactions returned invalid response. Missing "data"');
            }
            if (!response.data.hasOwnProperty('unconfirmedTransactions')) {
                console.log(response.data);
                throw new mError.MetisError('getUnconfirmedBlockChainTransactions returned invalid response. Missing "data.unconfirmedTransactions"');
            }
            if (!Array.isArray(response.data.unconfirmedTransactions)) {
                console.log(response.data.unconfirmedTransactions);
                throw new mError.MetisError('getUnconfirmedBlockChainTransactions returned invalid response. Not Array "data.unconfirmedTransactions"');
            }
            const transactions = response.data.unconfirmedTransactions;

            transactions.forEach(t => {
                if(!(t.hasOwnProperty('attachment') && t.attachment.hasOwnProperty('message'))){
                    console.log(`\n`);
                    logger.warn(`???? UNCONFIRMED ??`)
                    logger.warn(`?? Tags arent working! this transaction doesnt belong, Json not well formed`);
                    logger.warn(`?? tag= ${tag}`);
                    console.log(t);
                } else if(!t.attachment.message.includes(tag)){
                    logger.warn(`???? UNCONFIRMED ??`)
                    logger.warn(`?? Tags arent working! this transaction doesnt belong. Tag is missing`);
                    logger.warn(`?? tag= ${tag}`);
                    console.log(t);
                }
            })
            return transactions.filter(transaction => {
                return transaction.hasOwnProperty('attachment') &&
                    transaction.attachment.hasOwnProperty('message') &&
                    transaction.attachment.message.includes(tag)
            });

        }catch(error){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** getUnconfirmedTransactionsByTag().catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }

    /**
     *
     * @param address
     * @return {Promise<[Transactions]>}
     */
    async getAllConfirmedAndUnconfirmedBlockChainTransactions(address) {
        logger.verbose(`#### getAllConfirmedAndUnconfirmedBlockChainTransactions(address=${address})`);
        try {
            const confirmedTransactions = this.jupiterAPIService.getBlockChainTransactions(address);
            const unconfirmedTransactions = this.jupiterAPIService.getUnconfirmedBlockChainTransactions(address);
            const [confirmedTransactionsResponse, unconfirmendTransactionsResponse] = await Promise.all([confirmedTransactions, unconfirmedTransactions])
            const confirmed = confirmedTransactionsResponse.data.transactions;
            const unconfirmend = unconfirmendTransactionsResponse.data.unconfirmedTransactions;

            return [...confirmed, ...unconfirmend];
        } catch (error) {
            throw error;
        }
    }

    /**
     *
     * @param address
     * @param tag
     * @param firstIndex
     * @param lastIndex
     * @return {Promise<{signature, transactionIndex, type, phased, ecBlockId, signatureHash, attachment: {encryptedMessage: {data, nonce, isText, isCompressed}, versionMetisMetaData, versionEncryptedMessage}, senderRS, subtype, amountNQT, recipientRS, block, blockTimestamp, deadline, timestamp, height, senderPublicKey, feeNQT, confirmations, fullHash, version, sender, recipient, ecBlockHeight, transaction}[]|*[]>}
     */
    async fetchConfirmedBlockChainTransactionsByTag(address, tag, firstIndex= null, lastIndex= null) {
        logger.verbose(`#### fetchConfirmedBlockChainTransactionsByTag(address=${address}, tag=${tag}, firstIndex, lastIndex)`);
        if(!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address: ${address}`)
        if(!tag){throw new Error('tag is empty')}
        if(firstIndex && !Number.isInteger(firstIndex)){throw new Error(`firstIndex needs to be an int or null`) }
        if(lastIndex && !Number.isInteger(lastIndex)){throw new Error(`lastIndex needs to be an int or null`) }
        if(firstIndex && !lastIndex){
            lastIndex = firstIndex+10;
        }

        const transactionsResponse = await this.jupiterAPIService.getBlockChainTransactions(
            address,
            tag,
            true,
            1,
            true,
            firstIndex,
            lastIndex
        )

        if(!transactionsResponse.data) {
            return [];
        }
        const transactionsData = transactionsResponse.data;
        if(!transactionsData.hasOwnProperty('transactions')){
            return []
        }
        if(!Array.isArray(transactionsData.transactions)){
            return []
        }
        const transactions = transactionsData.transactions;
        const filteredTransactions =  transactions.filter( t => {
            const valid = this.validator.validateBaseTransaction(t);
            if(!valid.isValid){
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                logger.info(`++ this transaction coming from Jupiter is not valid!!!`);
                logger.info(`++ ${JSON.stringify(t)}`);
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                console.log(t);
            }
            return valid.isValid;
        })

        filteredTransactions.forEach(t => {
            if(!(t.hasOwnProperty('attachment') && t.attachment.hasOwnProperty('message'))){
                console.log(`\n`);
                logger.warn('???????????????????????????????????????????????');
                logger.warn(`?? CONFIRMED TRANS.`)
                logger.warn(`?? Tags arent working! this transaction doesnt belong, Json not well formed`);
                logger.warn(`?? tag= ${tag}`);
                logger.warn('???????????????????????????????????????????????\n');
                console.log(t);
            } else if(!t.attachment.message.includes(tag)){
                logger.warn('???????????????????????????????????????????????');
                logger.warn(`?? CONFIRMED TRANS.`)
                logger.warn(`?? Tags arent working! this transaction doesnt belong. Tag is missing`);
                logger.warn(`?? tag= ${tag}`);
                logger.warn('???????????????????????????????????????????????\n');
                console.log(t);
            }
        })

        return transactions.filter(transaction => {
            return transaction.hasOwnProperty('attachment') &&
                transaction.attachment.hasOwnProperty('message') &&
                transaction.attachment.message.includes(tag)
        });



        return filteredTransactions;
    }

    /**
     *
     * @param accountProperties
     * @return {Promise<{message, transactionId}[]>}
     */
    async fetchUnconfirmedMessages(accountProperties) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## fetchUnconfirmedMessages(accountProperties)`);
        logger.sensitive(`## fetchUnconfirmedMessages(accountProperties= ${!!accountProperties})`);
        logger.verbose('#####################################################################################');
        logger.sensitive(`accountProperties= ${JSON.stringify(accountProperties)}`);

        const unconfirmedTransactionsResponse = await this.jupiterAPIService.getUnconfirmedBlockChainTransactions(accountProperties.address);

        return await this.messageService.readMessagesFromMessageTransactionsAndDecryptOrPassThroughAndReturnMessageContainers(
            unconfirmedTransactionsResponse,
            accountProperties.crypto,
            accountProperties.passphrase
        )
    }

    /**
     * @description fetches all transaction messages sent to self.
     * @todo retire this function!
     * @param accountProperties
     * @param decipherWith
     * @return {Promise<Transactions[]>}
     */
    fetchAllMessagesBySender(accountProperties, decipherWith= null) {
        logger.verbose('###########################################################################');
        logger.verbose(`## fetchAllMessagesBySender(accountProperties, decipherWith)`);
        logger.verbose('##');

        return this.getAllConfirmedAndUnconfirmedBlockChainTransactions(accountProperties.address).then(
            transactions => {
            return this.messageService.fetchAllMessagesBySender(transactions,accountProperties,decipherWith);
        })
    }

    /**
     *
     * @param gravityAccountProperties
     * @param listTag
     * @param isMetisEncrypted
     * @return {Promise<{message,transactionId}[]>}
     */
    async dereferenceListAndGetReadableTaggedMessageContainers(gravityAccountProperties, listTag, isMetisEncrypted = true) {
        logger.verbose(`#### dereferenceListAndGetReadableTaggedMessageContainers(gravityAccountProperties, listTag, isMetisEncrypted)`);
        if(!(gravityAccountProperties instanceof GravityAccountProperties)){throw new Error('gravityAccountProperties is invalid')}
        if(!listTag){throw new Error('listTag is invalid')}
        try {
            const latestReferenceList = await this.fetchLatestReferenceList(gravityAccountProperties, listTag, isMetisEncrypted);
            let messages = [];
            //@TODO instead of forEach use the Tag to fetch and then remove if not in the list
            latestReferenceList.forEach(transactionId => {
                messages.push(this.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecryptOrPassThrough(
                    transactionId,
                    gravityAccountProperties.crypto,
                    gravityAccountProperties.passphrase)
                );
            })
            return await Promise.all(messages);
        } catch(error) {
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** dereferenceListAndGetReadableTaggedMessageContainers(gravityAccountProperties, listTag, isMetisEncrypte).catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }


    /**
     *
     * @param gravityAccountProperties
     * @param listTag
     * @param isMetisEncrypted
     * @return {Promise<*[]|*>}
     */
    async fetchLatestReferenceList(gravityAccountProperties,listTag, isMetisEncrypted = true ){
        logger.verbose(`#### fetchLatestReferenceList(gravityAccountProperties, listTag, isMetisEncrypted)`);
        if(!(gravityAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`gravityAccountProperties`)
        if(!listTag){throw new mError.MetisError('listTag is invalid')}

        try {
            const listContainers = await this.getReadableTaggedMessageContainers(gravityAccountProperties, listTag, isMetisEncrypted);
            if (listContainers.length === 0) {
                logger.warn(`No list found for ${gravityAccountProperties.address}: ${listTag}`);
                return []
            }
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            logger.info(`++ History of all the Reference Lists`);
            logger.info(`- Number of Lists: ${listContainers.length}`);
            logger.info(`- listTag: ${listTag}`);
            logger.info(`- account: ${gravityAccountProperties.address}`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            // Get Latest Good List
            const latestListContainer = listContainers.find(listContainer => {
                // The value of the first element in the array that satisfies the provided testing function. Otherwise, undefined is returned.
                const list = listContainer.message;
                if (!Array.isArray(list)) return false
                if (list.length === 0) return false
                //The every() method tests whether all elements in the array pass the test implemented by the provided function. It returns a Boolean value.
                return list.every(item => {
                    return gu.isWellFormedJupiterTransactionId(item);
                })
            })
            if (latestListContainer === undefined) {
                logger.warn(`No Good List Found for ${gravityAccountProperties.address} using ${listTag}`);
                return [];
            }
            // const latestListContainer = listContainers.shift();
            const transactionIds = latestListContainer.message;
            logger.info(`- latest list of referenced transactions: ${transactionIds}`);

            return transactionIds;
        } catch (error){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** fetchLatestReferenceList(gravityAccountProperties,listTag, isMetisEncrypted).catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }


    /**
     *
     * @param {string} address
     * @param {string} passphrase
     * @param {string} nonce
     */
    async getSharedKey(address, passphrase, nonce){
        try{
            const response = await this.jupiterAPIService.getSharedKey(address, passphrase, nonce);
            return response.data.sharedKey;
        } catch (error){
            logger.error('********* Error getting shared key **************')
         throw error;
        }
    }

}

module.exports.JupiterTransactionsService = JupiterTransactionsService;
module.exports.jupiterTransactionsService = new JupiterTransactionsService(
    jupiterAPIService,
    jupiterTransactionMessageService,
    transactionUtils,
    validator
);
