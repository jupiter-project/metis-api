if(!process.env.REGULAR_TRANSACTION_FEE) throw new Error('Environment Variable missing: REGULAR_TRANSACTION_FEE');
if(!process.env.ACCOUNT_RECORD_FEE) throw new Error('Environment Variable missing: ACCOUNT_RECORD_FEE');
if(!process.env.NEW_USER_FUNDING_FEE) throw new Error('Environment Variable missing: NEW_USER_FUNDING_FEE');
if(!process.env.ORDINARY_PAYMENT_FEE) throw new Error('Environment Variable missing: ORDINARY_PAYMENT_FEE');
if(!process.env.ACCOUNT_PROPERTY_FEE) throw new Error('Environment Variable missing: ACCOUNT_PROPERTY_FEE');
if(!process.env.INVITATION_TO_CHANNEL_FEE) throw new Error('Environment Variable missing: INVITATION_TO_CHANNEL_FEE');
if(!process.env.METIS_CHANNEL_MEMBER_FEE) throw new Error('Environment Variable missing: METIS_CHANNEL_MEMBER_FEE');
if(!process.env.ALIAS_ASSIGNMENT_FEE) throw new Error('Environment Variable missing: ALIAS_ASSIGNMENT_FEE');
if(!process.env.ACCOUNT_PROPERTY_DELETION_FEE) throw new Error('Environment Variable missing: ACCOUNT_PROPERTY_DELETION_FEE');
if(!process.env.METIS_MESSAGE_FEE) throw new Error('Environment Variable missing: METIS_MESSAGE_FEE');
if(!process.env.MESSAGE_CHARACTER_FEE) throw new Error('Environment Variable missing: MESSAGE_CHARACTER_FEE');

module.exports.feeConf = {
    regularTransaction: {NQT: process.env.REGULAR_TRANSACTION_FEE},
    accountRecord: {NQT: process.env.ACCOUNT_RECORD_FEE},
    newUserFunding: {NQT: process.env.NEW_USER_FUNDING_FEE},
    ordinaryPayment: {NQT: process.env.ORDINARY_PAYMENT_FEE},
    accountProperty: {NQT: process.env.ACCOUNT_PROPERTY_FEE},
    accountPropertyDeletion: {NQT: process.env.ACCOUNT_PROPERTY_DELETION_FEE},
    invitationToChannel: {NQT: process.env.INVITATION_TO_CHANNEL_FEE},
    channelMember: {NQT: process.env.METIS_CHANNEL_MEMBER_FEE},
    aliasAssignment: {NQT: process.env.ALIAS_ASSIGNMENT_FEE},
    message: {NQT: process.env.METIS_MESSAGE_FEE},
    messageCharacter: {NQT: process.env.MESSAGE_CHARACTER_FEE}
}

