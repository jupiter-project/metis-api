const gu = require('../utils/gravityUtils');
const logger = require('../utils/logger')(module);
const {jupiterAPIService, JupiterAPIService} = require("./jupiterAPIService");
const {transactionUtils} = require("../gravity/transactionUtils");
const mError = require("../errors/metisError");
const {validator} = require("./validator");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {jupiterTransactionsService} = require("./jupiterTransactionsService");
const {metisApplicationAccountProperties} = require("../gravity/applicationAccountProperties");

class JupiterMoneyTransactionService {

    /**
     *
     * @param jupiterAPIService
     * @param jupiterTransactionsService
     * @param transactionUtils
     * @param validator
     * @param {ApplicationAccountProperties} metisApplicationAccountProperties
     */
    constructor(jupiterAPIService, jupiterTransactionsService, transactionUtils, validator,metisApplicationAccountProperties) {
        if(!(jupiterAPIService instanceof JupiterAPIService)){throw new Error('jupiterApiServer not valid')}
        this.jupiterAPIService = jupiterAPIService;
        this.jupiterTransactionService = jupiterTransactionsService;
        this.transactionUtils = transactionUtils;
        this.validator = validator;
        this.metisApplicationAccountProperties = metisApplicationAccountProperties;
    }

    /**
     *
     * @param address
     * @return {Promise<number>}
     */
    async getBalance(address){
        const senderBalanceResponse = await this.jupiterAPIService.getBalance(address);
        return +senderBalanceResponse.data.unconfirmedBalanceNQT;
    }

    /**
     *
     * @param accountProperties
     * @param amountNqt
     * @param messageToEncrypt
     * @param message
     * @return {Promise<number>}
     */
    async fetchSendMoneyTransactionFeeNqt(accountProperties, amountNqt, messageToEncrypt='', message=''){
        const ZERO = 0;
        const NOBROADCAST = false;
        const response = await this.jupiterAPIService.sendMoney(
            accountProperties,
            accountProperties,
            amountNqt,
            ZERO,
            NOBROADCAST
        );

        if(!response.hasOwnProperty('data')) throw new mError.MetisError(`response doesnt have data`);
        if(!response.data.hasOwnProperty('transactionJSON')) throw new mError.MetisError(`response doesnt have data.transactioJSON`);
        if(!response.data.transactionJSON.hasOwnProperty('feeNQT')) throw new mError.MetisError(`response doesnt have data.transactioJSON.feeNQT`);
        const feeNqt =  response.data.transactionJSON.feeNQT;
        if(isNaN(feeNqt))throw new mError.MetisError(`feeNQT is not a number ${feeNqt}`);
        return +feeNqt;
    }

    /**
     *
     * @param fromAccountProperties
     * @param toAccountProperties
     * @param amountNqt
     * @return {Promise<*|((storeNames: (string | Iterable<string>), mode?: IDBTransactionMode) => IDBTransaction)|((callback: (transaction: SQLTransactionSync) => void) => void)|((storeNames: (string | string[]), mode?: IDBTransactionMode) => IDBTransaction)|IDBTransaction|((callback: (transaction: SQLTransaction) => void, errorCallback?: (error: SQLError) => void, successCallback?: () => void) => void)>}
     */
    async transferMoney(fromAccountProperties, toAccountProperties, amountNqt) {
        logger.verbose(`#### transferMoney(fromJupiterAccount, toAccountProperties, amount)`);
        if (!gu.isNumberGreaterThanZero(amountNqt)) throw new mError.MetisError('amount is invalid')
        if(!(fromAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`fromAccountProperties`);
        if(!(toAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`toAccountProperties`);
        try {
            const feeNqt = await this.fetchSendMoneyTransactionFeeNqt(fromAccountProperties, amountNqt);
            const totalNqtRequired = feeNqt + amountNqt;
            const senderBalanceNqt = await this.getBalance(fromAccountProperties.address);
            if (senderBalanceNqt < totalNqtRequired) {
                throw new mError.MetisErrorNotEnoughFunds(``, senderBalanceNqt, totalNqtRequired);
            }
            const feeJup = gu.convertNqtToJup(feeNqt, this.metisApplicationAccountProperties.moneyDecimals);
            const feeUsd = await gu.convertNqtToUsd(feeNqt, this.metisApplicationAccountProperties.moneyDecimals);
            const amountJup = gu.convertNqtToJup(amountNqt, this.metisApplicationAccountProperties.moneyDecimals);
            const amountUsd = await gu.convertNqtToUsd(amountNqt, this.metisApplicationAccountProperties.moneyDecimals);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
            logger.info(`++ Transferring Money`);
            logger.info(`++ from: ${fromAccountProperties.address}`);
            logger.info(`++ to: ${toAccountProperties.address}`);
            logger.info(`++ amount: ${gu.formatNqt(amountNqt)} | JUP ${amountJup} | USD $${amountUsd}`);
            logger.info(`++ fee: ${gu.formatNqt(feeNqt)} | JUP ${feeJup} | USD $${feeUsd} `);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
            const sendMoneyResponse = await this.jupiterAPIService.sendMoney(fromAccountProperties, toAccountProperties, amountNqt, feeNqt);
            const transactionId = sendMoneyResponse.data.transaction;
            return {transactionId: transactionId};
        } catch(error){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** transferMoney().catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }
}

module.exports.JupiterMoneyTransactionService = JupiterMoneyTransactionService;
module.exports.jupiterMoneyTransactionService = new JupiterMoneyTransactionService(
    jupiterAPIService,
    jupiterTransactionsService,
    transactionUtils,
    validator,
    metisApplicationAccountProperties
);
