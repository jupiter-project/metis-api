module.exports.transactionTypeConstants = {
    ordinaryPayment:{
        ordinaryPayment: {
            key: 'payment-ordinary-payment',
            type:0,
            subType:0
        }
    },
    messaging: {
        arbitraryMessage: {
            key: 'messaging-arbitrary-message',
            type:1,
            subType:0,
        },
        aliasAssignment: {
            key: 'messaging-alias-assignment',
            type:1,
            subType:1,
        },
        accountInfo:{
            key: 'messaging-account-info',
            type:1,
            subType:5,
        },
        accountProperty:{
            key: 'messaging-account-property',
            type:1,
            subType:10,
        },
        metisAccountInfo:{
            key: 'messaging-metis-account-info',
            type:1,
            subType:12,
        },
        metisChannelInvitation:{
            key: 'messaging-metis-channel-invitation',
            type:1,
            subType:13,
        },
        metisChannelMember:{
            key: 'messaging-metis-channel-member',
            type:1,
            subType:14,
        },
        metisMessage:{
            key: 'messaging-metis-message',
            type:1,
            subType:15,
        },
        metisData:{
            key: 'messaging-metis-data',
            type:1,
            subType:16,
        },
        metisMetadata:{
            key: 'messaging-metis-metadata',
            type:1,
            subType:17,
        }
    }
};

