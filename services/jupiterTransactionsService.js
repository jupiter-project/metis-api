const gu = require('../utils/gravityUtils');
const _ = require("lodash");
// const {GravityCrypto} = require("./gravityCrypto");
const logger = require('../utils/logger')(module);
const {jupiterAPIService, JupiterAPIService} = require("./jupiterAPIService");
// const {FeeManager} = require("../services/FeeManager");
const {jupiterTransactionMessageService} = require("./jupiterTransactionMessageService");
const {transactionUtils} = require("../gravity/transactionUtils");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {add, first} = require("lodash");
const {BadJupiterAddressError} = require("../errors/metisError");
// const {FeeManager} = require("./FeeManager");

class JupiterTransactionsService {

    /**
     *
     * @param jupiterAPIService
     * @param jupiterTransactionMessageService
     * @param transactionUtils
     */
    constructor(jupiterAPIService, jupiterTransactionMessageService, transactionUtils) {
        if(!(jupiterAPIService instanceof JupiterAPIService)){throw new Error('jupiterApiServer not valid')}
        this.jupiterAPIService = jupiterAPIService;
        this.messageService = jupiterTransactionMessageService;
        this.transactionUtils = transactionUtils;
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
    async getBlockChainMessageTransactions(account) {
        logger.verbose(`getBlockChainMessageTransactions(account ${account})`);
        return new Promise((resolve, reject) => {
            this.jupiterAPIService.getBlockChainTransactions(account)
                .then((blockChainTransactions) => {
                    logger.debug(`getBlockChainMessageTransactions().getBlockChainTransactions(account: ${account}).then()`);
                    logger.debug(`blockChainTransactions count ${blockChainTransactions.length}`)

                    const messageTransactions = this.transactionFilter.filterMessageTransactions(blockChainTransactions);
                    resolve(messageTransactions);
                })
                .catch((error) => {
                    logger.error(`${error}`);
                    reject(error);
                });
        });
    }

    /**
     *
     * @param {GravityAccountProperties} gravityAccountProperties
     * @param {string} tag
     * @param {boolean} [isMetisEncrypted=true]
     * @param {number|null} [firstIndex=null]
     * @param {number|null} [lastIndex=null]
     * @return {Promise<Array|{message, transactionId}[]|*[]>}
     */
    async getReadableTaggedMessageContainers(gravityAccountProperties, tag, isMetisEncrypted = true, firstIndex = null, lastIndex = null){
        logger.verbose(`#### getReadableTaggedMessageContainers(gravityAccountProperties, tag=${tag}, isMetisEncrypted=${isMetisEncrypted})`);
        logger.verbose(`- gravityAccountProperties.address=${gravityAccountProperties.address}`);
        if (!gravityAccountProperties instanceof GravityAccountProperties){
            throw new Error('memberAccountProperties is invalid')
        }
        if(!gu.isNonEmptyString(tag)){throw new Error('tag is invalid')};
        const transactions = await this.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(
            gravityAccountProperties.address,
            tag,
            firstIndex,
            lastIndex
        );

        console.log(`\n\n\n`);
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
        console.log('getConfirmedAndUnconfirmedBlockChainTransactionsByTag');
        console.log(transactions.length);
        console.log(`=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n\n\n`)


        return this.messageService.getReadableMessageContainers(transactions, gravityAccountProperties, isMetisEncrypted);
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
        logger.debug(`accountProperties.passphrase= ${accountProperties.passphrase}`)
        logger.debug(`accountProperties.crypto= ${JSON.stringify(accountProperties.crypto)}`)


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
    async getConfirmedAndUnconfirmedBlockChainTransactionsByTag(address, tag, firstIndex = null, lastIndex = null, orderBy = 'desc'){
        logger.sensitive(`#### getConfirmedAndUnconfirmedBlockChainTransactionsByTag(address, tag, firstIndex, lastIndex)`);
        if(!gu.isWellFormedJupiterAddress(address)){throw new BadJupiterAddressError(address)}
        // if(!gu.isWellFormedJupiterAddress(address)){throw new Error('address is invalid')}
        if(!gu.isNonEmptyString(tag)){throw new Error('tag is empty')}
        logger.sensitive(`address= ${JSON.stringify(address)}`);
        logger.sensitive(`tag= ${JSON.stringify(tag)}`);

        const confirmedTransactionsPromise = this.getBlockChainTransactionsByTag(address,tag,firstIndex,lastIndex);

        const unconfirmedTransactionsPromise = this.getUnconfirmedTransactionsByTag(address,tag, firstIndex, lastIndex);

        const [confirmedTransactionsResponse, unconfirmendTransactionsResponse] = await Promise.all([confirmedTransactionsPromise, unconfirmedTransactionsPromise]);
        const combinedTransactions = [ ...unconfirmendTransactionsResponse, ...confirmedTransactionsResponse ];


        combinedTransactions.sort((a,b) => {
            if(orderBy === 'desc'){
                return new Date(b.timestamp) - new Date(a.timestamp)
            }

            if (orderBy === 'asc'){
                return new Date(a.timestamp) - new Date(b.timestamp);
            }

            throw new Error(`orderBy is invalid ${orderBy}`);
        });



        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        logger.info(`++ combinedTransactions.length= ${combinedTransactions.length}`);
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
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
    getUnconfirmedTransactionsByTag(address, tag, firstIndex = null, lastIndex = null) {
        logger.verbose(`#### getUnconfirmedTransactionsByTag(address=${address}, tag=${tag})`);
        if(!gu.isNonEmptyString(address)){throw new Error('address is empty')}
        if(!gu.isNonEmptyString(tag)){throw new Error('tag is empty')}
        if(firstIndex && !Number.isInteger(firstIndex)){throw new Error(`firstIndex needs to be an int or null`) }
        if(lastIndex && !Number.isInteger(lastIndex)){throw new Error(`lastIndex needs to be an int or null`) }

        if(firstIndex && !lastIndex){
            lastIndex = firstIndex+10;
        }

        return this.jupiterAPIService.getUnconfirmedBlockChainTransactions(address, tag, true, 1, true,firstIndex,lastIndex)
            .then( response => {
                if(!response.hasOwnProperty('data')){ return []}
                if(!response.data.hasOwnProperty('unconfirmedTransactions')){ return []}
                if(!Array.isArray(response.data.unconfirmedTransactions)){return []}
                const transactions = response.data.unconfirmedTransactions;
                return transactions.filter(transaction => {
                    return transaction.hasOwnProperty('attachment') &&
                        transaction.attachment.hasOwnProperty('message') &&
                        transaction.attachment.message.includes(tag)
                });
            })
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
     * @param {string} address
     * @param {string} tag
     * @param {number|null} [firstIndex=null]
     * @param {number|null} [lastIndex=null]
     * @returns {Promise<[{signature, transactionIndex,type,phased,ecBlockId,signatureHash,
     *                    attachment: {
         *               encryptedMessage: {data, nonce, isText, isCompressed},
         *               versionMetisMetaData,
         *               versionEncryptedMessage,
         *               versionMessage,
         *               versionOrdinaryPayment,
         *               MessageIsText,
         *               message
     *               },
     *               senderRS,subtype,amountNQT, recipientRS,block, blockTimestamp,deadline, timestamp,height,
     *                senderPublicKey,feeNQT,confirmations,fullHash, version,sender, recipient, ecBlockHeight,transaction}]>}
     */
    getBlockChainTransactionsByTag(address, tag, firstIndex= null, lastIndex= null) {
        logger.sensitive(`#### getBlockChainTransactionsByTag(address=${address}, tag=${tag})`);
        if(!address){throw new Error('address is empty')}
        if(!tag){throw new Error('tag is empty')}
        if(firstIndex && !Number.isInteger(firstIndex)){throw new Error(`firstIndex needs to be an int or null`) }
        if(lastIndex && !Number.isInteger(lastIndex)){throw new Error(`lastIndex needs to be an int or null`) }

        if(firstIndex && !lastIndex){
            lastIndex = firstIndex+10;
        }

        return this.jupiterAPIService.getBlockChainTransactions(address, tag, true,1,true,firstIndex,lastIndex)
            .then( response => {
                if(!response.hasOwnProperty('data')){ return []}
                if(!response.data.hasOwnProperty('transactions')){ return []}
                if(!Array.isArray(response.data.transactions)){return []}
                return response.data.transactions.filter(transaction => {
                    return transaction.hasOwnProperty('attachment') &&
                        transaction.attachment.hasOwnProperty('message') &&
                        transaction.attachment.message.includes(tag)
                });
            })
    }

    /**
     *
     * @param accountProperties
     * @return {Promise<{message, transactionId}[]>}
     */
    async fetchUnconfirmedMessages(accountProperties) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## fetchUnconfirmedMessages(accountProperties= ${!!accountProperties})`);
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
     *
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
     * @returns {Promise<*>}
     */
    dereferenceListAndGetReadableTaggedMessageContainers(gravityAccountProperties, listTag, isMetisEncrypted = true) {
        logger.verbose(`#### dereferenceListAndGetReadableTaggedMessageContainers(gravityAccountProperties, listTag, isMetisEncrypted)`);
        if( ! gravityAccountProperties instanceof GravityAccountProperties){throw new Error('gravityAccountProperties is invalid')}
        if(!listTag){throw new Error('listtag is invalid')}

        return this.getReadableTaggedMessageContainers(gravityAccountProperties, listTag, isMetisEncrypted)
            .then( listContainers => {
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                logger.info(`++ all the Lists History`);
                logger.info(`- Number of Lists: ${listContainers.length}`);
                logger.info(`- listTag: ${listTag}`);
                logger.info(`- account: ${gravityAccountProperties.address}`);
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                if(listContainers.length === 0){
                    logger.warn(`No list found for ${gravityAccountProperties.address}: ${listTag}`);
                    return []
                }
                const latestListContainer = listContainers.shift();
                const transactionIds = latestListContainer.message;
                logger.info(`- latest list of referenced transactions: ${transactionIds}`);
                const messages = []
                transactionIds.forEach(transactionId => {
                    messages.push(this.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecryptOrPassThrough(
                        transactionId,
                        gravityAccountProperties.crypto,
                        gravityAccountProperties.passphrase)
                    );
                })

                return Promise.all(messages);
            })
    }

}

module.exports.jupiterTransactionsService = new JupiterTransactionsService(
    jupiterAPIService,
    jupiterTransactionMessageService,
    transactionUtils
);
