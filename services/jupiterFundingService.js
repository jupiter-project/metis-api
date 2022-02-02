const gu = require('../utils/gravityUtils');
const {feeManagerSingleton, FeeManager} = require("./FeeManager");
const {jupiterAPIService} = require("./jupiterAPIService");
const {metisGravityAccountProperties, GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {JupiterAPIService} = require("./jupiterAPIService");
const {MetisError} = require("../errors/metisError");
const mError = require("../errors/metisError");
const {jupiterMoneyTransactionService, JupiterMoneyTransactionService} = require("./jupiterMoneyTransactionService");
const logger = require('../utils/logger')(module);

class JupiterFundingService {

    /**
     *
     * @param {JupiterAPIService} jupiterAPIService
     * @param {GravityAccountProperties} applicationProperties
     * @param {JupiterMoneyTransactionService} jupiterMoneyTransactionService
     */
    constructor(jupiterAPIService, applicationProperties,jupiterMoneyTransactionService) {
        if(!(applicationProperties instanceof  GravityAccountProperties)){throw new Error('problem with applicationProperties')}
        if(!(jupiterAPIService instanceof  JupiterAPIService)){throw new Error('problem with applicationProperties')}
        if(!(jupiterMoneyTransactionService instanceof JupiterMoneyTransactionService)) throw new mError.MetisError(`JupiterMoneyTransactionService`);
        this.feeNQT = parseInt(applicationProperties.feeNQT);
        if(!this.feeNQT){throw new Error('problem with feeNqt')}
        // this.tableCreation = parseInt(applicationProperties.accountCreationFeeNQT)
        this.defaultNewUserTransferAmount = parseInt(applicationProperties.minimumAppBalance)
        if(!this.defaultNewUserTransferAmount){throw new Error(' problem with defaultNewUserTransferAmount')}
        this.defaultNewChannelTransferAmount = parseInt(applicationProperties.minimumTableBalance)
        if(!this.defaultNewChannelTransferAmount){throw new Error('problem with defaultNewChannelTransferAmount')}
        this.jupiterAPIService = jupiterAPIService;
        this.jupiterMoneyTransactionService = jupiterMoneyTransactionService;
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
        if(!Array.isArray(transactionsReport)){ throw new Error('not an array') };
        if(transactionsReport.length === 0 ){ return }
        transactionsReport.forEach(tReport => {
            if(!tReport.hasOwnProperty('id')){ throw new Error(`malformed transactionReport: ${tReport}`)}
            if(!gu.isWellFormedJupiterTransactionId(tReport.id)){throw new Error(`transaction id is malformed: ${tReport.id}`)}
        })

        const allTransactions = [];
        transactionsReport.forEach( transactionReport => {
            allTransactions.push(this.waitForTransactionConfirmation(transactionReport.id));
        } )

        return Promise.all(allTransactions)
    }

    /**
     *
     * @param {string} transactionId
     * @returns {Promise<unknown>}
     */
    async waitForTransactionConfirmation(transactionId){
        if(!gu.isWellFormedJupiterTransactionId(transactionId)){throw new Error(`transactionId is not valid: ${transactionId}`)}
        return new Promise(async (resolve, reject) => {
            let workTime = 0;
            const milliseconds = this.intervalTimeInSeconds * 1000;
            console.log(`waiting for transaction confirmation`);
            let timerId = setInterval(async () => {
                console.log(`tid:${transactionId} -- waiting ${workTime/1000} secs...`);
                try {
                    const getTransactionResponse = await this.jupiterAPIService.getTransaction(transactionId)
                    const confirmations = (getTransactionResponse.data.confirmations) ? getTransactionResponse.data.confirmations : 0;
                    if (confirmations > 0) {
                        clearInterval(timerId);
                        console.log('confirmed!')
                        return resolve('confirmed')
                    }

                    if (workTime > this.maxWaitTimeLimitInSeconds * 1000) {
                        clearInterval(timerId);
                        console.log('not confirmed')
                        return reject('not confirmed')
                    }
                    workTime += milliseconds;
                } catch (error){
                    if(error instanceof mError.MetisErrorJupiterNoResponse){
                        workTime += milliseconds;
                        return; // Continue the countdown.
                    }
                    if(error instanceof mError.MetisErrorJupiterUnknownTransaction){
                        workTime += milliseconds;
                        return; // Continue the countdown.
                    }
                    throw error;
                }
            }, milliseconds);
        })
    }


    /**
     *
     * @param recipientProperties
     * @return {Promise<*>}
     */
    async provideInitialStandardUserFunds(recipientProperties){
        logger.verbose(`#### provideInitialStandardUserFunds( recipientProperties)`);
        if(!(recipientProperties instanceof GravityAccountProperties)){throw new MetisError('recipientProperties is invalid')}
        const initialAmount = this.defaultNewUserTransferAmount;
        const transferMoneyResponse = await  this.jupiterMoneyTransactionService.transferMoney(this.applicationProperties,recipientProperties,initialAmount);
        logger.debug(`transferMoneyResponse: ${transferMoneyResponse}`);
        return transferMoneyResponse;
    }

    /**
     *
     * @param {GravityAccountProperties} recipientProperties
     * @returns {Promise<*>}
     */
    async provideInitialChannelAccountFunds(recipientProperties){
        logger.verbose(`#### provideInitialChannelAccountFunds( recipientProperties= ${!!recipientProperties})`);
        if(!(recipientProperties instanceof GravityAccountProperties)){throw new Error('invalid recipientProperties')};
        const initialAmount = this.defaultNewChannelTransferAmount;
        return this.jupiterMoneyTransactionService.transferMoney(this.applicationProperties,recipientProperties,initialAmount);
        // const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
        // return this.transfer(this.applicationProperties, recipientProperties, initialAmount);
    }


    /**
     *
     * @param address
     * @return {Promise<*>}
     */
    // async getBalance(address){
    //     const senderBalanceResponse = await this.jupiterAPIService.getBalance(address);
    //     return +senderBalanceResponse.data.unconfirmedBalanceNQT;
    // }


    /**
     *
     * @param {GravityAccountProperties } senderProperties
     * @param {GravityAccountProperties} recipientProperties
     * @param {number} transferAmount
     * @param {number} fee
     * @returns {Promise<unknown>}
     */
    //  async transfer(senderProperties, recipientProperties, transferAmount ) {
    //      logger.verbose(`#### transfer(senderProperties, recipientProperties, transferAmount=${transferAmount})`);
    //     if (!transferAmount) {throw new Error('transfer amount missing')}
    //     if(isNaN(transferAmount)){ throw new MetisError(`transferAmount is not a number`)};
    //     const _transferAmount = +transferAmount
    //     if(!(recipientProperties instanceof GravityAccountProperties)){throw new Error('recipientProperties is invalid')}
    //     if(!(senderProperties instanceof GravityAccountProperties)){throw new Error('senderProperties is invalid')}
    //     const senderBalance = await this.getBalance(senderProperties.address);
    //     const totalNeeded = _fee + _transferAmount;
    //     if(senderBalance < totalNeeded){
    //         throw new MetisError(`Not enough funds. Need at least ${totalNeeded}. Current balance: ${senderBalance}`);
    //     }
    //     const response = await this.jupiterMoneyTransactionService.transferMoney(senderProperties,recipientProperties,_transferAmount);
    //     return response;
    //     //@Todo this should not return the Response. Try changing to return Response.data?
    //     // return this.jupiterAPIService.transferMoney( senderProperties, recipientProperties, _transferAmount, _fee )
    // }

}

module.exports.JupiterFundingService = JupiterFundingService;
module.exports.jupiterFundingService = new JupiterFundingService(
    jupiterAPIService,
    metisGravityAccountProperties,
    jupiterMoneyTransactionService
    );
