// const _ = require("lodash");
if (isNaN(process.env.REGULAR_TRANSACTION_FEE))
  throw new Error(`Environment Variable REGULAR_TRANSACTION_FEE is not a number ${process.env.REGULAR_TRANSACTION_FEE}`)
const regularTransactionFee = +process.env.REGULAR_TRANSACTION_FEE
// if(!process.env.REGULAR_TRANSACTION_FEE) throw new Error('Environment Variable missing: REGULAR_TRANSACTION_FEE');
if (isNaN(process.env.ACCOUNT_RECORD_FEE))
  throw new Error(`Environment Variable ACCOUNT_RECORD_FEE is not a number ${process.env.ACCOUNT_RECORD_FEE}`)
const accountRecordFee = +process.env.ACCOUNT_RECORD_FEE
// if(!process.env.ACCOUNT_RECORD_FEE) throw new Error('Environment Variable missing: ACCOUNT_RECORD_FEE');
if (isNaN(process.env.NEW_USER_FUNDING_FEE))
  throw new Error(`Environment Variable NEW_USER_FUNDING_FEE is not a number ${process.env.NEW_USER_FUNDING_FEE}`)
const newUserFundingFee = +process.env.NEW_USER_FUNDING_FEE
// if(!process.env.NEW_USER_FUNDING_FEE) throw new Error('Environment Variable missing: NEW_USER_FUNDING_FEE');
if (isNaN(process.env.ORDINARY_PAYMENT_FEE))
  throw new Error(`Environment Variable ORDINARY_PAYMENT_FEE is not a number ${process.env.ORDINARY_PAYMENT_FEE}`)
const ordinaryPaymentFee = +process.env.ORDINARY_PAYMENT_FEE
// if(!process.env.ORDINARY_PAYMENT_FEE) throw new Error('Environment Variable missing: ORDINARY_PAYMENT_FEE');
if (isNaN(process.env.ACCOUNT_PROPERTY_FEE))
  throw new Error(`Environment Variable ACCOUNT_PROPERTY_FEE is not a number ${process.env.ACCOUNT_PROPERTY_FEE}`)
const accountPropertyFee = +process.env.ACCOUNT_PROPERTY_FEE
// if(!process.env.ACCOUNT_PROPERTY_FEE) throw new Error('Environment Variable missing: ACCOUNT_PROPERTY_FEE');
if (isNaN(process.env.INVITATION_TO_CHANNEL_FEE))
  throw new Error(
    `Environment Variable INVITATION_TO_CHANNEL_FEE is not a number ${process.env.INVITATION_TO_CHANNEL_FEE}`
  )
const invitationToChannelFee = +process.env.INVITATION_TO_CHANNEL_FEE
// if(!process.env.INVITATION_TO_CHANNEL_FEE) throw new Error('Environment Variable missing: INVITATION_TO_CHANNEL_FEE');
if (isNaN(process.env.METIS_CHANNEL_MEMBER_FEE))
  throw new Error(
    `Environment Variable METIS_CHANNEL_MEMBER_FEE is not a number ${process.env.METIS_CHANNEL_MEMBER_FEE}`
  )
const metisChannelMemberFee = +process.env.METIS_CHANNEL_MEMBER_FEE
// if(!process.env.METIS_CHANNEL_MEMBER_FEE) throw new Error('Environment Variable missing: METIS_CHANNEL_MEMBER_FEE');
if (isNaN(process.env.ALIAS_ASSIGNMENT_FEE))
  throw new Error(`Environment Variable ALIAS_ASSIGNMENT_FEE is not a number ${process.env.ALIAS_ASSIGNMENT_FEE}`)
const aliasAssignmentFee = +process.env.ALIAS_ASSIGNMENT_FEE
// if(!process.env.ALIAS_ASSIGNMENT_FEE) throw new Error('Environment Variable missing: ALIAS_ASSIGNMENT_FEE');
if (isNaN(process.env.ACCOUNT_PROPERTY_DELETION_FEE))
  throw new Error(
    `Environment Variable ACCOUNT_PROPERTY_DELETION_FEE is not a number ${process.env.ACCOUNT_PROPERTY_DELETION_FEE}`
  )
const accountPropertyDeletionFee = +process.env.ACCOUNT_PROPERTY_DELETION_FEE
// if(!process.env.ACCOUNT_PROPERTY_DELETION_FEE) throw new Error('Environment Variable missing: ACCOUNT_PROPERTY_DELETION_FEE');
if (isNaN(process.env.METIS_MESSAGE_FEE))
  throw new Error(`Environment Variable METIS_MESSAGE_FEE is not a number ${process.env.METIS_MESSAGE_FEE}`)
const metisMessageFee = +process.env.METIS_MESSAGE_FEE
if (isNaN(process.env.MESSAGE_CHARACTER_FEE))
  throw new Error(`Environment Variable MESSAGE_CHARACTER_FEE is not a number ${process.env.MESSAGE_CHARACTER_FEE}`)
const messageCharacterFee = +process.env.MESSAGE_CHARACTER_FEE
// if(!process.env.MESSAGE_CHARACTER_FEE) throw new Error('Environment Variable missing: MESSAGE_CHARACTER_FEE');

module.exports.feeConf = {
  regularTransaction: { NQT: regularTransactionFee },
  accountRecord: { NQT: accountRecordFee },
  newUserFunding: { NQT: newUserFundingFee },
  ordinaryPayment: { NQT: ordinaryPaymentFee },
  accountProperty: { NQT: accountPropertyFee },
  accountPropertyDeletion: { NQT: accountPropertyDeletionFee },
  invitationToChannel: { NQT: invitationToChannelFee },
  channelMember: { NQT: metisChannelMemberFee },
  aliasAssignment: { NQT: aliasAssignmentFee },
  message: { NQT: metisMessageFee },
  messageCharacter: { NQT: messageCharacterFee }
}
