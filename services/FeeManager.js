const logger = require('../utils/logger')(module);

// Jupiter v2.4.0 Fee Enhancements
// Regular transactions, DEX orders, alias = 0.00005 JUP
// Data, JIM, IO = 0.00007 JUP (~2400 JUP per GB of data)
// Metis text messages = 0.00001 JUP
// Shuffling = 10 JUP
// Asset Creation = 50 JUP
// NFT Creation = 50 JUP


class FeeManager {

    constructor( accountRecordFee, nftCreationFee, assetCreationFee, shufflingFee, chatFee, regularTransactionFee   ) {
        this.fees = [];
        this.fees.push({feeType: FeeManager.feeTypes.nft_creation, fee: nftCreationFee, subtype: 1, type: 1 })
        this.fees.push({feeType: FeeManager.feeTypes.asset_creation, fee: assetCreationFee, subtype: 1, type:1})
        this.fees.push({feeType: FeeManager.feeTypes.shuffling, fee: shufflingFee, type: 1, subtype:1})
        this.fees.push({feeType: FeeManager.feeTypes.chat, fee: chatFee,  type: 1, subtype:1})
        this.fees.push({feeType: FeeManager.feeTypes.regular_transaction, fee: regularTransactionFee})
        this.fees.push({feeType: FeeManager.feeTypes.account_record, fee: accountRecordFee})
    }

    static feeTypes = {
        'nft_creation': 'nft_creation',
        'asset_creation': 'asset_creation',
        'shuffling': 'shuffling',
        'chat': 'chat',
        'storage': 'storage',
        'regular_transaction': 'regular_transaction',
        'account_record': 'account_record'
    }

    //// Data, JIM, IO = 0.00007 JUP (~2400 JUP per GB of data)
    getStorageFee(feeType, fileSize){
        return 100;
    }


    getFeeByTypeSubType(type, subtype){

    }

    /**
     *
     * @param feeType
     * @returns {*}
     */
    getFee(feeType){

        const fees =  this.fees.filter( fee => { return  feeType ===  fee.feeType})
        if(fees.length > 0){
            return fees[0]
        }

        throw new Error('Fee doesnt exist');
    }

    getTransactionType(feeType){
        const typeSubType =  this.fees.reduce( (reducer, fee) => {
            if(feeType ===  fee.feeType){
                return reducer.push({ type: fee.type, subtype: fee.subtype});
            }
            return reducer;
        }, [])

        if(typeSubType.length < 1){
            throw new Error('Type doesnt exist');
        }

        return typeSubType
    }

}

module.exports.FeeManager = FeeManager;
module.exports.feeManagerSingleton = new FeeManager(
    process.env.ACCOUNT_RECORD_FEE,
    99,
    98,
    97,
    96,
    95
);
