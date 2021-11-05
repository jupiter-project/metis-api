const {feeManagerSingleton, FeeManager} = require("./FeeManager");
const {resolve} = require("path");
const {reject} = require("lodash");
const {gravityCLIReporter} = require("../gravity/gravityCLIReporter");
const {jupiterAPIService} = require("./jupiterAPIService");
const {applicationAccountProperties} = require("../gravity/applicationAccountProperties");
const {metisGravityAccountProperties} = require("../gravity/gravityAccountProperties");
const logger = require('../utils/logger')(module);

class JupiterFundingService {
    constructor(jupiterAPIService, applicationProperties) {
        if(!jupiterAPIService){throw new Error('missing jupiterAPIService')}
        if(!applicationProperties){throw new Error('missing applicationProperties')}

        this.feeNQT = parseInt(applicationProperties.feeNQT);
        this.tableCreation = parseInt(applicationProperties.accountCreationFeeNQT)
        this.defaultNewUserTransferAmount = parseInt(applicationProperties.minimumAppBalance)
        this.defaultNewTableTransferAmount = parseInt(applicationProperties.minimumTableBalance)
        this.jupiterAPIService = jupiterAPIService;
        this.applicationProperties = applicationProperties;
        this.intervalTimeInSeconds = 8;
        this.maxWaitTimeLimitInSeconds = 180;//seconds
    }

    /**
     *
     * @param transactionsReport
     * @returns {Promise<unknown[]>}
     */
    async waitForAllTransactionConfirmations(transactionsReport){
        const allTransactions = [];
        transactionsReport.forEach( transactionReport => {
            allTransactions.push(this.waitForTransactionConfirmation(transactionReport.id));
        } )

        return Promise.all(allTransactions)
    }

    /**
     *
     * @param transactionId
     * @returns {Promise<unknown>}
     */
    async waitForTransactionConfirmation(transactionId){
        logger.verbose('#####################################################################################');
        logger.verbose(`## waitForTransactionConfirmation( transactionId=${transactionId})`);
        logger.verbose('##');

        if(!transactionId){
            throw new Error('transactionId cannot be empty');
        }

        return new Promise(async (resolve, reject) => {
            let workTime = 0;
            const milliseconds = this.intervalTimeInSeconds * 1000;

            let timerId = setInterval(async () => {
                console.log(`workTime= ${workTime}`);
                const getTransactionResponse = await this.jupiterAPIService.getTransaction(transactionId)
                const confirmations = (getTransactionResponse.data.confirmations) ? getTransactionResponse.data.confirmations : 0;
                // console.log('confirmations count: ', confirmations)
                if(confirmations > 0){
                    clearInterval(timerId);
                    return resolve('confirmed')
                }

                if(workTime > this.maxWaitTimeLimitInSeconds * 1000){
                    clearInterval(timerId);
                    return reject('not confirmed')
                }
                workTime += milliseconds;
            }, milliseconds);
        })
    }


    /**
     *
     * @param recipientProperties
     * @param fee
     * @returns {Promise<unknown>}
     */
    async provideInitialStandardUserFunds(recipientProperties){
        logger.verbose('#####################################################################################');
        logger.verbose(`## provideInitialStandardApplicationFunds( recipientProperties= ${!!recipientProperties})`);
        logger.verbose('##');
        const initialAmount = this.defaultNewUserTransferAmount;
        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
        return this.transfer(this.applicationProperties, recipientProperties, initialAmount, fee);
    }

    /**
     *
     * @param recipientProperties
     * @returns {Promise<*>}
     */
    async provideInitialStandardTableFunds(recipientProperties){
        logger.verbose('#####################################################################################');
        logger.verbose(`## provideInitialStandardApplicationFunds( recipientProperties= ${!!recipientProperties})`);
        logger.verbose('##');
        const initialAmount = this.defaultNewTableTransferAmount;
        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
        return this.transfer(this.applicationProperties, recipientProperties, initialAmount, fee);
    }

    /**
     *
     * @param {GravityAccountProperties } senderProperties
     * @param {GravityAccountProperties} recipientProperties
     * @param {number} transferAmount
     * @param {number} fee
     * @returns {Promise<unknown>}
     */
     transfer(senderProperties, recipientProperties, transferAmount, fee ) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## transfer(senderProperties= ${!!senderProperties}, recipientProperties= ${!!recipientProperties}, transferAmount= ${transferAmount})`)
        logger.verbose('##');
        logger.sensitive(`sender: ${senderProperties.address}`);
        logger.sensitive(`recipient: ${recipientProperties.address}`);
        logger.sensitive(`amount: ${transferAmount}`);
        if (!transferAmount) {throw new Error('transfer amount missing');}
        if (!recipientProperties) {throw new Error('recipient missing');}
        if (!senderProperties) {throw new Error('sender missing');}

        return this.jupiterAPIService.transferMoney( senderProperties, recipientProperties, transferAmount, fee )
    }

}

module.exports.JupiterFundingService = JupiterFundingService;
module.exports.jupiterFundingService = new JupiterFundingService(jupiterAPIService, metisGravityAccountProperties);
