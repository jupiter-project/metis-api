const logger = require('../utils/logger')(module);

// Jupiter v2.4.0 Fee Enhancements
// Regular transactions, DEX orders, alias = 0.00005 JUP
// Data, JIM, IO = 0.00007 JUP (~2400 JUP per GB of data)
// Metis text messages = 0.00001 JUP
// Shuffling = 10 JUP
// Asset Creation = 50 JUP
// NFT Creation = 50 JUP





class FeeManager {

    constructor( accountRecordFee  ) {
        this.fees = [];
        this.fees.push({feeType: FeeManager.feeTypes.account_record, fee: accountRecordFee})
    }

    static feeTypes = {
        'nft_creation': 'nft_creationg',
        'asset_creation': 'asset_creation',
        'shuffling': 'shuffling',
        'chat': 'chat',
        'storage': 'storage',
        'regular_transaction': 'regular_transaction',
        'account_record': 'account_record'
    }

    getFee(feeType){
        const fees =  this.fees.filter( fee => { return  feeType ===  fee.feeType})
        if(fees.length > 0){
            return fees[0]
        }

        throw new Error('Fee doesnt exist');
    }

}

module.exports.FeeManager = FeeManager;
module.exports.feeManagerSingleton = new FeeManager(
    process.env.ACCOUNT_RECORD_FEE
);
