import _ from 'lodash';
import {findNotifications, incrementBadgeCounter} from './notificationService';
import {BadJupiterAddressError} from "../errors/metisError";

const gu = require('../utils/gravityUtils');
const logger = require('../utils/logger')(module);
const { sendFirebasePN, sendApplePN } = require('../config/notifications');


/**
 *
 * @param notificationsCollection
 * @return {Promise<unknown[]|*[]>}
 */
const incrementBadgeCountersForNotifications = async (notificationsCollection) => {
  if (!gu.isNonEmptyArray(notificationsCollection)) { return [] }
  const promises = [];
  notificationsCollection.forEach(notification => {
    promises.push(incrementBadgeCounter({ _id: notification._id }))
  });
  const updatedNotificationsCollection = await Promise.all(promises);

  return updatedNotificationsCollection;
}

/**
 *
 * @param notificationsCollection
 * @return {*}
 */
const extractPNAccountsFromCollection = (notificationsCollection) => {
  logger.sensitive(`#### extractPNAccountsFromCollection = (notificationsCollection)`);
  if(!Array.isArray(notificationsCollection)){throw new Error(`notificationsCollection is not an array`)}
  if(notificationsCollection.length === 0 ){return []}

  console.log(`\n\n\n`);
  console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log(`notificationsCollection: `, notificationsCollection);
  console.log(`=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n\n\n`)
  const pnAccountsArrayOfArrays = notificationsCollection.map(notificationDocument => notificationDocument.pnAccounts);

  console.log(`\n\n\n`);
  console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log(`pnAccountsArrayOfArrays: `, pnAccountsArrayOfArrays);
  console.log(`=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n\n\n`)

  // if(pnAccountsArrayOfArrays.length === 0 ){return []}

  let pnAccounts = [];
  pnAccountsArrayOfArrays.forEach(_pnAccounts => {
    pnAccounts = [...pnAccounts, ..._pnAccounts]
  })

  console.log(`\n\n\n`);
  console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log(`pnAccounts: `, pnAccounts);
  console.log(`=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n\n\n`)

  return pnAccounts;
}

/**
 *
 * @param text
 * @return {*[]}
 */
const getMessageMentions = (text) => {
  if (text) {
    const reg = /@\w+/gim;
    const mentions = text.match(reg) || [];
    if (mentions && Array.isArray(mentions)) {
      return mentions.map(mention => mention.replace('@', ''));
    }
  }
  return [];
}

module.exports = {

  /**
   *
   * @param senderAlias
   * @param userAddress
   * @param channelName
   */
  // getPNTokenAndSendInviteNotification: async (senderAlias, userAddress, channelName) => {
  //   logger.sensitive(`#### getPNTokenAndSendInviteNotification: (senderAlias=${senderAlias}, userAddress=${userAddress}, channelName=${channelName})`);
  //   if(!gu.isWellFormedJupiterAddress(userAddress)){throw new BadJupiterAddressError(userAddress)};
  //   if(!gu.isWellFormedJupiterAlias(senderAlias)){throw new Error(`senderAlias is not valid: ${senderAlias}`)};
  //   if(!channelName){throw new Error(`channelName is empty`)};
  //
  //   const notificationsCollection = await findNotificationsByAddress(userAddress);
  //   // Do nothing if Nulls
  //   if(!gu.isNonEmptyArray(notificationsCollection)){ return }
  //   const updatedNotificationsCollection = await incrementBadgeCountersForNotifications(notificationsCollection);
  //   // Do nothing if Nulls
  //   if(!gu.isNonEmptyArray(updatedNotificationsCollection)) { return }
  //   const alert = `${senderAlias} invited you to the channel "${channelName}"`;
  //   const threeMinutesDelay = 180000;
  //   updatedNotificationsCollection.forEach( notification => {
  //     sendPushNotification(
  //         notification.tokenList,
  //         alert,
  //         notification.badgeCounter,
  //         { title: 'Invitation', isInvitation: true },
  //         'channels',
  //         threeMinutesDelay)
  //   } )
  // },

  /**
   *
   * @param recipientAddresses
   * @param senderAlias
   * @param mutedChannelAddressesToExclude
   * @param message
   * @param title
   * @param metadata
   */
  getPNTokensAndSendPushNotification: async (recipientAddresses, mutedChannelAddressesToExclude, message, title, metadata) => {
    logger.sensitive(`#### getPNTokensAndSendPushNotification: (recipientAddressArray=${recipientAddresses}, mutedChannelsToExclude=${mutedChannelAddressesToExclude})`);
    // if(!gu.isWellFormedJupiterAlias(senderAlias)){throw new Error(`senderAlias is not valid: ${senderAlias}`)};
     if(!Array.isArray(mutedChannelAddressesToExclude)){throw new Error(`mutedChannelsToExclude is not an Array`)}
    mutedChannelAddressesToExclude.forEach(mutedChannelAddress => {
      if(!gu.isWellFormedJupiterAddress(mutedChannelAddress)){throw new BadJupiterAddressError(mutedChannelAddress)}
    })
    if(!message){throw new Error(`message is empty`)}
    if(!title){throw new Error(`title is empty`)}
    // If not recipientAddress then just return. Do nothing.
    if(!gu.isNonEmptyArray(recipientAddresses)){return}
    recipientAddresses.forEach(recipientAddress => {
      if(!gu.isWellFormedJupiterAddress(recipientAddress)){throw new BadJupiterAddressError(recipientAddress)};
    })

    const notificationsCollection = await findNotifications(recipientAddresses, mutedChannelAddressesToExclude);
    const updatedNotificationsCollection = await incrementBadgeCountersForNotifications(notificationsCollection);
    const pnAccounts = extractPNAccountsFromCollection(updatedNotificationsCollection);
    pnAccounts.forEach(pnAccount => {
      if (pnAccount.provider === 'ios'){
        return sendApplePN(
            pnAccount.token,
            message,
            pnAccount.badgeCounter,
            {title, message, metadata},
            'channels');
      }

      if (pnAccount.provider === 'android'){
        return sendFirebasePN(
            pnAccount.token,
            title,
            message,
            metadata
        )}

      throw new Error(`Problem sending a PN: ${message}`);

    })
  },

  errorMessageHandler: (error) => {
    //TODO configure a better error handler for all kind og responses
    const message =  _.get(error, 'response.data.data.errorDescription', 'Something went wrong, please try again later');
    console.log('Error message:', message);
    return { message, error: { message } };
  }
};
