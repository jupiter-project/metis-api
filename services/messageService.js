import _ from 'lodash';
import { findNotificationInfoByAliasOrJupId, findNotificationAndUpdate } from './notificationService';

const logger = require('../utils/logger')(module);
const { sendPushNotification } = require('../config/notifications');


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
  getPNTokensAndSendPushNotification: (members, senderAlias, channel, message, title) => {
    if (members && Array.isArray(members) && !_.isEmpty(members)) {
      findNotificationInfoByAliasOrJupId(members, channel.id)
        .then((data) => {
          if (data && Array.isArray(data) && !_.isEmpty(data)) {
            const notificationIds = _.map(data, '_id');
            const updateData = { $inc: { badgeCounter: 1 } };
            // eslint-disable-next-line max-len
            const badgeCounters = notificationIds.map(notificationId => findNotificationAndUpdate({ _id: { $in: notificationId } }, updateData));
            return Promise.all(badgeCounters);
          }
          return null;
        })
        .then((data) => {
          const payload = { title, channel };
          if (data && Array.isArray(data) && !_.isEmpty(data)) {
            // eslint-disable-next-line max-len
            const tokensAndBadge = data.map(item => ({ token: item.tokenList, badge: item.badgeCounter }));
            return { tokensAndBadge, payload };
          }
          return { tokensAndBadge: [], payload };
        })
        .then(({ tokensAndBadge, payload }) => {
          tokensAndBadge.map(tb => sendPushNotification(tb.token, message, tb.badge, payload, 'channels'));
        })
        .catch((error) => {
          logger.error(JSON.stringify(error));
        });
    }
  },
  getPNTokenAndSendInviteNotification: (senderAlias, recipientAliasOrJupId, channelName) => {
    findNotificationInfoByAliasOrJupId([recipientAliasOrJupId])
      .then((data) => {
        if (data && Array.isArray(data) && !_.isEmpty(data)) {
          const notificationIds = _.map(data, '_id');
          const updateData = { $inc: { badgeCounter: 1 } };
          // eslint-disable-next-line max-len
          const badgeCounters = notificationIds.map(notificationId => findNotificationAndUpdate({ _id: { $in: notificationId } }, updateData));
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
        logger.error(error);
      });
  },
};
