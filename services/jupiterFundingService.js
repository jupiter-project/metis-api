const {feeManagerSingleton, FeeManager} = require("./FeeManager");
const {resolve} = require("path");
const {reject} = require("lodash");
const {gravityCLIReporter} = require("../gravity/gravityCLIReporter");
const logger = require('../utils/logger')(module);

class JupiterFundingService {


    // const TRANSFER_FEE = 100
    // const ACCOUNT_CREATION_FEE = 750; // 500 + 250
    // const STANDARD_FEE = 500;
    // const MINIMUM_TABLE_BALANCE = 50000
    // const MINIMUM_APP_BALANCE = 100000
    // const MONEY_DECIMALS = 8;
    // const DEADLINE = 60;

    constructor(jupiterAPIService, applicationProperties) {


// console.log(applicationProperties)

        // this.feeNQT = 100;
        this.feeNQT = parseInt(applicationProperties.feeNQT);
        // this.tableCreation = 750;
        this.tableCreation = parseInt(applicationProperties.accountCreationFeeNQT)



        console.log('minuser', applicationProperties.minimumAppBalance)
        console.log('mintable', applicationProperties.minimumTableBalance)
        console.log('fee', applicationProperties.feeNQT)
        console.log('acccreate', applicationProperties.accountCreationFeeNQT)

        this.defaultNewUserTransferAmount = parseInt(applicationProperties.minimumAppBalance)
        this.defaultNewTableTransferAmount = parseInt(applicationProperties.minimumTableBalance)

        console.log(applicationProperties.minimumAppBalance)
        console.log(applicationProperties.feeNQT)
        console.log(applicationProperties.accountCreationFeeNQT)
        logger.debug(`this.defaultNewUserTransferAmount= ${this.defaultNewUserTransferAmount}`)


        this.jupiterAPIService = jupiterAPIService;
        this.applicationProperties = applicationProperties;
        this.intervalTimeInSeconds = 5; //5
        this.maxWaitTimeLimitInSeconds = 120;//seconds
    }

    async waitForTransactionConfirmation(transactionId){
        // logger.verbose('#####################################################################################');
        // logger.verbose(`## waitForTransactionConfirmation(transactionId= ${transactionId})`);
        // logger.verbose('#####################################################################################');
        logger.verbose('waiting for confirmation');
        return new Promise(async (resolve, reject) => {
            let workTime = 0;
            const milliseconds = this.intervalTimeInSeconds * 1000;

            let timerId = setInterval(async () => {
                console.log(`workTime= ${workTime}`);
                const getTransactionResponse = await this.jupiterAPIService.getTransaction(transactionId)
                const confirmations = (getTransactionResponse.data.confirmations) ? getTransactionResponse.data.confirmations : 0;
                console.log('confirmations count: ', confirmations)
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
        logger.verbose('#####################################################################################');
        // const standardFeeNQT = 100;
        // const accountCreationFee = 750; // 500 + 250
        const initialAmount = this.defaultNewUserTransferAmount;
        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
        // const subtype = feeManagerSingleton.getTransactionType(FeeManager.feeTypes.new_user_funding).subtype;
        return this.transfer(this.applicationProperties, recipientProperties, initialAmount, fee);
    }


    async provideInitialStandardTableFunds(recipientProperties){
        logger.verbose('#####################################################################################');
        logger.verbose(`## provideInitialStandardApplicationFunds( recipientProperties= ${!!recipientProperties})`);
        logger.verbose('#####################################################################################');
        // const standardFeeNQT = 100;
        // const accountCreationFee = 750; // 500 + 250
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
        logger.verbose(`transfer(senderProperties= ${!!senderProperties}, recipientProperties= ${!!recipientProperties}, transferAmount= ${transferAmount})`)
        logger.verbose('#####################################################################################');
        logger.debug(`sender: ${senderProperties.address}`);
        logger.debug(`recipient: ${recipientProperties.address}`);
        logger.debug(`amount: ${transferAmount}`);
        if (!transferAmount) {
            throw new Error('transfer amount missing');
        }

        if (!recipientProperties) {
            throw new Error('recipient missing');
        }

        if (!senderProperties) {
            throw new Error('sender missing');
        }

        return this.jupiterAPIService.transferMoney( senderProperties, recipientProperties, transferAmount, fee )
    }

    // transferAndWait(senderProperties, recipientProperties, transferAmount, secondsToWait= 50) {
    //     logger.verbose('#####################################################################################');
    //     logger.verbose(` transferAndWait(senderProperties=${senderProperties}, recipientProperties=${recipientProperties}, transferAmount=${transferAmount}, secondsToWait= ${secondsToWait})`);
    //     logger.verbose('#####################################################################################');
    //
    //     const milliseconds = secondsToWait * 1000;
    //     return new Promise( (resolve, reject) => {
    //         this.transfer(senderProperties, recipientProperties, transferAmount)
    //             .then(response => {
    //                 setTimeout(async () => {
    //                     return resolve(response)
    //                 }, milliseconds );
    //             })
    //             .catch(error => {
    //                 return reject(error);
    //             })
    //     })
    // }


}

module.exports.JupiterFundingService = JupiterFundingService;


// getTransaction
// {
//     "signature": "8cc047a66cb7ed8eb3e3c39d0e7aefb6fcf8c2330bad6aeabb99043c02f08d0898f514b29a9257ace1d13284476090b298cd02e63b09bc17213da97b6504c0aa",
//     "transactionIndex": 0,
//     "type": 0,
//     "phased": false,
//     "ecBlockId": "5624364723090196884",
//     "signatureHash": "6be9d7b012afacd6c61ad9729d40e1d96acf984b83be58ec4ae3d638f90434d6",
//     "attachment": {
//     "version.OrdinaryPayment": 0
// },
//     "senderRS": "JUP-KMRG-9PMP-87UD-3EXSF",
//     "subtype": 0,
//     "amountNQT": "10000000",
//     "recipientRS": "JUP-93GC-L5NG-ZHNZ-AZV8A",
//     "block": "2106194194833474657",
//     "blockTimestamp": 120979189,
//     "deadline": 60,
//     "timestamp": 120979187,
//     "height": 203991,
//     "senderPublicKey": "8435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb068",
//     "feeNQT": "100",
//     "requestProcessingTime": 1,
//     "confirmations": 12,
//     "fullHash": "c64acdcc4ddb40df614b764ae893d502de95b4e257fa42f7d294b872d47c030d",
//     "version": 1,
//     "sender": "1649351268274589422",
//     "recipient": "9519342497736918474",
//     "ecBlockHeight": 203270,
//     "transaction": "16087098996162382534"
// }
