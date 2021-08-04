const Notification = require('../services/pushNotificationTokenService');

module.exports = (app) => {
  app.post('/v1/api/pn_token', Notification.addTokenNotification);
  app.put('/v1/api/mute_channels', Notification.editMutedChannels);
  app.get('/v1/api/mute_channels/:alias', Notification.findMutedChannels);
  app.post('/v1/api/pn_badge_counter', Notification.setBadgePnCounter);
};
