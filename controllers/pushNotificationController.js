const Notification = require('../services/pushNotificationTokenService');

module.exports = (app) => {
  app.post('/v1/api/pn/token', Notification.addTokenNotification);
  app.put('/v1/api/pn/mute_channels', Notification.editMutedChannels);
  app.get('/v1/api/pn/mute_channels/:alias', Notification.findMutedChannels);
  app.post('/v1/api/pn/badge_counter', Notification.setBadgePnCounter);
};
