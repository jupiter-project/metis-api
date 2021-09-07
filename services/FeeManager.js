const logger = require('../utils/logger')(module);

// Jupiter v2.4.0 Fee Enhancements
// Regular transactions, DEX orders, alias = 0.00005 JUP
// Data, JIM, IO = 0.00007 JUP (~2400 JUP per GB of data)
// Metis text messages = 0.00001 JUP
// Shuffling = 10 JUP
// Asset Creation = 50 JUP
// NFT Creation = 50 JUP


class FeeManager {

    constructor( accountInfoFee, nftCreationFee, assetCreationFee, shufflingFee, chatFee, regularTransactionFee, invitationToChannelFee, metisChannelMemberFee, table_account_record   ) {
        this.fees = [];
        this.fees.push({feeType: FeeManager.feeTypes.nft_creation, fee: nftCreationFee, subtype: 1, type: 1 });
        this.fees.push({feeType: FeeManager.feeTypes.asset_creation, fee: assetCreationFee, subtype: 1, type:1});
        this.fees.push({feeType: FeeManager.feeTypes.shuffling, fee: shufflingFee, type: 1, subtype:1});
        this.fees.push({feeType: FeeManager.feeTypes.chat, fee: chatFee,  type: 1, subtype: FeeManager.typeOneSubtypes.metisMessage});
        this.fees.push({feeType: FeeManager.feeTypes.regular_transaction, fee: regularTransactionFee});
        this.fees.push({feeType: FeeManager.feeTypes.account_record, fee: accountInfoFee, type: 1, subtype: FeeManager.typeOneSubtypes.accountInfo});
        this.fees.push({feeType: FeeManager.feeTypes.invitation_to_channel, fee: invitationToChannelFee, type: 1, subtype: FeeManager.typeOneSubtypes.metisChannelInvitation});
        this.fees.push({feeType: FeeManager.feeTypes.accept_channel_invitation, fee: metisChannelMemberFee, type:1, subtype: FeeManager.typeOneSubtypes.metisChannelMember});
        this.fees.push({feeType: FeeManager.feeTypes.table_account_record, fee: table_account_record});
    }

    static feeTypes = {
        'nft_creation': 'nft_creation',
        'asset_creation': 'asset_creation',
        'shuffling': 'shuffling',
        'chat': 'chat',
        'storage': 'storage',
        'regular_transaction': 'regular_transaction',
        'account_info': 'account_info',
        'account_record': 'account_info',
        'invitation_to_channel': 'invitation_to_channel',
        'accept_channel_invitation': 'accept_channel_invitation',
        'table_account_record': 'table_account_record',
    }


    static typeOneSubtypes = {
        arbitraryMessage: 0,
        aliasAssignment: 1,
        pollCreation: 2,
        voteCasting: 3,
        hubAnnouncement:4,
        accountInfo: 5,
        aliasTransfer: 6,
        aliasBuy: 7,
        aliasDeletion:8,
        transactionApproval:9,
        accountProperty:10,
        accountPropertyDeletion:11,
        metisAccountInfo: 12,
        metisChannelInvitation:13,
        metisChannelMember: 14,
        metisMessage: 15
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
    process.env.ACCOUNT_INFO_FEE,
    process.env.NFT_CREATION_FEE,
    process.env.ASSET_CREATION_FEE,
    process.env.SHUFFLING_FEE,
    process.env.CHAT_FEE,
    process.env.REGULAR_TRANSACTION_FEE,
    process.env.INVITATION_TO_CHANNEL_FEE,
    process.env.METIS_CHANNEL_MEMBER_FEE,
    process.env.TABLE_ACCOUNT_RECORD,
);


