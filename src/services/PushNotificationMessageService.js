const _ = require('lodash')
const { findNotifications, incrementBadgeCounter } = require('./notificationService')
const mError = require('../errors/metisError')
const gu = require('../utils/gravityUtils')
const logger = require('../utils/logger').default(module)
const { sendFirebasePN, sendApplePN } = require('../config/notifications')

/**
 *
 * @param notificationsCollection
 * @return {Promise<unknown[]|*[]>}
 */
const incrementBadgeCountersForNotifications = async (notificationsCollection) => {
  if (!gu.isNonEmptyArray(notificationsCollection)) {
    return []
  }
  const promises = []
  notificationsCollection.forEach((notification) => {
    promises.push(incrementBadgeCounter({ _id: notification._id }))
  })
  const updatedNotificationsCollection = await Promise.all(promises)
  return updatedNotificationsCollection
}

/**
 *
 * @param notificationsCollection
 * @return {*}
 */
const extractPNAccountsFromCollection = (notificationsCollection) => {
  logger.verbose('#### extractPNAccountsFromCollection = (notificationsCollection)')
  if (!Array.isArray(notificationsCollection)) {
    throw new Error('notificationsCollection is not an array')
  }
  if (notificationsCollection.length === 0) {
    return []
  }
  const pnAccountsArrayOfArrays = notificationsCollection.map((notificationDocument) => notificationDocument.pnAccounts)
  let pnAccounts = []
  pnAccountsArrayOfArrays.forEach((_pnAccounts) => {
    pnAccounts = [...pnAccounts, ..._pnAccounts]
  })

  return pnAccounts
}

/**
 *
 * @param text
 * @return {*[]}
 */
// const getMessageMentions = (text) => {
//   if (text) {
//     const reg = /@\w+/gim;
//     const mentions = text.match(reg) || [];
//     if (mentions && Array.isArray(mentions)) {
//       return mentions.map(mention => mention.replace('@', ''));
//     }
//   }
//   return [];
// }

module.exports = {
  /**
   *
   * @param recipientAddresses
   * @param senderAlias
   * @param mutedChannelAddressesToExclude
   * @param message
   * @param title
   * @param metadata
   */
  getPNTokensAndSendPushNotification: async (
    recipientAddresses,
    mutedChannelAddressesToExclude,
    body,
    title,
    metadata
  ) => {
    logger.verbose('#### getPNTokensAndSendPushNotification: (recipientAddressArray, mutedChannelsToExclude)')
    if (!gu.isNonEmptyArray(recipientAddresses)) return
    if (!recipientAddresses.every((address) => gu.isWellFormedJupiterAddress(address))) {
      throw new mError.MetisErrorBadJupiterAddress(`${recipientAddresses}`)
    }
    if (!body) {
      throw new mError.MetisError('body is empty')
    }
    if (!title) {
      throw new mError.MetisError('title is empty')
    }
    if (!Array.isArray(mutedChannelAddressesToExclude)) {
      throw new Error('mutedChannelsToExclude is not an Array')
    }
    mutedChannelAddressesToExclude.forEach((mutedChannelAddress) => {
      if (!gu.isWellFormedJupiterAddress(mutedChannelAddress)) {
        throw new mError.MetisErrorBadJupiterAddress(`mutedChannelAddress: ${mutedChannelAddress}`)
      }
    })
    // recipientAddresses.forEach(recipientAddress => {
    //   if(!gu.isWellFormedJupiterAddress(recipientAddress)) throw new mError.MetisErrorBadJupiterAddress(`recipientAddress: ${recipientAddress}`)
    // })
    const notificationsCollection = await findNotifications(recipientAddresses, mutedChannelAddressesToExclude)
    const updatedNotificationsCollection = await incrementBadgeCountersForNotifications(notificationsCollection)
    const pnAccounts = extractPNAccountsFromCollection(updatedNotificationsCollection)
    pnAccounts.forEach((pnAccount) => {
      if (pnAccount.provider === 'ios') {
        return sendApplePN(pnAccount.token, body, pnAccount.badgeCounter, { title, body, metadata }, 'channels')
      }

      if (pnAccount.provider === 'android') {
        return sendFirebasePN(pnAccount.token, title, body, metadata)
      }

      logger.error(`The PN record is malformed!: pnAccount.provider=${pnAccount.provider}`)
      // throw new Error(`Problem sending a PN: ${message}`);
    })
  },

  errorMessageHandler: (error) => {
    // TODO configure a better error handler for all kind og responses
    const message = _.get(error, 'response.data.data.errorDescription', 'Something went wrong, please try again later')
    console.log('Error message:', message)
    return { message, error: { message } }
  }
}
