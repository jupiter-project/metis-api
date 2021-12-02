const gu = require('../utils/gravityUtils');
const _ = require("lodash");
// const {GravityCrypto} = require("./gravityCrypto");
const logger = require('../utils/logger')(module);
const {jupiterAPIService, JupiterAPIService} = require("./jupiterAPIService");
// const {FeeManager} = require("../services/FeeManager");
const {jupiterTransactionMessageService} = require("./jupiterTransactionMessageService");
const {transactionUtils} = require("../gravity/transactionUtils");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {add} = require("lodash");

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





    // isValidEncryptedMessageTransaction(){
    //     const transactionProperties = ['recipientPublicKey']
    // }


    // return !!transaction.attachment.encryptedMessage.data;

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
     * @param {object} transactions - {?}
     * @param {string} password - Password used for encryption/decryption
     * @returns {object}
     */
    // decryptTransactionMessagesAndReturnUpdatedTransactions(transactions, algorithm, password) {
    //
    //     console.log('---_----')
    //     throw new Error('FIX THIS!!!..')
    //
    //
    //     logger.verbose(`decryptTransactionMessages()`);
    //     const gravityCrypt = new GravityCrypto(algorithm, password);
    //     const updatedTransactions = transactions.map(transaction => {
    //         let updatedTransaction = _.clone(transaction);
    //         const message = transaction.attachment.encryptedMessage.data;
    //         const decryptedMessage = gravityCrypt.decrypt(message);
    //         updatedTransaction.decryptedMessage = decryptedMessage;
    //         // const decryptedMessage = this.decryptOrNull(message, password)
    //         return updatedTransaction;
    //         // return decryptedMessage;
    //     });
    //     logger.verbose(`TOTAL decrypted Messages ${updatedTransactions.length}`);
    //     const cleanedTransactions = updatedTransactions.filter(transaction => transaction != null);
    //     logger.verbose(`cleanedTransactions =   ${cleanedTransactions.length}`);
    //     return cleanedTransactions;
    // }


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
     * {"unconfirmedTransactions":[],"requestProcessingTime":0}
     *
     * @param address
     * @returns {Promise<*>}
     */
    // async getUnconfirmedBlockChainTransactions(accountProperties) {
    //     logger.verbose('----------------------------------------');
    //     logger.verbose(`fetchUnconfirmedBlockChainTransactions(accountProperties: ${!!accountProperties})`);
    //     logger.verbose('----------------------------------------');
    //     logger.verbose(`accountProperties.address= ${accountProperties.address}`)
    //
    //     return this.jupiterAPIService.jupiterRequest('get', {
    //         requestType: 'getUnconfirmedTransactions',
    //         account: accountProperties.address
    //     });
    // }


    async getReadableTaggedMessageContainers(gravityAccountProperties, tag, isMetisEncrypted = true){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getReadableTaggedMessageContainers(gravityAccountProperties, tag, isMetisEncrypted = true)`);
        logger.verbose(`## `);
        if (!gravityAccountProperties instanceof GravityAccountProperties){
            throw new Error('memberAccountProperties is invalid')
        }
        if(!gu.isNonEmptyString(tag)){throw new Error('tag is invalid')};
        logger.sensitive(`gravityAccountProperties.address= ${JSON.stringify(gravityAccountProperties.address)}`);
        logger.sensitive(`tag= ${tag}`);
        const transactions = await this.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(
            gravityAccountProperties.address,
            tag
        )

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
     * @param address
     * @param tag
     * @returns {Promise<[{senderPublicKey,signature,feeNQT,type,fullHash,version,phased,ecBlockId,signatureHash, attachment: {
     *                  versionMessage,encryptedMessage: {data,nonce,isText,isCompressed},
     *                  versionEncryptedMessage,versionPublicKeyAnnouncement,recipientPublicKey,versionMetisAccountInfo,messageIsText,message},
     *               senderRS,subtype,amountNQT,sender,recipientRS,recipient,ecBlockHeight,deadline,transaction,timestamp,height}]
     *           >}
     */
    async getConfirmedAndUnconfirmedBlockChainTransactionsByTag(address, tag){
        logger.sensitive(`#### getConfirmedAndUnconfirmedBlockChainTransactionsByTag(address, tag)`);
        if(!gu.isWellFormedJupiterAddress(address)){throw new Error('address is invalid')}
        if(!gu.isNonEmptyString(tag)){throw new Error('tag is empty')}
        logger.sensitive(`address= ${JSON.stringify(address)}`);
        logger.sensitive(`tag= ${JSON.stringify(tag)}`);
        const confirmedTransactionsPromise = this.getBlockChainTransactionsByTag(address,tag);
        const unconfirmedTransactionsPromise = this.getUnconfirmedTransactionsByTag(address,tag);
        const [confirmedTransactionsResponse, unconfirmendTransactionsResponse] = await Promise.all([confirmedTransactionsPromise, unconfirmedTransactionsPromise])
        const confirmedTransactions = confirmedTransactionsResponse;
        const unconfirmendTransactions = unconfirmendTransactionsResponse;
        const combinedTransactions = [ ...confirmedTransactionsResponse, ...unconfirmendTransactionsResponse ];
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        logger.info(`++ combinedTransactions.length= ${combinedTransactions.length}`);
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        return combinedTransactions.filter(transaction => {
            return transaction.hasOwnProperty('attachment') &&
                transaction.attachment.hasOwnProperty('message') &&
                transaction.attachment.message.includes(tag)
        });
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
     *
     * @param address
     * @param tag
     * @returns {Promise<T>}
     */
    getUnconfirmedTransactionsByTag(address, tag) {
        logger.verbose(` ###################################################################################`);
        logger.verbose(` ## getBlockChainTransactionsByTag(channelAccount, tag)`);
        logger.sensitive(`## - address=${JSON.stringify(address)}`);
        logger.sensitive(`## - tag=${JSON.stringify(tag)}`);
        if(!gu.isNonEmptyString(address)){throw new Error('address is empty')}
        if(!gu.isNonEmptyString(tag)){throw new Error('tag is empty')}

        return this.jupiterAPIService.getUnconfirmedBlockChainTransactions(address, tag, true)
            .then( response => {
                if(!response.hasOwnProperty('data')){ return []}
                if(!response.data.hasOwnProperty('unconfirmedTransactions')){ return []}
                if(!Array.isArray(response.data.unconfirmedTransactions)){return []}

                const transactions = response.data.unconfirmedTransactions;

                console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
                console.log(`tag= ${tag}`)
                console.log('transactions');
                console.log(transactions);
                console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')

                const messageTransactions = transactions.filter( transaction => {
                    return transaction.hasOwnProperty('attachment') &&
                        transaction.attachment.hasOwnProperty('message') &&
                        transaction.attachment.message.includes(tag)
                })

                return messageTransactions;
            })
    }

    /**
     *
     * @param address
     * @returns {Promise<unknown>}
     */
    async getAllConfirmedAndUnconfirmedBlockChainTransactions(address) {
        logger.verbose(`  ########################################################################`);
        logger.verbose(`  ## getAllConfirmedAndUnconfirmedBlockChainTransactions(address)`);
        logger.sensitive(`## - address= ${JSON.stringify(address)}`);

        return new Promise((resolve, reject) => {
            const confirmedTransactions = this.jupiterAPIService.getBlockChainTransactions(address);
            const unconfirmedTransactions = this.jupiterAPIService.getUnconfirmedBlockChainTransactions(address);

            Promise.all([confirmedTransactions, unconfirmedTransactions])
                .then( ([confirmedTransactionsResponse, unconfirmendTransactionsResponse]) => {
                const confirmedTransactions = confirmedTransactionsResponse.data.transactions;
                const unconfirmendTransactions = unconfirmendTransactionsResponse.data.unconfirmedTransactions;
                resolve([ ...confirmedTransactions, ...unconfirmendTransactions ]);
            })

        });
    }




    /**
     *
     * @param address
     * @param tag
     * @returns {Promise<[{signature, transactionIndex,type,phased,ecBlockId,signatureHash,
     *                    attachment: {
         *               encryptedMessage: {data, nonce, isText, isCompressed},
         *               version.MetisMetaData,
         *               version.EncryptedMessage,
         *               version.Message,
         *               version.OrdinaryPayment,
         *               MessageIsText
         *               message
     *               },
     *               senderRS,subtype,amountNQT, recipientRS,block, blockTimestamp,deadline, timestamp,height,
     * senderPublicKey,feeNQT,confirmations,fullHash, version,sender, recipient, ecBlockHeight,transaction}]>}
     */
    getBlockChainTransactionsByTag(address, tag) {
        logger.sensitive(`#### getBlockChainTransactionsByTag(address=${address}, tag=${tag})`);
        if(!address){throw new Error('address is empty')}
        if(!tag){throw new Error('tag is empty')}

        return this.jupiterAPIService.getBlockChainTransactions(address, tag, true)
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
     * @param address
     * @param passphrase
     * @param password
     * @returns {Promise<unknown>}
     */
    // async fetchUnconfirmedAndDecryptedTransactionMessages(accountProperties) {
    //     logger.verbose('#####################################################################################');
    //     logger.verbose(`## fetchUnconfirmedTransactions(accountProperties)`)
    //     logger.verbose('##');
    //     logger.sensitive(`accountProperties= ${JSON.stringify(accountProperties)}`);
    //
    //     return new Promise((resolve, reject) => {
    //         this.jupiterAPIService.getUnconfirmedBlockChainTransactions(accountProperties)
    //             .then((response) => {
    //                 logger.verbose('----------------------------------------');
    //                 logger.verbose(`-- fetchUnconfirmedAndDecryptedTransactionMessages().then()`)
    //                 logger.verbose('--');
    //                 logger.verbose(`TOTAL unconfirmed blockchain transactions: ${response.data.unconfirmedTransactions.length}`);
    //
    //                 const unconfirmedTransactionsContainer = response.data; //data: { unconfirmedTransactions: [], requestProcessingTime: 0 } }
    //
    //                 if (!this.isValidUnconfirmedTransactionsContainer(unconfirmedTransactionsContainer)) {
    //                     throw new Error('the unconfirmed transactions container is malformed');
    //                 }
    //
    //                 if (unconfirmedTransactionsContainer.unconfirmedTransactions.length <= 0) {
    //                     logger.debug(`No Unconfirmed Transactions Founds.`)
    //                     return resolve([])
    //                 }
    //
    //                 const unconfirmedMessageTransactions = this.transactionUtils.filterEncryptedMessageTransactions(unconfirmedTransactionsContainer.unconfirmedTransactions);
    //                 logger.verbose(`TOTAL unconfirmedMessageTransactions: ${unconfirmedMessageTransactions.length}`);
    //
    //                 const unconfirmedMessageTransactionsFromAddress = this.transactionUtils.filterMessageTransactionsBySenderOrRecipient(unconfirmedMessageTransactions, accountProperties.address);
    //                 logger.verbose(`TOTAL unconfirmedMessageTransactionsFromAddress: ${unconfirmedMessageTransactionsFromAddress.length}`);
    //                 this.putReadableMessagesIntoMessageTransactionsAndReturnTransactions(unconfirmedMessageTransactionsFromAddress, accountProperties)
    //                     .then((jDecryptedUnconfirmedMessageTransactions) => {
    //                         logger.verbose('--------------------------------------------');
    //                         logger.verbose(`fetchUnconfirmedAndDecryptedTransactionMessages().getUnconfirmedBlockChainTransactions().then().decipherMessagesFromMessageTransactionsAndReturnTransactions().then(jDecryptedUnconfirmedMessageTransactions)`);
    //                         logger.verbose('--------------------------------------------');
    //                         logger.verbose(`jDecryptedUnconfirmedMessageTransactions.length= ${jDecryptedUnconfirmedMessageTransactions.length}`);
    //
    //
    //
    //                         logger.error('looks not good!!!')
    //                         throw new Error('looks not good!!!')
    //
    //                         const decryptedTransactionMessages = this.decryptTransactionMessagesAndReturnUpdatedTransactions(
    //                             jDecryptedUnconfirmedMessageTransactions,
    //                             accountProperties.algorithm,
    //                             accountProperties.password);
    //
    //                         logger.verbose(`TOTAL mDecryptedUnconfirmedMessageTransactions: ${decryptedTransactionMessages.length}`);
    //                         console.log('3333 = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = ')
    //                         resolve(decryptedTransactionMessages);
    //                     })
    //                     .catch(error => {
    //                         logger.error(`jupiterDecryptMessagesFromMessageTransactionsAndReturnTransaction().catch(error)`)
    //                         logger.error(`error=${error}`)
    //                         reject(error);
    //                     })
    //             })
    //             .catch(error => {
    //                 logger.error(`fetchUnconfirmedTransactions().getUnconfirmedBlockChainTransactions().catch() ${error}`);
    //                 reject(error);
    //             })
    //     })
    // }

    // getUnconfirmedTransactionsByTag(address, tag) {
    //     logger.verbose(`###################################################################################`);
    //     logger.verbose(`## getBlockChainTransactionsByTag(channelAccount, tag)`);
    //     logger.verbose(`## `);
    //     logger.sensitive(`address=${JSON.stringify(address)}`);
    //     logger.sensitive(`tag=${JSON.stringify(tag)}`);
    //     if(!address){throw new Error('address is empty')}
    //     if(!tag){throw new Error('tag is empty')}
    //
    //     return this.jupiterAPIService.getUnconfirmedBlockChainTransactions(address, tag, true)
    //         .then( response => {
    //             if(!response.hasOwnProperty('data')){ return []}
    //             if(!response.data.hasOwnProperty('transactions')){ return []}
    //             if(!Array.isArray(response.data.transactions)){return []}
    //
    //             return response.data.transactions.filter(transaction => {
    //                 return transaction.hasOwnProperty('attachment') &&
    //                     transaction.attachment.hasOwnProperty('message') &&
    //                     transaction.attachment.message === tag;
    //             });
    //         })
    // }


    /**
     *
     * @returns {Promise<unknown>}
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
        logger.verbose(`    ########################################################################`);
        logger.verbose(`    ## dereferenceListAndGetReadableTaggedMessageContainers(gravityAccountProperties, listTag, isMetisEncrypted)`);
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
