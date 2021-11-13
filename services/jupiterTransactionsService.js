const {GravityCrypto} = require("./gravityCrypto");
const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');
const _ = require("lodash");
const {jupiterAPIService} = require("./jupiterAPIService");


class JupiterTransactionsService {

    /**
     *
     * @param jupiterAPIService
     */
    constructor(jupiterAPIService) {
        if(!jupiterAPIService){throw new Error('missing jupiterAPIService')}
        this.jupiterAPIService = jupiterAPIService;
    }

    /**
     *
     * @param transaction
     * @returns {boolean}
     */
    // isTransactionAMessage(transaction) {
    //     // logger.verbose(`isTransactionAMessage()`);
    //     if (!this.isValidBaseTransaction(transaction)) {
    //         return false;
    //     }
    //
    //     return this.isValidMessageTransaction(transaction)
    // }

    /**
     *
     * @param unconfirmedTransactionsContainer
     * @returns {arg is any[]|boolean}
     */
    isValidUnconfirmedTransactionsContainer(unconfirmedTransactionsContainer) {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## isValidUnconfirmedTransactionsContainer(unconfirmedTransactionsContainer)`);
        logger.verbose(`## `);
        logger.sensitive(`unconfirmedTransactionsContainer=${JSON.stringify(unconfirmedTransactionsContainer)}`);

        try {
            const unconfirmedTransactions = unconfirmedTransactionsContainer.unconfirmedTransactions;
            const requestProcessingTime = unconfirmedTransactionsContainer.requestProcessingTime;
            const isValid =  Array.isArray(unconfirmedTransactions);
            logger.debug(`isValidUnconfirmedTransactionsContainer= ${isValid}`)
            return isValid
        } catch (error) {
            logger.debug(`isValidUnconfirmedTransactionsContainer= false`)
            return false;
        }
    }

    /**
     *
     * @param transaction
     * @returns {boolean}
     */
    isValidUnconfirmedTransaction(transaction) {
        const transactionProperties = ['unconfirmedTransactions', 'requestProcessingTime']
        try {
            const transactionKeys = (Object.keys(transaction));
            for (let i = 0; i < transactionProperties.length; i++) {
                if (transactionKeys.indexOf(transactionProperties[i]) === -1) {
                    return false;
                }
            }
            return true;
        } catch (error) {
            return false;
        }
    }


    /**

     * @param transactions
     * @returns {boolean}
     */
    areValidTransactions(transactions) {
        logger.verbose('############################################3');
        logger.verbose('## areValidTransactions(transactions)');
        logger.verbose('##');
        logger.error('use ajv!!!')
        if (!Array.isArray(transactions)) {
            logger.error('-- not Array');
            return false;
        }
        logger.verbose(`transactions.length=${transactions.length}`);

        if (transactions.length <= 0) {
            logger.error('-- empty array passed in');
            return false
        }

        // logger.debug(`-- Total transactions to validate: ${transactions.length}`)

        for (let i = 0; i < transactions.length; i++) {
            if (!this.isValidBaseTransaction(transactions[i])) {
                logger.error(` -- invalid transaction`);
                logger.sensitive(`this.isValidBaseTransaction(transactions[i]) = ${JSON.stringify(transactions[i])}`)
                return false;
            }
        }
        // logger.verbose(` -- Transactions are valid.`);
        return true;
    }


    // isValidMessageTransaction(){
    //     const transactionProperties = ['recipientPublicKey']
    // }


    // return !!transaction.attachment.encryptedMessage.data;


    /**
     *
     * @param messageTransaction
     * @returns {boolean}
     */
    isValidMessageTransaction(messageTransaction){
        // logger.debug(`isValidMessageTransaction(messageTransaction)`)
        if(!this.isValidBaseTransaction(messageTransaction) ){
            return false
        }
        if(!(messageTransaction.attachment && messageTransaction.attachment.encryptedMessage && messageTransaction.attachment.encryptedMessage.data) ){
            return false
        }
        return true
    }

    /**
     *  {   "senderPublicKey":"8435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb068",
     *      "signature":"8485f33a22a7003d6f01f1af7201f49b4405cda49889cb2f9b9572e66480990e473889cf5800972ab76dfae9e481d4b9a2c9376a306a127b8953ad6cbdfc80f6",
     *      "feeNQT":"500",
     *      "type":0,
     *      "fullHash":"ce481b329d0a5633df69cc32221251d77bb90c0a10520bbcfca60234306ac9ba",
     *      "version":1,
     *      "phased":false,
     *      "ecBlockId":"16214395925620023620",
     *      "signatureHash":"6a8ee382fb484d526313d145a2b68b27553a09ea30008fc98460b644571aad17",
     *      "attachment":{"version.OrdinaryPayment":0},
     *      "senderRS":"JUP-KMRG-9PMP-87UD-3EXSF",
     *      "subtype":0,
     *      "amountNQT":"98750",
     *      "sender":"1649351268274589422",
     *      "recipientRS":"JUP-QBFP-PUDB-GBWW-4AZSH",
     *      "recipient":"2874396823741212085",
     *      "ecBlockHeight":223808,
     *      "deadline":60,
     *      "transaction":"3699155814198233294",
     *      "timestamp":121567473,
     *      "height":2147483647}
     *
     */
    isValidBaseTransaction(transaction) {
        // logger.verbose(`isValidBaseTransaction(transaction)`)
        if(!transaction){
            logger.error('not an object')
            return false
        }

        const transactionProperties = [
            "senderPublicKey",
            "signature",
            "feeNQT",
            "type",
            "fullHash",
            "version",
            "phased",
            "ecBlockId",
            "signatureHash",
            "attachment",
            'senderRS',
            "subtype",
            "amountNQT",
            "sender",
            "recipientRS",
            "recipient",
            "ecBlockHeight",
            "deadline",
            "transaction",
            "timestamp",
            "height"
        ]

        try {
            const transactionKeys = Object.keys(transaction);

            for (let i = 0; i < transactionProperties.length; i++) {
                if (transactionKeys.indexOf(transactionProperties[i]) === -1) {
                    logger.debug('INVALID BaseTransaction');
                    logger.debug(`missing property:  ${transactionProperties[i]}`)
                    // logger.debug(`transaction keys: ${transactionKeys}`);
                    // logger.debug(`the transaction to validate: ${JSON.stringify(transaction)}`);
                    return false;
                }
            }
            // logger.debug('Base Transaction Validated');
            return true;
        } catch (error) {
            logger.error('Problem with isValidBaseTransaction()');
            logger.error(error);
            return false;
        }
    }



    /**
     *
     * @param transactions
     * @returns {*}
     */
    filterMessageTransactions(transactions) {
        logger.verbose(`filterMessageTransactions()`);
        if (transactions.length == 0) {
            return []
        }
        if (!this.areValidTransactions(transactions)) {
            const errorMessage = `Not valid MessageTransactions`;
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }
        logger.debug('All transactions have been validated. Now filtering...');
        // const messageTransactions = transactions.filter(this.isTransactionAMessage, this)

        const messageTransactions = transactions.filter(this.isValidMessageTransaction, this)

        logger.debug(`Total messageTransactions: ${messageTransactions.length}`);
        return messageTransactions;
    }


    /**
     *
     * @param transactions
     * @param recipientRS
     * @returns {*}
     */
    filterMessageTransactionsByRecipient(transactions, recipientRS) {
        logger.verbose(`filterMessageTransactionsByRecipient()`);

        if (transactions.length == 0) {
            logger.warn(`Empty transactions array passed in.`);
            return [];
        }
        const messageTransactions = this.filterMessageTransactions(transactions);
        return messageTransactions.filter(messageTransaction => messageTransaction.recipientRS === recipientRS);
    }


    /**
     *
     * @param {array} transactions
     * @param {string} senderAddress
     * @returns {*}
     */
    filterMessageTransactionsBySender(transactions, senderAddress) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## filterMessageTransactionsBySender(transactions, senderAddress)`);
        logger.verbose('#####################################################################################');
        logger.verbose(`transactions.length = ${transactions.length}`);
        logger.verbose(`senderAddress = ${senderAddress}`);

        if (transactions.length == 0) {
            logger.warn(`Empty transactions array passed in`)
            return []
        }
        // console.debug(`Total Transactions: ${transactions.length}`);
        const messageTransactions = this.filterMessageTransactions(transactions);
        logger.debug(`Total filtered transactions: ${messageTransactions.length}`);
        const messageTransactionsWithSenderRs = messageTransactions.filter(messageTransaction => messageTransaction.senderRS === senderAddress);
        logger.debug(`Total filtered transactions with senderRS: ${messageTransactionsWithSenderRs.length}`);
        return messageTransactionsWithSenderRs;
    }


    /**
     *
     * @param transactions
     * @param recipientOrSender
     * @returns {*}
     */
    filterMessageTransactionsByRecipientOrSender(transactions, recipientOrSender) {
        logger.verbose(`filterMessageTransactionsByRecipientOrSender()`);

        if (transactions.length == 0) {
            logger.warn(`Empty transactions array passed in.`);
            return [];
        }

        const messageTransactions = this.filterMessageTransactions(transactions);
        return messageTransactions.filter(messageTransaction => (
            messageTransaction.recipientRS === recipientOrSender ||
            messageTransaction.senderRS === recipientOrSender));
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
     * @param {object} transactions - {?}
     * @param {string} password - Password used for encryption/decryption
     * @returns {object}
     */
    decryptTransactionMessagesAndReturnUpdatedTransactions(transactions, algorithm, password) {
        logger.verbose(`decryptTransactionMessages()`);
        const gravityCrypt = new GravityCrypto(algorithm, password);
        const updatedTransactions = transactions.map(transaction => {
            let updatedTransaction = _.clone(transaction);
            const message = transaction.attachment.encryptedMessage.data;
            const decryptedMessage = gravityCrypt.decrypt(message);
            updatedTransaction.decryptedMessage = decryptedMessage;
            // const decryptedMessage = this.decryptOrNull(message, password)
            return updatedTransaction;
            // return decryptedMessage;
        });
        logger.verbose(`TOTAL decrypted Messages ${updatedTransactions.length}`);
        const cleanedTransactions = updatedTransactions.filter(transaction => transaction != null);
        logger.verbose(`cleanedTransactions =   ${cleanedTransactions.length}`);
        return cleanedTransactions;
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


                    const messageTransactions = this.filterMessageTransactions(blockChainTransactions);
                    resolve(messageTransactions);
                })
                .catch((error) => {
                    logger.error(error);
                    reject(error);
                });
        });
    }


    /**
     *
     * @param transactions
     * @returns {*}
     */
    extractTransactionIds(transactions) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## extractTransactionIds(transactions = ${!!transactions})`);
        logger.verbose('#####################################################################################');
        if (transactions.length == 0) {
            return []
        }

        const transactionsIds = transactions.map(transaction => transaction.transaction);

        logger.debug(`Total transaction Ids: ${transactionsIds.length}`);
        // logger.error(transactionsIds);

        return transactionsIds;
    }


    /**
     * {"unconfirmedTransactions":[],"requestProcessingTime":0}
     *
     * @param address
     * @returns {Promise<*>}
     */
    async getUnconfirmedBlockChainTransactions(accountProperties) {
        logger.verbose('----------------------------------------');
        logger.verbose(`fetchUnconfirmedBlockChainTransactions(accountProperties: ${!!accountProperties})`);
        logger.verbose('----------------------------------------');
        logger.verbose(`accountProperties.address= ${accountProperties.address}`)

        return this.jupiterAPIService.jupiterRequest('get', {
            requestType: 'getUnconfirmedTransactions',
            account: accountProperties.address
        });
    }


    /**
     *
     * @param address
     * @param passphrase
     * @param password
     * @returns {Promise<unknown>}
     */
    async fetchUnconfirmedAndDecryptedTransactionMessages(accountProperties) {
        logger.verbose('#####################################################################################');
        logger.verbose(`fetchUnconfirmedTransactions(accountProperties)`)
        logger.verbose('#####################################################################################');
        logger.sensitive(`accountProperties= ${JSON.stringify(accountProperties)}`);

        return new Promise((resolve, reject) => {
            this.getUnconfirmedBlockChainTransactions(accountProperties)
                .then((response) => {
                    logger.verbose('----------------------------------------');
                    logger.verbose(`-- fetchUnconfirmedAndDecryptedTransactionMessages().then()`)
                    logger.verbose('----------------------------------------');

                    //data: { unconfirmedTransactions: [], requestProcessingTime: 0 } }
                    // console.log(response);

                    logger.verbose(`fetchUnconfirmedTransactions().getUnconfirmedBlockChainTransactions().then()`)
                    logger.verbose(`TOTAL unconfirmed blockchain transactions: ${response.data.unconfirmedTransactions.length}`);

                    logger.debug(`response.data= ${JSON.stringify(response.data)}`)
                    const unconfirmedTransactionsContainer = response.data; //data: { unconfirmedTransactions: [], requestProcessingTime: 0 } }

                    // logger.verbose(`* getUnconfirmedData2().getUnconfirmedBlockChainTransactions().then()`);
                    // logger.debug(unconfirmedTransactionsContainer);

                    if (!this.isValidUnconfirmedTransactionsContainer(unconfirmedTransactionsContainer)) {
                        throw new Error('the unconfirmed transactions container is malformed');
                    }

                    console.log(unconfirmedTransactionsContainer);

                    if (unconfirmedTransactionsContainer.unconfirmedTransactions.length <= 0) {
                        logger.debug(`No Unconfirmed Transactions Founds.`)
                        console.log('123 = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = ')
                        return resolve([])

                    }

                    const unconfirmedMessageTransactions = this.filterMessageTransactions(unconfirmedTransactionsContainer.unconfirmedTransactions);
                    logger.verbose(`TOTAL unconfirmedMessageTransactions: ${unconfirmedMessageTransactions.length}`);

                    const unconfirmedMessageTransactionsFromAddress = this.filterMessageTransactionsByRecipientOrSender(unconfirmedMessageTransactions, accountProperties.address);
                    logger.verbose(`TOTAL unconfirmedMessageTransactionsFromAddress: ${unconfirmedMessageTransactionsFromAddress.length}`);
                    this.decipherMessagesFromMessageTransactionsAndReturnTransactions(unconfirmedMessageTransactionsFromAddress, accountProperties)
                        .then((jDecryptedUnconfirmedMessageTransactions) => {
                            logger.verbose('--------------------------------------------');
                            logger.verbose(`fetchUnconfirmedAndDecryptedTransactionMessages().getUnconfirmedBlockChainTransactions().then().decipherMessagesFromMessageTransactionsAndReturnTransactions().then(jDecryptedUnconfirmedMessageTransactions)`);
                            logger.verbose('--------------------------------------------');
                            logger.verbose(`jDecryptedUnconfirmedMessageTransactions.length= ${jDecryptedUnconfirmedMessageTransactions.length}`);


                            const decryptedTransactionMessages = this.decryptTransactionMessagesAndReturnUpdatedTransactions(jDecryptedUnconfirmedMessageTransactions, accountProperties.algorithm, accountProperties.password);

                            logger.verbose(`TOTAL mDecryptedUnconfirmedMessageTransactions: ${decryptedTransactionMessages.length}`);
                            console.log('3333 = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = ')
                            resolve(decryptedTransactionMessages);
                        })
                        .catch(error => {
                            logger.error(`jupiterDecryptMessagesFromMessageTransactionsAndReturnTransaction().catch(error)`)
                            logger.error(`error=${error}`)
                            reject(error);
                        })
                })
                .catch(error => {
                    logger.error(`fetchUnconfirmedTransactions().getUnconfirmedBlockChainTransactions().catch() ${error}`);
                    reject(error);
                })
        })
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
    async decipherMessagesFromMessageTransactionsAndReturnTransactions(messageTransactions, accountProperties){
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
                        this.getReadableMessageFromMessageTransactionIdAndDecrypt(
                            transactionId,
                            accountProperties.passphrase.crypto,
                            accountProperties.passphrase
                        )
                            .then(message => {
                                logger.verbose(`-----------------------------------------------------`)
                                logger.verbose(`decipherMessagesFromMessageTransactionsAndReturnTransactions(messageTransactions).getReadableMessageFromMessageTransactionIdAndDecrypt().then()`)
                                logger.verbose(`-----------------------------------------------------`)
                                transaction.attachment.decryptedMessage = {};
                                transaction.attachment.decryptedMessage.data = message.message;
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
                    reject({status: 'error', message: error});
                })

            // const dataToDecipher = transaction.attachment.encryptedMessage.data;
            // const nonce = transaction.attachment.encryptedMessage.nonce;
            // metisMessagePromises.push(
            //     this.jupiterApi.getDecipheredData(dataToDecipher, address, passphrase, nonce)
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
            //         logger.error(error);
            //     })
        })
    }


    getStatement(address, moneyDecimals, minimumAppBalance, minimumTableBalance, isApp = false) {
        logger.verbose('getStatement()');

        return new Promise((resolve, reject) => {
            this.jupiterAPIService.getBalance(address)
                .then(response => {

                    logger.info(`Balance: ${(parseFloat(response.data.balanceNQT) / (10 ** moneyDecimals))} JUP.`);


                    let accountStatement = {};

                    if (isApp) {
                        accountStatement.hasMinimumAppBalance = response.data.balanceNQT >= minimumAppBalance;
                        accountStatement.hasMinimumTableBalance = response.data.balanceNQT >= minimumTableBalance;
                    }

                    accountStatement.balanceNQT = response.data.balanceNQT;


                    return resolve(accountStatement);
                })
                .catch(error => {
                    logger.error(error);
                    reject(error);
                })

        })

    }

    /**
     *
     * @param {array} messageTransactionIds
     * @param {GravityCrypto} crypto
     * @param {string} passphrase
     * @returns {Promise<array>}
     */
    async readMessagesFromMessageTransactionIdsAndDecrypt(messageTransactionIds, crypto, passphrase) {
        logger.verbose('##############################################################################################');
        logger.verbose('## readMessagesFromMessageTransactionIdsAndDecrypt(messageTransactionIds, crypto, passphrase)');
        logger.verbose('##');
        logger.verbose(`messageTransactionIds.length=${messageTransactionIds.length}`);

        const groupMaxSize = 50;

        return new Promise(async (resolve, reject) => {
            if (!(messageTransactionIds.length > 0)) {
                logger.warn(`Empty messageTransactionIds array`);
                return resolve([]); // return reject({status: '', message: ''});
            }

            let metisMessagePromises = [];
            let transactionGroupCount = Math.ceil((messageTransactionIds.length)/groupMaxSize);
            // console.log(`Total transactions: ${messageTransactionIds.length}`);
            // console.log(`transactionGroupCount=${transactionGroupCount}`);
            let results = [];
            for(let currentGroup = 0; currentGroup < transactionGroupCount; currentGroup++) {
                // console.log(`-- Current Group: ${currentGroup} --`);
                let transactionsCount = Math.min(messageTransactionIds.length, groupMaxSize);
                for(let j = 0; j < transactionsCount; j++){
                    metisMessagePromises.push(
                        this.getReadableMessageFromMessageTransactionIdAndDecrypt(messageTransactionIds.pop(), crypto, passphrase)
                    )
                }

                // console.log('START AWAIT ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
                results = results.concat(await this.allMessagePromises(metisMessagePromises));
                // console.log('END AWAIT -----------------------++++++++++++++++++++++++++++++++++++----------------------------------')
            }

            logger.debug(`messageTransactionIds.length=${messageTransactionIds.length}`);
            logger.debug(`metisMessagePromises.length=${metisMessagePromises.length}`);

            return  resolve(results);
        })
    }


    async readMessagesFromMessageTransactionIdsAndDecryptOrPassThrough(messageTransactionIds, crypto, passphrase) {
        logger.verbose('##############################################################################################');
        logger.verbose('## readMessagesFromMessageTransactionIdsAndDecrypt(messageTransactionIds, crypto, passphrase)');
        logger.verbose('##');
        logger.verbose(`messageTransactionIds.length=${messageTransactionIds.length}`);

        const groupMaxSize = 50;

        return new Promise(async (resolve, reject) => {
            if (!(messageTransactionIds.length > 0)) {
                logger.warn(`Empty messageTransactionIds array`);
                return resolve([]); // return reject({status: '', message: ''});
            }

            let metisMessagePromises = [];
            let transactionGroupCount = Math.ceil((messageTransactionIds.length)/groupMaxSize);
            // console.log(`Total transactions: ${messageTransactionIds.length}`);
            // console.log(`transactionGroupCount=${transactionGroupCount}`);
            let results = [];
            for(let currentGroup = 0; currentGroup < transactionGroupCount; currentGroup++) {
                // console.log(`-- Current Group: ${currentGroup} --`);
                let transactionsCount = Math.min(messageTransactionIds.length, groupMaxSize);
                for(let j = 0; j < transactionsCount; j++){
                    metisMessagePromises.push(
                        this.getReadableMessageFromMessageTransactionIdAndDecryptOrPassThrough(messageTransactionIds.pop(), crypto, passphrase)
                    )
                }

                // console.log('START AWAIT ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
                results = results.concat(await this.allMessagePromises(metisMessagePromises));
                // console.log('END AWAIT -----------------------++++++++++++++++++++++++++++++++++++----------------------------------')
            }

            logger.debug(`messageTransactionIds.length=${messageTransactionIds.length}`);
            logger.debug(`metisMessagePromises.length=${metisMessagePromises.length}`);

            return  resolve(results);
        })
    }

    allMessagePromises(promises){
        return new Promise((resolve, reject) => {
            /**
             * // [
             //   {status: "fulfilled", value: 33},
             //   {status: "fulfilled", value: 66},
             //   {status: "fulfilled", value: 99},
             //   {status: "rejected",  reason: Error: an error}
             // ]
             */
            Promise.all(promises)
                .then((results) => {
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`readMessagesFromMessageTransactionIdsAndDecrypt().Promise.all().then(results)`)
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`results.length= ${results.length}`);

                    const decryptedMessages = results.reduce(function (filtered, result) {
                        if(!result){
                            // console.log('|')
                            return filtered;
                        }
                        filtered.push(result);
                        return filtered;
                    }, []);
                    logger.verbose(`decryptedMessages.length= ${decryptedMessages.length}`);
                    return resolve(decryptedMessages);
                })
                .catch((error) => {
                    logger.error('PROMISE ERROR');
                    logger.error(error);
                    return reject({status: 'error', message: error});
                })

        })
    }

    /**
     *  Don't return rejections cause we are doing Promise.all()
     *
     * @param {string} messageTransactionId
     * @param {GravityCrypto} crypto
     * @param {string} passphrase
     * @returns {Promise<unknown>}
     */
    async getReadableMessageFromMessageTransactionIdAndDecrypt(messageTransactionId, crypto, passphrase) {
        // logger.verbose('#####################################################################################');
        // logger.verbose('## getReadableMessageFromMessageTransactionIdAndDecrypt(messageTransactionId, crypto, passphrase)');
        // logger.verbose('####');
        // logger.verbose(`messageTransactionId=${messageTransactionId}`);
        return new Promise((resolve, reject) => {
            this.getReadableMessageFromMessageTransactionId(messageTransactionId, passphrase)
                .then(decryptedMessage => {
                    // logger.sensitive(`decryptedMessage = ${decryptedMessage}`);
                    try {
                        // logger.error('what happens if i try to parse a non JSON String?');
                        // logger.debug(`decryptedMessage.message= ${decryptedMessage.message}`);
                        // logger.sensitive(`password= ${crypto.decryptionPassword}`);
                        const messageToParse = crypto.decryptOrNull(decryptedMessage);

                        if(!messageToParse){
                            // logger.debug('messageToParse is null');
                            return resolve(''); // because of Promise.all we should not do reject.
                        }

                        // const message = JSON.parse(messageToParse);
                        const message = gu.jsonParseOrPassThrough(messageToParse);
                        return resolve({message: message, transactionId: messageTransactionId});

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


    async getReadableMessageFromMessageTransactionIdAndDecryptOrPassThrough(messageTransactionId, crypto, passphrase) {
        // logger.verbose('#####################################################################################');
        // logger.verbose('## getReadableMessageFromMessageTransactionIdAndDecrypt(messageTransactionId, crypto, passphrase)');
        // logger.verbose('####');
        // logger.verbose(`messageTransactionId=${messageTransactionId}`);
        return new Promise((resolve, reject) => {
            this.getReadableMessageFromMessageTransactionId(messageTransactionId, passphrase)
                .then(decryptedMessage => {
                    // logger.sensitive(`decryptedMessage = ${decryptedMessage}`);
                    try {
                        // logger.error('what happens if i try to parse a non JSON String?');
                        // logger.debug(`decryptedMessage.message= ${decryptedMessage.message}`);
                        // logger.sensitive(`password= ${crypto.decryptionPassword}`);
                        const messageToParse = crypto.decryptOrPassThrough(decryptedMessage);

                        if(!messageToParse){
                            // logger.debug('messageToParse is null');
                            return resolve(''); // because of Promise.all we should not do reject.
                        }

                        // const message = JSON.parse(messageToParse);
                        const message = gu.jsonParseOrPassThrough(messageToParse);
                        return resolve({message: message, transactionId: messageTransactionId});

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


    /**
     *
     * @param {string} messageTransactionId
     * @param {string} passphrase
     * @returns {Promise<string>} - decyptedMessage
     */
    async getReadableMessageFromMessageTransactionId(messageTransactionId, passphrase) {
        // logger.verbose('#####################################################################################');
        // logger.verbose('## getReadableMessageFromMessageTransactionId(messageTransactionId,passphrase)');
        // logger.verbose('####');
        return new Promise((resolve, reject) => {
            if (!gu.isWellFormedJupiterTransactionId(messageTransactionId)) {
                logger.warn(`invalid messageTransactionId`);
                return reject({status: 'Error', message: `Transaction ID is not valid : ${messageTransactionId}`});
            }
            //getMessage() = {data: {encryptedMessageIsPrunable, decryptedMessage, requestProcessingTime}}
            this.jupiterAPIService.getMessage(messageTransactionId, passphrase)
                .then((response) => {
                    // logger.sensitive(response);
                    return resolve(response.data.decryptedMessage);
                })
                .catch((error) => {
                    logger.error(`********************`)
                    logger.error('** getReadableMessageFromMessageTransactionId().apiService.getMessage().catch()');
                    const errorMessage = `readMessagesFromMessageTransactionIds().readMessage().then(): ${error}`;
                    logger.error(errorMessage);

                    return reject(error);
                })
        })
    }


    /**
     *
     * @param {GravityAccountProperties} accountProperties
     * @returns {Promise<[]>}
     */
    // async fetchMessages(accountProperties) { // ie gravity.getRecords()
    //     logger.verbose('#####################################################################################');
    //     logger.verbose(`## fetchMessages(accountProperties)`);
    //     logger.verbose('##');
    //     logger.sensitive(` accountProperties= ${JSON.stringify(accountProperties)}`);
    //     logger.sensitive(` accountProperties.crypt.decryptionPassword= ${JSON.stringify(accountProperties.crypto.decryptionPassword)}`);
    //
    //     return new Promise((resolve, reject) => {
    //         this.fetchAllMessagesBySender(accountProperties)
    //             .then(messages => {
    //                 return resolve(messages);
    //             })
    //             .catch( error => {
    //                 logger.error(`********************************************`)
    //                 logger.error(`** fetchMessages().catch(error= ${!!error})`);
    //                 logger.error(`**`)
    //                 logger.sensitive(`error= ${JSON.stringify(error)}`);
    //                 return reject(error);
    //             });
    //     });
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
        return new Promise((resolve, reject) => {
            return this.fetchUnconfirmedAndDecryptedTransactionMessages(accountProperties)
                // return this.transactions.fetchUnconfirmedAndDecryptedTransactionMessages( this.jupiterAccount.address, this.jupiterAccount.passphrase, this.jupiterAccount.password)
                .then((unconfirmedTransactions) => {
                    logger.verbose('--------------------------------------------');
                    logger.verbose('fetchUnconfirmedMessages(accountProperties).fetchUnconfirmedAccountTransactions(unconfirmedTransactionsContainer).then(unconfirmedTransactionsContainer)');
                    logger.verbose('--------------------------------------------');
                    logger.debug(`unconfirmedTransactionsContainer= ${JSON.stringify(unconfirmedTransactions)}`)

                    // logger.verbose(`fetchUnconfirmedMessages().fetchUnconfirmedAccountTransactions().then()`);
                    ////data: { unconfirmedTransactions: [], requestProcessingTime: 0 } }

                    console.log('= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = ')
                    // logger.verbose(`unconfirmedTransactionsContainer.unconfirmedTransactions.length= ${unconfirmedTransactionsContainer.length}`)


                    if(unconfirmedTransactions.length < 1){
                        return resolve([])
                    }


                    //{ unconfirmedTransactions: [], requestProcessingTime: 1 }
                    // if (!this.isValidUnconfirmedTransactionsContainer(unconfirmedTransactionsContainer)) {
                    //     return reject('Not a valid Unconfirmed Transactions Container')
                    // }
                    // console.log(unconfirmedTransactionsContainer);
                    // const unconfirmedTransactions = unconfirmedTransactionsContainer.unconfirmedTransactions;
                    logger.verbose(`TOTAL unconfirmedTransactions: ${unconfirmedTransactions.length}`)
                    const unconfirmedMessages = unconfirmedTransactions.map(transaction => transaction.decryptedMessage);
                    logger.verbose(`TOTAL unconfirmedMessages: ${unconfirmedMessages.length}`)
                    // console.log(unconfirmedMessages);
                    return resolve(unconfirmedMessages);
                })
                .catch(error => {
                    logger.error(`********************`)
                    logger.error(`fetchUnconfirmedMessages().catch()`)
                    logger.error(error)
                    logger.error(`********************`)
                    reject(error);
                })
        })
    }


    async getAllMessagesFromBlockChainAndReturnMessageContainers(accountProperties, blockChainTransactions, decipherWith=null){
        logger.verbose('##############################################################################################');
        logger.verbose(`## getAllMessagesFromBlockChainAndReturnMessageContainers(accountProperties, blockChainTransactions,  decipherWith=null)`);
        logger.verbose('##');
        logger.debug(`    blockChainTransactions.length= ${JSON.stringify(blockChainTransactions.length)}`);
        let crypto = null;
        if (!decipherWith){
            crypto = accountProperties.crypto;
        } else {
            crypto = decipherWith;
        }

        const messageTransactions = this.filterMessageTransactionsBySender(blockChainTransactions, accountProperties.address);
        const filteredTransactionIds = this.extractTransactionIds(messageTransactions);

        return new Promise( (resolve, reject) => {
            this.readMessagesFromMessageTransactionIdsAndDecrypt(
                filteredTransactionIds,
                crypto,
                accountProperties.passphrase
            )
                .then((messageContainers) => {
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`getAllMessagesFromBlockChainAndReturnMessageContainers().readMessagesFromMessageTransactionIdsAndDecrypt().then(messages)`);
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`messages.length ${messageContainers.length}`);

                    return resolve(messageContainers);
                })
                .catch( error => {
                    reject(error);
                })
        })

    }

    async getAllMessagesFromBlockChainAndIncludeTransactionInformation(gravityAccountProperties, blockChainTransactions){
        logger.verbose('##############################################################################################');
        logger.verbose(`## getAllMessagesFromBlockChainAndIncludeTransactionInformation(accountProperties, blockChainTransactions,  decipherWith=null)`);
        logger.verbose('##');
        logger.debug(`    blockChainTransactions.length= ${JSON.stringify(blockChainTransactions.length)}`);

        const filteredTransactionIds = this.extractTransactionIds(blockChainTransactions);

        return new Promise( (resolve, reject) => {
            this.readMessagesFromMessageTransactionIdsAndDecryptOrPassThrough(
                filteredTransactionIds,
                gravityAccountProperties.crypto,
                gravityAccountProperties.passphrase
            )
                .then((messages) => {
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`-- getAllMessagesFromBlockChainAndIncludeTransactionInformation().readMessagesFromMessageTransactionIdsAndDecrypt().then(messages)`);
                    logger.verbose('--');
                    logger.verbose(`messages.length: ${messages.length}`);

                    return resolve(messages);
                })
                .catch( error => {
                    reject(error);
                })
        })

    }

    /**
     *
     * @param {GravityAccountProperties} accountProperties
     * @param {GravityCrypto || null} decipherWith
     * @returns {Promise<[]>}
     */
    async fetchAllMessagesBySender(accountProperties, decipherWith= null) {
        logger.verbose('###########################################################################');
        logger.verbose(`## fetchAllMessagesBySender(accountProperties)`);
        logger.verbose('##');

        let crypto = null;
        if (!decipherWith){
            crypto = accountProperties.crypto;
        } else {
            crypto = decipherWith;
        }

        return new Promise((resolve, reject) => {
            //[{signature, transactionIndex,type,phased,ecBlockId,
            //      * signatureHash,attachment: {encryptedMessage: {data, nonce, isText, isCompressed}, version.MetisMetaData,
            //      * version.EncryptedMessage},senderRS,subtype,amountNQT, recipientRS,block, blockTimestamp,deadline, timestamp,height,
            //      * senderPublicKey,feeNQT,confirmations,fullHash, version,sender, recipient, ecBlockHeight,transaction}]

            logger.verbose(`fetchAllMessagesBySender().getAllBlockChainTransactions(address=${accountProperties.address})`);
            return this.getAllBlockChainTransactions(accountProperties.address)
                .then((blockChainTransactions) => {
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`-- fetchAllMessagesBySender().getAllBlockChainTransactions(address=${accountProperties.address}).then(blockChainTransactions)`);
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.debug(`blockChainTransactions.length= ${JSON.stringify(blockChainTransactions.length)}`);
                    // logger.error(JSON.stringify(blockChainTransactions));
                    const messageTransactions = this.filterMessageTransactionsBySender(blockChainTransactions, accountProperties.address);
                    const filteredTransactionIds = this.extractTransactionIds(messageTransactions);

                    // logger.verbose(`accountProperties.crypto.password= ${accountProperties.crypto.decryptionPassword}`);
                    // logger.verbose(`accountProperties.crypto= ${JSON.stringify(accountProperties.crypto)}`);

                    logger.debug(`fetchAllMessagesBySender().getAllBlockChainTransactions().then().readMessagesFromMessageTransactionIdsAndDecrypt()`)
                    this.readMessagesFromMessageTransactionIdsAndDecrypt(
                        filteredTransactionIds,
                        crypto,
                        accountProperties.passphrase
                    )
                        .then((messages) => {
                            logger.verbose('---------------------------------------------------------------------------------------');
                            logger.verbose(`fetchAllMessagesBySender().getAllBlockChainTransactions().readMessagesFromMessageTransactionIdsAndDecrypt().then(messages)`);
                            logger.verbose('---------------------------------------------------------------------------------------');
                            logger.verbose(`messages.length ${messages.length}`);

                            return resolve(messages);
                        })
                })
        })
    }

    async getAllConfirmedAndUnconfirmedBlockChainTransactions(address) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## getAllBlockChainTransactions(account=${address})`);
        logger.verbose('#####################################################################################');
        return new Promise((resolve, reject) => {
            const message = '';
            const withMessage = true; //@TODO what does this value do?
            const includeExpiredPrunable = true;  //@TODO make sure to include prunables.
            const type = 1;
            const confirmedTransactions = this.jupiterAPIService.getBlockChainTransactions(address, message, withMessage, type, includeExpiredPrunable);
            const unconfirmedTransactions = this.jupiterAPIService.getUnconfirmedBlockChainTransactions(address);

            Promise.all([confirmedTransactions, unconfirmedTransactions])
                .then( ([confirmedTransactionsResponse, unconfirmendTransactionsResponse]) => {
                const confirmedTransactions = confirmedTransactionsResponse.data.transactions;
                const unconfirmendTransactions = unconfirmendTransactionsResponse.data.unconfirmedTransactions;
                resolve([ ...confirmedTransactions, ...unconfirmendTransactions ]);
            })

        });
    }


}

module.exports.JupiterTransactionsService = JupiterTransactionsService;
module.exports.jupiterTransactionsService = new JupiterTransactionsService(jupiterAPIService);
