const gu = require("../utils/gravityUtils");
const mError = require("../errors/metisError");
// const {BadJupiterAddressError} = require("../errors/metisError");
const {validator} = require("../services/validator");
const logger = require('../utils/logger')(module);

class TransactionUtils {

    constructor(validator) {
        this.validator = validator;
    }

    /**
     *
     * @param transactionId
     * @returns {boolean}
     */
    isWellFormedJupiterTransactionId(transactionId){
        const re = /^[0-9]{15,25}$/
        if(re.test(transactionId)){
            return true;
        }

        return false;
    }


    /**
     *
     * @param transactionIds
     * @return {boolean}
     */
    areWellFormedJupiterTransactionIds(transactionIds){
        if(!Array.isArray(transactionIds)){throw new Error('Not an array: transactionsIds')}
        if(!gu.isNonEmptyArray(transactionIds)){return true} // empty array returns true
        const someAreNotWellFormed =  transactionIds.some( transactionId => !this.isWellFormedJupiterTransactionId(transactionId));

        return !someAreNotWellFormed;
    }
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
            const isValid = Array.isArray(unconfirmedTransactions);
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
         * @param {array} transactions
         * @returns {boolean}
         */
        areValidTransactions(transactions) {
            if(!gu.isNonEmptyArray(transactions)){
                logger.warn('transactions is not an array with values');
                console.log(transactions);
                return false;
            }
            return transactions.every(t => {
                return this.isValidBaseTransaction(t)
            })
        }

    /**
     *
     * @param transactions
     * @param orderBy
     * @return {*[]|*}
     */
        sortTransactionsByTimestamp(transactions, orderBy = 'desc'){
            if(!(orderBy === 'desc' || orderBy === 'asc')) throw mError.MetisError(`orderby is invalid`);
            if(!Array.isArray(transactions)) throw mError.MetisError('transactions not an Array');
            const sortedTransactions = [...transactions];
            if(sortedTransactions.length === 0 ) return transactions;
            const valid = transactions.every(t => t.hasOwnProperty('timestamp'));
            if(!valid) throw new mError.MetisError(`Transactions are not valid`);
            sortedTransactions.sort((a,b) => {
                if(orderBy === 'desc') return new Date(b.timestamp) - new Date(a.timestamp)
                if (orderBy === 'asc') return new Date(a.timestamp) - new Date(b.timestamp);
                throw new Error(`orderBy is invalid ${orderBy}`);
            });
            return  sortedTransactions;
        }


    /**
     *
     * @param messageTransaction
     * @returns {boolean}
     */
    isValidEncryptedMessageTransaction(messageTransaction){

        // const validationResult = validator.validateBaseTransaction(messageTransaction);
        // if(!validationResult.isValid){
        //     logger.debug(validationResult.message);
        //     return false;
        // }
        if(!this.isValidBaseTransaction(messageTransaction) ){
            return false
        }
        if(!( messageTransaction.hasOwnProperty('attachment') &&
            messageTransaction.attachment.hasOwnProperty('encryptedMessage') &&
            messageTransaction.attachment.encryptedMessage.hasOwnProperty('data'))){
            return false
        }
        return true
    }



    /**
     *
     * @param transaction
     * @returns {boolean}
     */
    isValidBaseTransaction(transaction) {
        if(!transaction){
            logger.warn('transaction is empty')
            return false
        }
        const valid = validator.validateBaseTransaction(transaction);
        if(!valid.isValid){
            logger.error(`Validation: Transaction is not valid ${valid.message}`);
            logger.error(`${valid.errors}`);
        }
        return valid.isValid;
    }


    /**
     *
     * @param transactionResponse
     * @return {boolean}
     */
    isValidEncryptedMessageTransactionResponse(transactionResponse){
        if(!this.isValidBaseTransactionResponse(transactionResponse) ){
            return false
        }
        if(!( transactionResponse.hasOwnProperty('transactionJSON') &&
            transactionResponse.transactionJSON.hasOwnProperty('attachment') &&
            transactionResponse.transactionJSON.attachment.hasOwnProperty('encryptedMessage') &&
            transactionResponse.transactionJSON.attachment.encryptedMessage.hasOwnProperty('data')) ){
            return false
        }//if(!transactionResponse.hasOwnProperty('transactionJSON')){
        // return false
        //}
        // const validationResult = validator.validateEncryptedMessageTransaction(transactionResponse.transactionJSON);
        // return validationResult.isValid;
        return true
    }

    /**
     *
     * @param responseTransaction
     * @returns {boolean}
     */
    isValidBaseTransactionResponse(responseTransaction) {
        logger.verbose(`#### isValidBaseTransactionResponse(responseTransaction)`);
        if(!responseTransaction){
            logger.warn('transaction is empty')
            return false
        }
        try {
            logger.verbose(`#### isValidResponseTransaction(responseTransaction)`);
            if(!responseTransaction.transactionJSON){
                logger.warn('transactionJSON doesnt exist')
                return false
            }
            if(!responseTransaction.transaction){
                logger.warn('transaction doesnt exist')
                return false
            }
            // const validationResult = validator.validateBaseTransaction(responseTransaction.transactionJSON);
            // console.log(`\n\n\n`);
            // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            // console.log('validationResult.isValid....');
            // console.log(validationResult.isValid);
            // console.log(`=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n\n\n`)
            // return validationResult.isValid;
            if(!this.isValidBaseTransaction(responseTransaction.transactionJSON)){
                logger.warn(`transactionJSON is not valid`)
                return false;
            }

            return true;


        } catch (error) {
            logger.error(`**** isValidResponseTransaction(t).catch(error)`);
            logger.error(`error= ${error}`)
            return false;
        }
    }


    /**
     *
     * @param transaction
     * @returns {*|((storeNames: (string | Iterable<string>), mode?: IDBTransactionMode) => IDBTransaction)|((callback: (transaction: SQLTransactionSync) => void) => void)|((storeNames: (string | string[]), mode?: IDBTransactionMode) => IDBTransaction)|IDBTransaction|((callback: (transaction: SQLTransaction) => void, errorCallback?: (error: SQLError) => void, successCallback?: () => void) => void)}
     */
    extractTransactionId(transaction){
        logger.verbose(`#### extractTransactionId(transaction)`);
        if(!this.isValidBaseTransaction(transaction)){throw new Error('transaction is not valid')}
        // const validatorResult = validator.validateBaseTransaction(transaction);
        // if(!validatorResult.isValid){
        //     throw new Error(validatorResult.message);
        // }
        const transactionId =  transaction.transaction;
        if(!this.isWellFormedJupiterTransactionId(transactionId)){throw new Error('transactionId is not well formed')}

        return transactionId;
    }

    /**
     *
     * @param transaction
     * @returns {*|((storeNames: (string | Iterable<string>), mode?: IDBTransactionMode) => IDBTransaction)|((callback: (transaction: SQLTransactionSync) => void) => void)|((storeNames: (string | string[]), mode?: IDBTransactionMode) => IDBTransaction)|IDBTransaction|((callback: (transaction: SQLTransaction) => void, errorCallback?: (error: SQLError) => void, successCallback?: () => void) => void)}
     */
    extractTransactionNonce(transaction){
        logger.verbose(`#### extractTransactionId(transaction)`);
        if(!this.isValidBaseTransaction(transaction)){throw new Error('transaction is not valid')}
        return transaction.attachment.encryptedMessage.nonce;
    }

    /**
     *
     * @param transactionResponse
     * @return {*|(function((string|Iterable<string>), IDBTransactionMode=): IDBTransaction)|(function(function(SQLTransactionSync): void): void)|(function((string|string[]), IDBTransactionMode=): IDBTransaction)|IDBTransaction|(function(function(SQLTransaction): void, function(SQLError): void=, function(): void=): void)}
     */
    extractTransactionIdFromTransactionResponse(transactionResponse){
        logger.verbose(`#### extractTransactionIdFromTransactionResponse(transactionResponse)`);
        if(!transactionResponse){throw new Error(`transactionResponse is empty`)}
        // if(!transactionResponse.hasOwnProperty('data')){throw new Error(`transactionResponse is invalid. no data property`)}
        if(!transactionResponse.hasOwnProperty('transactionJSON')){throw new Error(`transactionResponse is invalid. no data.transactionJSON`)}
        return this.extractTransactionId(transactionResponse.transactionJSON)
    }

    /**
     *
     * @param transactionResponse
     * @return {*|(function((string|Iterable<string>), IDBTransactionMode=): IDBTransaction)|(function(function(SQLTransactionSync): void): void)|(function((string|string[]), IDBTransactionMode=): IDBTransaction)|IDBTransaction|(function(function(SQLTransaction): void, function(SQLError): void=, function(): void=): void)}
     */
    extractTransactionNonceFromTransactionResponse(transactionResponse){
        logger.verbose(`#### extractTransactionIdFromTransactionResponse(transactionResponse)`);
        if(!transactionResponse){throw new Error(`transactionResponse is empty`)}
        // if(!transactionResponse.hasOwnProperty('data')){throw new Error(`transactionResponse is invalid. no data property`)}
        if(!transactionResponse.hasOwnProperty('transactionJSON')){throw new Error(`transactionResponse is invalid. no data.transactionJSON`)}
        return this.extractTransactionNonce(transactionResponse.transactionJSON)
    }

    extractTransactionIdsFromTransactionResponses(transactionResponses){
        logger.verbose(`#### extractTransactionIdsFromTransactionResponses(transactionResponses)`);
        if(!Array.isArray(transactionResponses)) throw new mError.MetisError(`transactionResponses needs to be an array`);
        return transactionResponses.map(transactionResponse => {
            return this.extractTransactionIdFromTransactionResponse(transactionResponse)
        })
    }


    extractTransactionInfoFromTransactionResponses(transactionResponses, info = []){
        logger.verbose(`#### extractTransactionIdsFromTransactionResponses(transactionResponses)`);
        if(!Array.isArray(transactionResponses)) throw new mError.MetisError(`transactionResponses needs to be an array`);
        return transactionResponses.map(transactionResponse => {
            const tInfo = {};
            if(info.includes('transactionId')){
                tInfo.transactionId = this.extractTransactionIdFromTransactionResponse(transactionResponse);
            }
            if(info.includes('nonce')){
                tInfo.nonce = this.extractTransactionNonceFromTransactionResponse(transactionResponse);
            }
            return tInfo;
        })
    }

    // extractTransactionNoncesFromTransactionResponses(transactionResponses){
    //     logger.verbose(`#### extractTransactionIdsFromTransactionResponses(transactionResponses)`);
    //     if(!Array.isArray(transactionResponses)) throw new mError.MetisError(`transactionResponses needs to be an array`);
    //     return transactionResponses.map(transactionResponse => {
    //         return this.extractTransactionNonceFromTransactionResponse(transactionResponse);
    //     })
    // }

    /**
     *
     * @param transactions
     * @returns {*}
     */
    extractTransactionIds(transactions) {
        logger.verbose(`#### extractTransactionIds(transactions)`);
        logger.sensitive(`transactions.length= ${transactions.length}`);
        if (transactions.length === 0) {
            logger.warn('empty array passed in!')
            return []
        }
        if(!this.areValidTransactions(transactions)){throw new Error('transactions are invalid')}
        const transactionsIds = transactions.map(transaction => transaction.transaction);
        logger.debug(`transactionsIds.length= ${transactionsIds.length}`);
        return transactionsIds;
    }

    /**
     *
     * @param transactions
     * @param blackList
     * @param whiteList
     * @return {*[]|*}
     */
    filterTransactionsByTransactionIds(transactions, blackList = [], whiteList = []){
        logger.verbose(`#### filterTransactionsByTransactionIds(transactions, blackList , whiteLis)`);
        if(!this.areValidTransactions(transactions)) throw new mError.MetisError(`transactions are invalid`);
        if(!(Array.isArray(blackList) )) throw new mError.MetisError(`blacklist is not an array`)
        if(!(Array.isArray(whiteList) )) throw new mError.MetisError(`whiteList is not an array`)
        let filteredTransactions = [...transactions];
        if(blackList.length > 0){
            logger.info(`- Blacklist count ${blackList.length}`);
            filteredTransactions = transactions.filter(transaction => {
                const transactionId = transaction.transaction;
                return ! blackList.some(item => item === transactionId); // if in black list then return false;
            })
        }
        if(whiteList.length > 0) {
            filteredTransactions = filteredTransactions.filter(transaction => {
                const transactionId = transaction.transaction;
                return whiteList.some(item => item === transactionId); // if in white list then return true;
            })
        }

        return filteredTransactions;
    }

    /**
     *
     * @param transactions
     * @returns {*}
     */
    // extractTransactionIdsFromTransactions(transactions){
    //     if(!this.areValidTransactions(transactions)){throw new Error('not all are valid transactions')}
    //     return transactions.map(transaction => transaction.transaction);
    // }

    filterMessageTransactionsByCallback(transactions, callback){
        logger.verbose(`#### filterMessageTransactionsByCallback(transactions, callback): transactions.length = ${transactions.length} `);
        if (transactions.length === 0) {
            logger.warn(`Empty transactions array passed in`)
            return []
        }
        const messageTransactions = this.filterEncryptedMessageTransactions(transactions);
        const filteredTransactions = messageTransactions.filter(messageTransaction => {
            return callback(messageTransaction)
        });
        logger.debug(`## Total filtered transactions: ${filteredTransactions.length}`);

        return filteredTransactions;
    }

    filterMessageTransactionsBySenderOrRecipient(transactions, recipientOrSenderAddress){
        if(!gu.isNonEmptyString(recipientOrSenderAddress)){throw new Error('recipientOrSenderAddress is empty')}
        return  this.filterMessageTransactionsByCallback(transactions, (transaction)=>
            transaction.recipientRS === recipientOrSenderAddress ||
                transaction.senderRS === recipientOrSenderAddress
        )
    }

    /**
     *
     * @param transactions
     * @param recipientRS
     * @returns {*}
     */
    filterMessageTransactionsByRecipient(transactions, recipientAddress) {
        if(!gu.isNonEmptyString(recipientAddress)){throw new Error('recipientRS is empty')}
        return  this.filterMessageTransactionsByCallback(transactions, (transaction) =>
            transaction.recipientRS === recipientAddress
        )
    }

    /**
     * @todo retire this function.
     * @param {array} transactions
     * @param {string} senderAddress
     * @returns {*}
     */
    filterEncryptedMessageTransactionsBySender(transactions, senderAddress) {
        if(!gu.isWellFormedJupiterAddress(senderAddress)) throw new mError.MetisErrorBadJupiterAddress(`senderAddress: ${senderAddress}`)
        // if(!gu.isWellFormedJupiterAddress(senderAddress)){throw new BadJupiterAddressError(senderAddress)}
        // if(!gu.isWellFormedJupiterAddress(senderAddress)){throw new Error('senderAddress is wrong')}
        if(!Array.isArray(transactions)){throw new Error('Not array')};
        return  this.filterMessageTransactionsByCallback(transactions, (transaction) =>
            {
                // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
                // console.log('transaction.senderRS');
                // console.log(transaction.senderRS);
                // console.log('senderAddress');
                // console.log(senderAddress);
                // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
               return  transaction.senderRS === senderAddress
            }
        )
    }

    /**
     *
     * @param transactions
     * @returns {*}
     */
    filterEncryptedMessageTransactions(transactions) {
        logger.verbose(`#### filterEncryptedMessageTransactions(transactions)`);
        if(!Array.isArray(transactions)){throw new Error('transactions needs to be an array')};
        logger.debug(`transactions.length= ${transactions.length}`)
        if (transactions.length === 0) {return []}
        const messageTransactions = transactions.filter(this.isValidEncryptedMessageTransaction, this)
        // const messageTransactions = transactions.filter( transaction => {
        //         const validationResult = validator.validateEncryptedMessageTransaction(transaction);
        //         return validationResult.isValid
        //     }
        // )
        logger.debug(`messageTransactions.length= ${messageTransactions.length}`);
        return messageTransactions;
    }

    /**
     *
     * @param transactions
     * @returns {*[]|*}
     */
    extractLatestTransaction(transactions){
        if(!Array.isArray(transactions)){throw new Error('not array')}
        if(transactions.length === 0) {
            return null;
        }
        const allTransactionsAreGood = transactions.every(t => {
            const valid = this.validator.validateBaseTransaction(t);
            if(!valid.isValid){
                console.log(valid.errors);
            }
            return valid.isValid;
        })

        if(!allTransactionsAreGood){
            throw new mError.MetisError(`Transactions are invalid!`);
        }

        //@TODO use transaction timestamp!!!
        const latestTransaction = transactions.shift();


        return latestTransaction;
    }

}

module.exports.transactionUtils = new TransactionUtils(validator);
