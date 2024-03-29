const Notification = require('../services/pushNotificationTokenService')

module.exports = (app) => {
  app.post('/v1/api/pn/token', Notification.addTokenNotification)
  app.delete('/v1/api/pn/token/:jupId/:provider/:token', Notification.deleteTokenPushNotification)
  app.put('/v1/api/pn/mute-channels', Notification.editMutedChannels)
  app.get('/v1/api/pn/mute-channels', Notification.findMutedChannels)
  app.post('/v1/api/pn/badge-counter', Notification.setBadgePnCounter)
}
