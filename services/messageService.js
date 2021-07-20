import _ from 'lodash';
import { findNotificationInfoByAliasOrJupId } from './notificationService';

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
            let tokens = _.map(data, 'tokenList');
            tokens = _.flattenDeep(tokens);
            const payload = { title, channel };
            sendPushNotification(tokens, message, 0, payload, 'channels');
          }
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
          let tokens = _.map(data, 'tokenList');
          tokens = _.flattenDeep(tokens);
          const alert = `${senderAlias} invited you to the channel "${channelName}"`;
          const payload = { title: 'Invitation', isInvitation: true };
          const threeMinutesDelay = 180000;
          sendPushNotification(tokens, alert, 0, payload, 'channels', threeMinutesDelay);
        }
      })
      .catch((error) => {
        logger.error(error);
      });
  },
};
