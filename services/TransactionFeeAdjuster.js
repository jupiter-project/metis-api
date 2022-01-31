class DefaultFeeStrategy{
    constructor(feePerCharacter=0,baseFeeMarkupPercentage=0){
        this.baseFeeMarkupPercentage = baseFeeMarkupPercentage;
        this.feePerCharacter = feePerCharacter;
    }

    calculateFee(baseFee,messageToEncryptSize, messageSize){
        const newBaseFee = baseFee + (baseFee * this.baseFeeMarkupPercentage);
        const totalmessageToEncryptSize =  messageToEncryptSize * this.feePerCharacter;
        const totalmessageSize =  messageSize * this.feePerCharacter;
        return newBaseFee + totalmessageToEncryptSize + totalmessageSize;
    }
}

class OrdinaryPaymentFeeStrategy{
    constructor(feePerCharacter=0,baseFeeMarkupPercentage=0){
        this.baseFeeMarkupPercentage = baseFeeMarkupPercentage;
        this.feePerCharacter = feePerCharacter;
    }

    calculateFee(baseFee,messageToEncryptSize, messageSize){
        const newBaseFee = baseFee + (baseFee * this.baseFeeMarkupPercentage);
        const totalmessageToEncryptSize =  messageToEncryptSize * this.feePerCharacter;
        const totalmessageSize =  messageSize * this.feePerCharacter;
        return newBaseFee + totalmessageToEncryptSize + totalmessageSize;
    }
}


class JimChunkFeeStrategy {
    constructor(defaultChunkSize, feePerCharacter, baseFeeMarkupPercentage=0) {
        this.name = 'jim-chunk-fee-strategy';
        this.defaultChunkSize = defaultChunkSize;
        this.feePerCharacter = feePerCharacter;
        this.baseFeeMarkupPercentage = baseFeeMarkupPercentage;
    }

    calculateFee(baseFee, chunkSize = this.defaultChunkSize){
        const newBaseFee = baseFee + (baseFee * this.baseFeeMarkupPercentage);
        const totalChunksFee = chunkSize * this.feePerCharacter;
        // const newBaseFee = (baseFee +totalChunksFee) * this.baseFeeMarkupPercentage;
        return newBaseFee + totalChunksFee;
    }
}

class TransactionFeeAdjuster {
    constructor(
        ordinaryPaymentFeeStrategy,
        accountInfoFeeStrategym,
        defaultFeeStrategy
    ) {
        this.feeStrategies = {};
        this.feeStrategies[this.getFeeStrategy(1,12)] = accountInfoFeeStrategy;
        this.feeStrategies['blalbla'] = ordinaryPaymentFeeStrategy;
        // this.jimChunkFeeStrategy = jimChunkFeeStrategy;
        // this.feeStrategies = feeStrategies.reduce((reduced, feeStrategy) => {
        //     //strategies = {jim-chunk-strategy: JIMCHUNKFEESTRATEGY }
        //     reduced[feeStrategy.name] = feeStrategy;
        //     return reduced;
        // }, {})
    }

    getFeeStrategy(type, subtype){
        const typeSubType = `${type}.${subtype}`;
        // Subtype 12: Metis Account Info
        // Subtype 13: Metis Channel Invitation
        // Subtype 14: Metis Channel Member
        // Subtype 15: Metis Message
        // Subtype 16: SUBTYPE_MESSAGING_METIS_DATA
        // Subtype 17: SUBTYPE_MESSAGING_METIS_METADATA


        switch (typeSubType){
            case '0.0': return 'ordinary-payment';
            case '1.12': return 'metis-account-info';
            case '1.13': return 'metis-channel-invitation';
            case '1.3':return 'default';

            default : throw new Error('');
        }

    }


    // getStrategyNames() {
    //     return Object.values(this.feeStrategies);
    // }

    // hasStrategy(feeStrategy){
    //     return this.getStrategyNames().includes(feeStrategy)
    // }

    calculateFee(baseFee, type,subtype){
        // if(!this.hasStrategy(feeStrategy)) throw new Error('');
        if(isNaN(baseFee)) throw new Error('');
        const feeStrategy = this.getFeeStrategy(type,subtype);
        return this.feeStrategies[feeStrategy].calculateFee(baseFee);
    }

}
// const feeStrategies = [];
const jimChunkFeeStrategy = new JimChunkFeeStrategy(metisConf.fee.);
const ordinaryPaymentFeeStrategy = new OrdinaryPaymentFeeStrategy();

module.exports.transactionFeeAdjuster = new TransactionFeeAdjuster(
    ordinaryPaymentFeeStrategy,
    jimChunkFeeStrategy
);

module.exports.TransactionFeeAdjuster = TransactionFeeAdjuster;
