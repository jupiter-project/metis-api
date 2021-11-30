import _ from 'lodash';
import { findNotificationsByAddressList, findNotificationAndUpdate, incrementBadgeCounter } from './notificationService';

const logger = require('../utils/logger')(module);
const { sendFirebasePN, sendApplePN } = require('../config/notifications');


module.exports = {
  getMessageMentions: (text) => {
    if (text) {
      const reg = /@\w+/gim;
      const mentions = text.match(reg) || [];
      if (mentions && Array.isArray(mentions)) {
        return mentions.map(mention => mention.replace('@', ''));
      }
    }
    return [];
  },
  getPNTokensAndSendPushNotification: (recipientAddressArray, senderAlias, channel, message, title, metadata) => {
    if (recipientAddressArray && Array.isArray(recipientAddressArray) && !_.isEmpty(recipientAddressArray)) {
      const channelId = channel && channel.id ? channel.id : null;
      findNotificationsByAddressList(recipientAddressArray, channelId)
        .then((notifications) => {

          if (!_.isEmpty(notifications)) {

            const promises = [];

            notifications.forEach(notification => {
              promises.push(incrementBadgeCounter({ _id: notification._id }))
            });

            return Promise.all(promises);
          }
          return null;
        })
        .then((notifications) => {
          const payload = { title, message, metadata };
          if (notifications && Array.isArray(notifications) && !_.isEmpty(notifications)) {

            const tokensAndBadge = [];
            notifications.map(notification => {
              _.map(notification.pnAccounts, account => {

                tokensAndBadge.push(({ token: account.token, badge: account.badgeCounter, provider: account.provider }));

              });
            });

            return { tokensAndBadge, payload };
          }
          return { tokensAndBadge: [], payload };
        })
        .then(({ tokensAndBadge, payload }) => {
          tokensAndBadge.map(tb => {
            if (tb.provider === 'ios'){
              sendApplePN(tb.token, message, tb.badge, payload, 'channels');
            } else {
              sendFirebasePN(tb.token, title, message, metadata);
            }
          });
        })
        .catch((error) => {
          logger.error(JSON.stringify(error));
        });
    }
  },

  getPNTokenAndSendInviteNotification: (senderAlias, userAddress, channelName) => {
    findNotificationsByAddressList([userAddress])
      .then((data) => {
        if (data && Array.isArray(data) && !_.isEmpty(data)) {
          const notificationIds = _.map(data, '_id');
          const updateData = { $inc: { badgeCounter: 1 } };
          // eslint-disable-next-line max-len
          const badgeCounters = notificationIds.map(notificationId => findNotificationAndUpdate({ _id: notificationId }, updateData));
          return Promise.all(badgeCounters);
        }
        return null;
      })
      .then((data) => {
        if (data && Array.isArray(data) && !_.isEmpty(data)) {
          const alert = `${senderAlias} invited you to the channel "${channelName}"`;
          const payload = { title: 'Invitation', isInvitation: true };
          const threeMinutesDelay = 180000;
          const tokensAndBadge = data.map(item => ({ token: item.tokenList, badge: item.badgeCounter }));



          tokensAndBadge.map(tb => sendPushNotification(tb.token, alert, tb.badge, payload, 'channels', threeMinutesDelay));



        }
      })
      .catch((error) => {
        logger.error(`${error}`);
      });
  },
  errorMessageHandler: (error) => {
    //TODO configure a better error handler for all kind og responses
    const message =  _.get(error, 'response.data.data.errorDescription', 'Something went wrong, please try again later');
    console.log('Error message:', message);
    return { message, error: { message } };
  }
};
