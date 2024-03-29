const { feeConf } = require('../config/feeConf')
const _ = require('lodash')
const { jimConfig } = require('../src/jim/config/jimConfig')
const logger = require('../utils/logger')(module)
class FeeManager {
  constructor() {
    this.fees = []
    this.fees.push({
      feeType: FeeManager.feeTypes.metisMessage,
      fee: feeConf.message.NQT,
      type: FeeManager.TransactionTypes.messaging_voting_aliases,
      subtype: FeeManager.JupiterTypeOneSubtypes.metisMessage
    })
    this.fees.push({
      feeType: FeeManager.feeTypes.regular_transaction,
      fee: feeConf.regularTransaction.NQT,
      type: FeeManager.TransactionTypes.messaging_voting_aliases,
      subtype: FeeManager.JupiterTypeOneSubtypes.arbitraryMessage
    })
    this.fees.push({
      feeType: FeeManager.feeTypes.account_record,
      fee: feeConf.accountRecord.NQT,
      type: FeeManager.TransactionTypes.messaging_voting_aliases,
      subtype: FeeManager.JupiterTypeOneSubtypes.metisAccountRecord
    })
    this.fees.push({
      feeType: FeeManager.feeTypes.invitation_to_channel,
      fee: feeConf.invitationToChannel.NQT,
      type: FeeManager.TransactionTypes.messaging_voting_aliases,
      subtype: FeeManager.JupiterTypeOneSubtypes.metisChannelInvitation
    })
    this.fees.push({
      feeType: FeeManager.feeTypes.metis_channel_member,
      fee: feeConf.channelMember.NQT,
      type: FeeManager.TransactionTypes.messaging_voting_aliases,
      subtype: FeeManager.JupiterTypeOneSubtypes.metisChannelMember
    })
    this.fees.push({
      feeType: FeeManager.feeTypes.alias_assignment,
      fee: feeConf.aliasAssignment.NQT,
      type: FeeManager.TransactionTypes.messaging_voting_aliases,
      subtype: FeeManager.JupiterTypeOneSubtypes.aliasAssignment
    })
    this.fees.push({
      feeType: FeeManager.feeTypes.account_property,
      fee: feeConf.accountProperty.NQT,
      type: FeeManager.TransactionTypes.messaging_voting_aliases,
      subtype: FeeManager.JupiterTypeOneSubtypes.accountProperty
    })
    this.fees.push({
      feeType: FeeManager.feeTypes.account_property_deletion,
      fee: feeConf.accountPropertyDeletion.NQT,
      type: FeeManager.TransactionTypes.messaging_voting_aliases,
      subtype: FeeManager.JupiterTypeOneSubtypes.accountPropertyDeletion
    })

    this.fees.push({
      feeType: FeeManager.feeTypes.new_user_funding,
      fee: feeConf.newUserFunding.NQT,
      type: FeeManager.TransactionTypes.payment,
      subtype: FeeManager.JupiterTypZeroSubtypes.ordinaryPayment
    })

    this.fees.push({
      feeType: FeeManager.feeTypes.ordinary_payment,
      fee: feeConf.ordinaryPayment.NQT,
      type: FeeManager.TransactionTypes.payment,
      subtype: FeeManager.JupiterTypZeroSubtypes.ordinaryPayment
    })
    this.fees.push({
      feeType: FeeManager.feeTypes.messageCharacter,
      fee: feeConf.messageCharacter.NQT,
      type: FeeManager.TransactionTypes.messaging_voting_aliases,
      subtype: FeeManager.JupiterTypeOneSubtypes.metisMessage
    })
  }

  static feeTypes = {
    nft_creation: 'nft_creation',
    asset_creation: 'asset_creation',
    storage: 'storage',
    regular_transaction: 'regular_transaction',
    account_record: 'account_record',
    table_account_record: 'table_account_record',
    invitation_to_channel: 'invitation_to_channel',
    metis_channel_member: 'accept_channel_invitation',
    arbitrary_message: 'arbitrary_message', //subtype 0
    alias_assignment: 'alias_assignment',
    account_property: 'account_property',
    account_property_deletion: 'account_property_deletion',
    new_user_funding: 'new_user_funding',
    ordinary_payment: 'ordinary_payment',
    metisMessage: 'metisMessage',
    messageCharacter: 'message_character'
  }

  static TransactionTypes = {
    payment: 0,
    messaging_voting_aliases: 1,
    asset_exchange: 2,
    market_place: 3,
    account_control: 4,
    monetary_system: 5,
    data_cloud: 6
  }

  static JupiterTypZeroSubtypes = {
    ordinaryPayment: 0
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
    logger.verbose(`#### getFee(feeType= ${feeType})`)
    const fees = this.fees.filter((fee) => {
      return feeType === fee.feeType
    })
    if (fees.length) return fees[0].fee
    throw new Error('Fee doesnt exist')
  }

  /**
   *
   * @param {FeeManager.feeTypes} feeType
   * @returns {type,subtype}
   */
  getTransactionTypeAndSubType(feeType) {
    const typeSubType = this.fees.reduce((reducer, fee) => {
      if (feeType === fee.feeType) {
        reducer.push({ type: fee.type, subtype: fee.subtype })
      }
      return reducer
    }, [])

    if (typeSubType.length < 1) {
      throw new Error('Type doesnt exist')
    }

    return typeSubType[0]
  }

  /**
   *
   * @param messageSize
   * @return {number}
   */
  calculateMessageFee(messageSize) {
    logger.verbose(`#### calculateMessageFee(messageSize)`)
    if (!_.isNumber(messageSize)) throw new Error(`messageSize needs to be a number`)
    const baseFee = this.getFee(FeeManager.feeTypes.metisMessage)
    const charFee = +this.getFee(FeeManager.feeTypes.messageCharacter)
    const calculatedFee = baseFee + messageSize * charFee
    return calculatedFee
  }

  /**
   *
   * @param base64FileSize
   * @return {number}
   */
  calculateFileFee(base64FileSize) {
    if (!base64FileSize) return 0 //@TODO what should we return?
    const numberOfChunks = Math.ceil(base64FileSize / +jimConfig.fileChunkSize)
    let fee = 0
    for (let i = 0; i < numberOfChunks; i++) {
      fee = fee + this.calculateMessageFee(+jimConfig.fileChunkSize)
    }
    return fee
  }

  // getCalculatedMessageFee(message) {
  //     const size = message.length;
  //     const fee = this.getFee(FeeManager.feeTypes.metisMessage);
  //     if (size === 0) return fee
  //     if (size <= 5000) return 800000
  //     if (size <= 10000) return 1600000
  //     if (size <= 15000) return 2300000
  //     if (size <= 20000) return 3100000
  //     if (size <= 25000) return 3900000
  //     if (size <= 30000) return 4700000
  //     if (size <= 35000) return 5500000
  //     if (size <= 40000) return 6300000
  //     return 6500000
  // }
  // export function calculateExpectedFees(data: Array<string>): number {
  //     let expectedFees = 0;
  //     data.forEach((data) => expectedFees += calculateMessageFee(data.length));
  //     return expectedFees*1.03;
  // }
}

module.exports.FeeManager = FeeManager
module.exports.feeManagerSingleton = new FeeManager()
