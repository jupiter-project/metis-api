module.exports.transactionConstants = {
    type: {
        payment: {
            value:0,
            subtype: {ordinaryPayment: 0}
        },
        messaging: {
            value:1,
            subtype: {
                arbitraryMessage: 0,
                aliasAssignment: 1,
                pollCreation: 2,
                voteCasting: 3,
                hubAnnouncement: 4,
                accountInfo: 5,
                aliasSale: 6,
                aliasBuy: 7,
                aliasDeletion: 8,
                transactionApproval: 9,
                accountProperty: 10,
                accountPropertyDeletion: 11,
                metisAccountInfo: 12,
                metisChannelInvitation: 13,
                metisChannelMember: 14,
                metisMessage: 15,
            }
        },
        voting: {
            value:1,
            subtype: {}
        },
        aliases: {
            value:1,
            subtype: {}
        },
        assetExchange: {
            value:2,
            subtype: {}
        },
        marketPlace: {
            value:3,
            subtype: {}
        },
        accountControl: {
            value:4,
            subtype: {}
        },
        monetarySystem: {
            value:5,
            subtype: {}
        },
        dataCloud: {
            value:6,
            subtype: {}
        },
        marketPlace2: {
            value:7,
            subtype: {}
        },
        type8: {
            value:8,
            subtype: {}
        },
    }
};


