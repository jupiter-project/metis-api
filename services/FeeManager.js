const logger = require('../utils/logger')(module);

// Jupiter v2.4.0 Fee Enhancements
// Regular transactions = 0.00005 JUP
// DEX orders = 0.00005 JUP
// alias = 0.00005 JUP
// Data, JIM, IO = 0.00007 JUP (~2400 JUP per GB of data)
// Metis text messages = 0.00001 JUP
// Shuffling = 10 JUP
// Asset Creation = 50 JUP
// NFT Creation = 50 JUP


class FeeManager {

    constructor(
        accountInfoFee,
        nftCreationFee,
        assetCreationFee,
        shufflingFee,
        chatFee,
        regularTransactionFee,
        invitationToChannelFee,
        metisChannelMemberFee,
        arbitraryMessageFee,
        aliasAssigmentFee,
        accountPropertyFee,
        accountPropertyDeletionFee,
        newUserFundingFee,
        newTableFundingFee
    ) {
        this.fees = [];
        this.fees.push({
            feeType: FeeManager.FeeTypes.nft_creation,
            fee: nftCreationFee,
            type: 99,
            subtype: 99
        })
        this.fees.push({
            feeType: FeeManager.FeeTypes.asset_creation,
            fee: assetCreationFee,
            type: 99,
            subtype: 99
        })
        this.fees.push({
            feeType: FeeManager.FeeTypes.shuffling,
            fee: shufflingFee,
            type: 99,
            subtype: 99
        })
        this.fees.push({
            feeType: FeeManager.FeeTypes.chat,
            fee: chatFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.metisMessage
        })
        this.fees.push({
            feeType: FeeManager.FeeTypes.regular_transaction,
            fee: regularTransactionFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.arbitraryMessage
        })
        this.fees.push({
            feeType: FeeManager.FeeTypes.account_record,
            fee: accountInfoFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.accountInfo
        })
        this.fees.push({
            feeType: FeeManager.FeeTypes.invitation_to_channel,
            fee: invitationToChannelFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.metisChannelInvitation
        })
        this.fees.push({
            feeType: FeeManager.FeeTypes.accept_channel_invitation,
            fee: metisChannelMemberFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.metisChannelMember
        });
        this.fees.push({
            feeType: FeeManager.FeeTypes.arbitrary_message,
            fee: arbitraryMessageFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.arbitraryMessage
        });
        this.fees.push({
            feeType: FeeManager.FeeTypes.alias_assignment,
            fee: aliasAssigmentFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.aliasAssignment
        });
        this.fees.push({
            feeType: FeeManager.FeeTypes.account_property,
            fee: accountPropertyFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.accountProperty
        });
        this.fees.push({
            feeType: FeeManager.FeeTypes.account_property_deletion,
            fee: accountPropertyDeletionFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.accountPropertyDeletion
        });

        this.fees.push({
            feeType: FeeManager.FeeTypes.new_user_funding,
            fee: newUserFundingFee,
            type: FeeManager.TransactionTypes.payment,
            subtype: 0 // Ordinary Payment
        });

        this.fees.push({
            feeType: FeeManager.FeeTypes.new_table_funding,
            fee: newTableFundingFee,
            type: FeeManager.TransactionTypes.payment,
            subtype: 0 // Ordinary Payment
        });


    }

    static FeeTypes = {
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
        'arbitrary_message': 'arbitrary_message', //subtype 0
        'alias_assignment': 'alias_assignment',
        'account_property': 'account_property',
        'account_property_deletion': 'account_property_deletion',
        'new_user_funding':'new_user_funding',
        'new_table_funding':'new_table_funding'
    }

    static TransactionTypes = {
        'payment': 0,
        'messaging_voting_aliases': 1,
        'asset_exchange': 2,
        'market_place': 3,
        'account_control': 4,
        'monetary_system': 5,
        'data_cloud': 6
    }

    static JupiterTypeOneSubtypes = {
        arbitraryMessage: 0,
        aliasAssignment: 1,
        pollCreation: 2,
        voteCasting: 3,
        hubAnnouncement: 4,
        accountInfo: 5,
        aliasTransfer: 6,
        aliasBuy: 7,
        aliasDeletion: 8,
        transactionApproval: 9,
        accountProperty: 10,
        accountPropertyDeletion: 11,
        metisAccountInfo: 12,
        metisChannelInvitation: 13,
        metisChannelMember: 14,
        metisMessage: 15
    }


    //// Data, JIM, IO = 0.00007 JUP (~2400 JUP per GB of data)
    getStorageFee(feeType, fileSize) {
        return 100;
    }


    getFeeByTypeSubType(type, subtype) {

    }

    /**
     *
     * @param feeType
     * @returns {*}
     */
    getFee(feeType) {

        const fees = this.fees.filter(fee => {
            return feeType === fee.feeType
        })
        if (fees.length > 0) {
            return fees[0]
        }

        throw new Error('Fee doesnt exist');
    }

    getTransactionType(feeType) {
        const typeSubType = this.fees.reduce((reducer, fee) => {
            if (feeType === fee.feeType) {
                return reducer.push({type: fee.type, subtype: fee.subtype});
            }
            return reducer;
        }, [])

        if (typeSubType.length < 1) {
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
    process.env.ARBITRARY_MESSAGE_FEE,
    process.env.ALIAS_ASSIGNMENT_FEE,
    process.env.ACCOUNT_PROPERTY_FEE,
    process.env.ACCOUNT_PROPERTY_DELETION_FEE,
    process.env.NEW_USER_FUNDING,
    process.env.NEW_TABLE_FUNDING
);


