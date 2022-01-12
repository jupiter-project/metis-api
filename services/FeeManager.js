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
        regularTransactionFee,
        invitationToChannelFee,
        metisChannelMemberFee,
        arbitraryMessageFee,
        aliasAssigmentFee,
        accountPropertyFee,
        accountPropertyDeletionFee,
        newUserFundingFee,
        newTableFundingFee,
        accountRecordFee,
        ordinaryPaymentFee,
        metisMessageFee
    ) {

        if(!regularTransactionFee){throw new Error('missing regularTransactionFee')}
        if(!invitationToChannelFee){throw new Error('missing invitationToChannelFee')}
        if(!metisChannelMemberFee){throw new Error('missing metisChannelMemberFee')}
        if(!arbitraryMessageFee){throw new Error('missing arbitraryMessageFee')}
        if(!aliasAssigmentFee){throw new Error('missing aliasAssigmentFee')}
        if(!accountPropertyFee){throw new Error('missing accountPropertyFee')}
        if(!accountPropertyDeletionFee){throw new Error('missing accountPropertyDeletionFee')}
        if(!newUserFundingFee){throw new Error('missing newUserFundingFee')}
        if(!newTableFundingFee){throw new Error('missing newTableFundingFee')}
        if(!accountRecordFee){throw new Error('missing accountRecordFee')}
        if(!ordinaryPaymentFee){throw new Error('missing ordinaryPaymentFee')}
        if(!metisMessageFee){throw new Error('missing metisMessageFee')}

        this.fees = [];
        this.fees.push({
            feeType: FeeManager.feeTypes.metisMessage,
            fee: metisMessageFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.metisMessage
        })

        this.fees.push({
            feeType: FeeManager.feeTypes.regular_transaction,
            fee: regularTransactionFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.arbitraryMessage
        })


        this.fees.push({
            feeType: FeeManager.feeTypes.account_record,
            fee: accountRecordFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.metisAccountRecord
        })

        this.fees.push({
            feeType: FeeManager.feeTypes.invitation_to_channel,
            fee: invitationToChannelFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.metisChannelInvitation
        })
        this.fees.push({
            feeType: FeeManager.feeTypes.metis_channel_member,
            fee: metisChannelMemberFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.metisChannelMember
        });
        this.fees.push({
            feeType: FeeManager.feeTypes.alias_assignment,
            fee: aliasAssigmentFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.aliasAssignment
        });
        this.fees.push({
            feeType: FeeManager.feeTypes.account_property,
            fee: accountPropertyFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.accountProperty
        });
        this.fees.push({
            feeType: FeeManager.feeTypes.account_property_deletion,
            fee: accountPropertyDeletionFee,
            type: FeeManager.TransactionTypes.messaging_voting_aliases,
            subtype: FeeManager.JupiterTypeOneSubtypes.accountPropertyDeletion
        });

        this.fees.push({
            feeType: FeeManager.feeTypes.new_user_funding,
            fee: newUserFundingFee,
            type: FeeManager.TransactionTypes.payment,
            subtype: FeeManager.JupiterTypZeroSubtypes.ordinaryPayment
        });

        this.fees.push({
            feeType: FeeManager.feeTypes.new_table_funding,
            fee: newTableFundingFee,
            type: FeeManager.TransactionTypes.payment,
            subtype: FeeManager.JupiterTypZeroSubtypes.ordinaryPayment
        });

        this.fees.push({
            feeType: FeeManager.feeTypes.ordinary_payment,
            fee: ordinaryPaymentFee ,
            type: FeeManager.TransactionTypes.payment,
            subtype: FeeManager.JupiterTypZeroSubtypes.ordinaryPayment
        });
    }

    static feeTypes = {
        'nft_creation': 'nft_creation',
        'asset_creation': 'asset_creation',
        'storage': 'storage',
        'regular_transaction': 'regular_transaction',
        'account_record': 'account_record',
        'table_account_record':'table_account_record',
        'invitation_to_channel': 'invitation_to_channel',
        'metis_channel_member': 'accept_channel_invitation',
        'arbitrary_message': 'arbitrary_message', //subtype 0
        'alias_assignment': 'alias_assignment',
        'account_property': 'account_property',
        'account_property_deletion': 'account_property_deletion',
        'new_user_funding':'new_user_funding',
        'new_table_funding':'new_table_funding',
        'ordinary_payment': 'ordinary_payment',
        'metisMessage': 'metisMessage',
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

    static JupiterTypZeroSubtypes = {
        ordinaryPayment: 0,
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
        metisAccountRecord: 12,
        metisChannelInvitation: 13,
        metisChannelMember: 14,
        metisMessage: 15
    }


    /**
     *
     * @param {FeeManager.feeTypes} feeType
     * @returns {number}
     */
    getFee(feeType) {
        logger.verbose(`#### getFee(feeType= ${feeType})`);
        const fees = this.fees.filter(fee => {
            return feeType === fee.feeType
        })

        if (fees.length) {
            return fees[0].fee
        }

        throw new Error('Fee doesnt exist');
    }

    /**
     *
     * @param {FeeManager.feeTypes} feeType
     * @returns {type,subtype}
     */
    getTransactionTypeAndSubType(feeType) {
        const typeSubType = this.fees.reduce((reducer, fee) => {
            if (feeType === fee.feeType) {
                reducer.push({type: fee.type, subtype: fee.subtype});
            }
            return reducer;
        }, [])

        if (typeSubType.length < 1) {
            throw new Error('Type doesnt exist');
        }

        return typeSubType[0]
    }

    getTotalDataFee(bufferData){
        const total =  bufferData.reduce( (reduced,item)=>{
            reduced = reduced + this.getCalculatedMessageFee(item);
        }, 0 )

        return total * 1.03
    }

    getCalculatedMessageFee(message) {
        const size = message.length;
        const fee = this.getFee(FeeManager.feeTypes.metisMessage);
        if (size === 0) return fee
        if (size <= 5000) return 800000
        if (size <= 10000) return 1600000
        if (size <= 15000) return 2300000
        if (size <= 20000) return 3100000
        if (size <= 25000) return 3900000
        if (size <= 30000) return 4700000
        if (size <= 35000) return 5500000
        if (size <= 40000) return 6300000
        return 6500000
    }
    // export function calculateExpectedFees(data: Array<string>): number {
    //     let expectedFees = 0;
    //     data.forEach((data) => expectedFees += calculateMessageFee(data.length));
    //     return expectedFees*1.03;
    // }
}

module.exports.FeeManager = FeeManager;
module.exports.feeManagerSingleton = new FeeManager(
    process.env.REGULAR_TRANSACTION_FEE,
    process.env.INVITATION_TO_CHANNEL_FEE,
    process.env.METIS_CHANNEL_MEMBER_FEE,
    process.env.ARBITRARY_MESSAGE_FEE,
    process.env.ALIAS_ASSIGNMENT_FEE,
    process.env.ACCOUNT_PROPERTY_FEE,
    process.env.ACCOUNT_PROPERTY_DELETION_FEE,
    process.env.NEW_USER_FUNDING_FEE,
    process.env.NEW_TABLE_FUNDING_FEE,
    process.env.ACCOUNT_RECORD_FEE,
    process.env.ORDINARY_PAYMENT_FEE,
    process.env.METIS_MESSAGE_FEE
);
