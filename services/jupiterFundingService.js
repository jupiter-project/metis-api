const gu = require('../utils/gravityUtils');
const {feeManagerSingleton, FeeManager} = require("./FeeManager");
const {jupiterAPIService} = require("./jupiterAPIService");
const {metisGravityAccountProperties, GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {JupiterAPIService} = require("./jupiterAPIService");
const logger = require('../utils/logger')(module);

class JupiterFundingService {

    /**
     *
     * @param {JupiterAPIService} jupiterAPIService
     * @param {GravityAccountProperties} applicationProperties
     */
    constructor(jupiterAPIService, applicationProperties) {
        if(!(applicationProperties instanceof  GravityAccountProperties)){throw new Error('problem with applicationProperties')}
        if(!(jupiterAPIService instanceof  JupiterAPIService)){throw new Error('problem with applicationProperties')}

        this.feeNQT = parseInt(applicationProperties.feeNQT);
        if(!this.feeNQT){throw new Error('problem with feeNqt')}
        // this.tableCreation = parseInt(applicationProperties.accountCreationFeeNQT)
        this.defaultNewUserTransferAmount = parseInt(applicationProperties.minimumAppBalance)
        if(!this.defaultNewUserTransferAmount){throw new Error(' problem with defaultNewUserTransferAmount')}
        this.defaultNewTableTransferAmount = parseInt(applicationProperties.minimumTableBalance)
        if(!this.defaultNewTableTransferAmount){throw new Error('problem with defaultNewTableTransferAmount')}
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
     * @param transactionId
     * @returns {Promise<unknown>}
     */
    async waitForTransactionConfirmation(transactionId){
        if(!gu.isWellFormedJupiterTransactionId(transactionId)){throw new Error('transactionId is not valid')}

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
        logger.verbose(`#### provideInitialStandardUserFunds( recipientProperties= ${!!recipientProperties})`);
        if(!(recipientProperties instanceof GravityAccountProperties)){throw new Error('recipientProperties is invalid')}
        const initialAmount = this.defaultNewUserTransferAmount;
        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
        return this.transfer(this.applicationProperties, recipientProperties, initialAmount, fee);
    }

    /**
     *
     * @param {GravityAccountProperties} recipientProperties
     * @returns {Promise<*>}
     */
    async provideInitialStandardTableFunds(recipientProperties){
        logger.verbose(`#### provideInitialStandardTableFunds( recipientProperties= ${!!recipientProperties})`);
        if(!(recipientProperties instanceof GravityAccountProperties)){throw new Error('invalid recipientProperties')};
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
         logger.sensitive(`#### transfer(senderProperties, recipientProperties, transferAmount=${transferAmount}, fee=${fee} )`);
        if (!transferAmount) {throw new Error('transfer amount missing');}
        if( !recipientProperties instanceof GravityAccountProperties){throw new Error('recipientProperties is invalid')}
        if( !senderProperties instanceof GravityAccountProperties){throw new Error('senderProperties is invalid')}

        //@Todo this should not return the Response. Try changing to return Response.data?
        return this.jupiterAPIService.transferMoney( senderProperties, recipientProperties, transferAmount, fee )
    }

}

module.exports.JupiterFundingService = JupiterFundingService;
module.exports.jupiterFundingService = new JupiterFundingService(jupiterAPIService, metisGravityAccountProperties);
