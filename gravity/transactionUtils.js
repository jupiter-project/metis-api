const gu = require("../utils/gravityUtils");
const {BadJupiterAddressError} = require("../errors/metisError");
const logger = require('../utils/logger')(module);

class TransactionUtils {

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

         * @param transactions
         * @returns {boolean}
         */
        areValidTransactions(transactions) {
            logger.verbose('############################################3');
            logger.verbose('## areValidTransactions(transactions)');
            logger.verbose('##');
            logger.error('use ajv!!!')

            if(!gu.isNonEmptyArray(transactions)){
                logger.warn('not valid array');
                return false;
            }

            for (let i = 0; i < transactions.length; i++) {
                if (!this.isValidBaseTransaction(transactions[i])) {
                    logger.error(` -- invalid transaction`);
                    logger.sensitive(`this.isValidBaseTransaction(transactions[i]) = ${JSON.stringify(transactions[i])}`)
                    return false;
                }
            }

            return true;
        }


    /**
     *
     * @param messageTransaction
     * @returns {boolean}
     */
    isValidEncryptedMessageTransaction(messageTransaction){
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

    isValidEncryptedMessageTransactionResponse(transactionResponse){
        if(!this.isValidBaseTransactionResponse(transactionResponse) ){
            return false
        }
        if(!( transactionResponse.hasOwnProperty('transactionJSON') &&
            transactionResponse.transactionJSON.hasOwnProperty('attachment') &&
            transactionResponse.transactionJSON.attachment.hasOwnProperty('encryptedMessage') &&
            transactionResponse.transactionJSON.attachment.encryptedMessage.hasOwnProperty('data')) ){
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
        // logger.sensitive(`#### isValidBaseTransaction(transaction)`);

        if(!transaction){
            logger.warn('transaction is empty')
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
            // "recipientRS", // type1 subtype 1 doesnt have a recipient: ie alias assignment
            // "recipient", // type1 subtype 1 doesnt have recipient
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
                    logger.warn('INVALID BaseTransaction');
                    logger.warn(`missing property:  ${transactionProperties[i]}`)
                    console.log(transaction)
                    return false;
                }
            }


            return true;
        } catch (error) {
            logger.error(`****************************************************************`);
            logger.error(`** isValidBaseTransaction(t).catch(error)`);
            logger.error(`** `);
            logger.error(`   error= ${error}`)
            throw error;

            return false;
        }
    }


    /**
     *
     * @param responseTransaction
     * @returns {boolean}
     */
    isValidBaseTransactionResponse(responseTransaction) {
        logger.sensitive(`#### isValidResponseTransaction(t)`);
        try {
            logger.sensitive(`#### isValidResponseTransaction(responseTransaction)`);

            if(!responseTransaction){
                logger.warn('transaction is empty')
                return false
            }

            if(!responseTransaction.transactionJSON){
                logger.warn('transactionJSON doesnt exist')
                return false
            }

            if(!responseTransaction.transaction){
                logger.warn('transaction doesnt exist')
                return false
            }

            if(!this.isValidBaseTransaction(responseTransaction.transactionJSON)){
                logger.warn(`transactionJSON is not valid`)
                return false;
            }

                return true;
        } catch (error) {
            logger.error(`****************************************************************`);
            logger.error(`** isValidResponseTransaction(t).catch(error)`);
            logger.error(`** `);
            logger.error(`   error= ${error}`)

            return false;
        }
    }


    /**
     *
     * @param transaction
     * @returns {*|((storeNames: (string | Iterable<string>), mode?: IDBTransactionMode) => IDBTransaction)|((callback: (transaction: SQLTransactionSync) => void) => void)|((storeNames: (string | string[]), mode?: IDBTransactionMode) => IDBTransaction)|IDBTransaction|((callback: (transaction: SQLTransaction) => void, errorCallback?: (error: SQLError) => void, successCallback?: () => void) => void)}
     */
    extractTransactionId(transaction){
        if(!this.isValidBaseTransaction(transaction)){throw new Error('transaction is not valid')}
        const transactionId =  transaction.transaction;
        if(!this.isWellFormedJupiterTransactionId(transactionId)){throw new Error('transactionId is not well formed')}

        return transactionId;
    }



    /**
     *
     * @param transactions
     * @returns {*}
     */
    extractTransactionIds(transactions) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## extractTransactionIds(transactions)`);
        logger.verbose('##');
        logger.sensitive(`transactions.length=${transactions.length}`);

        // if (transactions.length === 0) {
        //     logger.warn('empty array passed in!')
        //     return []
        // }
        //
        // if(!this.areValidTransactions(transactions)){throw new Error('transactions are invalid')}

        const transactionsIds = transactions.map(transaction => transaction.transaction);
        logger.debug(`transactionsIds.length= ${transactionsIds.length}`);

        return transactionsIds;
    }

    /**
     *
     * @param transactions
     * @returns {*}
     */
    extractTransactionIdsFromTransactions(transactions){
        if(!this.areValidTransactions(transactions)){throw new Error('not all are valid transactions')}
        return transactions.map(transaction => transaction.transaction);
    }

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
     *
     * @param {array} transactions
     * @param {string} senderAddress
     * @returns {*}
     */
    filterEncryptedMessageTransactionsBySender(transactions, senderAddress) {
        if(!gu.isWellFormedJupiterAddress(senderAddress)){throw new BadJupiterAddressError(senderAddress)}
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
        logger.verbose(`filterEncryptedMessageTransactions(transactions)`);
        if (transactions.length === 0) {
            return []
        }
        const messageTransactions = transactions.filter(this.isValidEncryptedMessageTransaction, this)
        logger.debug(`Total messageTransactions: ${messageTransactions.length}`);

        return messageTransactions;
    }

    /**
     *
     * @param transactions
     * @returns {*[]|*}
     */
    getMostRecentTransactionOrNull(transactions){
        //@TODO still need to implement this!
        if(!Array.isArray(transactions)){throw new Error('not array')}
        if(transactions.length === 0) {return null}

        return transactions.shift();
    }

}

module.exports.transactionUtils = new TransactionUtils();
