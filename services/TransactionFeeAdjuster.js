const {transactionTypeConstants} = require("../src/gravity/constants/transactionTypesConstants");
const {jimConfig} = require("../src/jim/config/jimConfig");
const {feeConf} = require("../config/feeConf");
const mError = require("../errors/metisError");
const {isNumber} = require("lodash");
const logger = require('../utils/logger')(module);

class DefaultFeeStrategy{
    constructor(feePerCharacter=0,baseFeeMarkupPercentage=0){
        this.baseFeeMarkupPercentage = baseFeeMarkupPercentage;
        this.feePerCharacter = feePerCharacter;
    }

    calculateFee(baseFee,messageSize, tagSize){
        logger.verbose(`#### calculateFee(baseFee,messageToEncryptSize, messageSize)`);
        if(typeof baseFee !== 'number') throw new mError.MetisError(`baseFee needs to be a number: ${baseFee}`);
        if(typeof messageSize !== 'number') throw new mError.MetisError(`messageSize needs to be a number: ${messageSize}`);
        if(typeof tagSize !== 'number') throw new mError.MetisError(`tagSize needs to be a number: ${tagSize}`);
        logger.verbose(`baseFee= ${baseFee}`);
        logger.verbose(`messageSize= ${messageSize}`);
        logger.verbose(`tagSize= ${tagSize}`);
        const newBaseFee = baseFee + (baseFee * this.baseFeeMarkupPercentage);
        console.log(`\n`);
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-= _REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
        console.log(`newBaseFee:`);
        console.log(newBaseFee);
        console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME_ =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n`)

        console.log(typeof newBaseFee);

        const totalMessageSizeFee =  messageSize * this.feePerCharacter;
        const totalTagSizeFee =  tagSize * this.feePerCharacter;
        const calculation =  newBaseFee + totalMessageSizeFee + totalTagSizeFee;
        console.log(`\n`);
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-= _REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
        console.log(`calculation:`);
        console.log(calculation);
        console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME_ =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n`)
        return calculation;
    }
}

class OrdinaryPaymentFeeStrategy{
    constructor(feePerCharacter= 0,baseFeeMarkupPercentage= 0){
        this.baseFeeMarkupPercentage = baseFeeMarkupPercentage;
        this.feePerCharacter = feePerCharacter;
    }

    calculateFee(baseFee, messageSize, tagSize){
        const newBaseFee = baseFee + (baseFee * this.baseFeeMarkupPercentage);
        const totalMessageSize =  messageSize * this.feePerCharacter;
        const totalTagSize =  tagSize * this.feePerCharacter;
        return newBaseFee + totalMessageSize + totalTagSize;
    }
}


class JimChunkFeeStrategy {
    constructor(defaultChunkSize, feePerCharacter, baseFeeMarkupPercentage=0) {
        this.name = 'jim-chunk-fee-strategy';
        this.defaultChunkSize = defaultChunkSize;
        this.feePerCharacter = feePerCharacter;
        this.baseFeeMarkupPercentage = baseFeeMarkupPercentage;
    }

    calculateFee(baseFee, messageSize = this.defaultChunkSize, tagSize = 0){
        const newBaseFee = baseFee + (baseFee * this.baseFeeMarkupPercentage);
        const totalChunksFee = messageSize * this.feePerCharacter;
        const totalTagSizeFee = tagSize * this.feePerCharacter;
        // const newBaseFee = (baseFee +totalChunksFee) * this.baseFeeMarkupPercentage;
        return newBaseFee + totalChunksFee + totalTagSizeFee;
    }
}

class TransactionFeeAdjuster {
    strategies;
    constructor() {
        logger.verbose(`#### constructor()`);
        this.strategies = {};
    }

    addStrategy(transactionType, strategy){
        logger.verbose(`#### addStrategy(transactionType, strategy)`);
        logger.verbose(`transactionType= ${JSON.stringify(transactionType)}`);
        this.strategies[transactionType.key] = {strategy: strategy, transactionType: transactionType};
    }


    _getFeeStrategy(transactionTypeKey){
        logger.verbose(`#### _getFeeStrategy(transactionTypeKey)`);
        console.log(`\n`);
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-= _REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
        console.log(`transactionTypeKey:`);
        console.log(transactionTypeKey);
        console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME_ =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n`)
        console.log(this.strategies);
        if(!this.strategies.hasOwnProperty(transactionTypeKey)) throw new mError.MetisError(`transactionType Key is no available: ${transactionTypeKey}`);
        return this.strategies[transactionTypeKey].strategy;
    }

    /**
     *
     * @param baseFee
     * @param transactionType
     * @return {*}
     */
    calculateFee(baseFee, messageSize, tagSize, transactionType){
        logger.verbose(`#### calculateFee(baseFee, transactionType)`);
        // if(!this.hasStrategy(feeStrategy)) throw new Error('');
        if(isNaN(baseFee)) throw new Error('');
        const feeStrategy = this._getFeeStrategy(transactionType.key);
        return feeStrategy.calculateFee(baseFee,messageSize,tagSize);
    }
}
const transactionFeeAdjuster = new TransactionFeeAdjuster();
const jimChunkFeeStrategy = new JimChunkFeeStrategy(jimConfig.fileChunkSize,feeConf.feePerCharacter,feeConf.metisMessageMarkupFeePercentage);
transactionFeeAdjuster.addStrategy(transactionTypeConstants.messaging.metisData, jimChunkFeeStrategy);
const ordinaryPaymentFeeStrategy = new OrdinaryPaymentFeeStrategy();
transactionFeeAdjuster.addStrategy(transactionTypeConstants.ordinaryPayment.ordinaryPayment, ordinaryPaymentFeeStrategy);
const defaultFeeStrategy = new DefaultFeeStrategy();
transactionFeeAdjuster.addStrategy(transactionTypeConstants.messaging.metisAccountInfo, defaultFeeStrategy);
module.exports.transactionFeeAdjuster = transactionFeeAdjuster;
module.exports.TransactionFeeAdjuster = TransactionFeeAdjuster;
