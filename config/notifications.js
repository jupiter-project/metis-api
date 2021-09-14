import { firebaseService } from '../services/firebaseService';
const apn = require('apn');
const { APN_OPTIONS } = require('./apn');
const logger = require('../utils/logger')(module);
/**
 * Sends a push notification to devices
 * @param tokens It's a String containing the hex-encoded device token. Could be a string or array
 * @param alert Message or NotificationAlertOptions to be displayed on device
 * @param badgeCount Integer of updated badge count
 * @param payload Extra data
 * @param category Used to identify push on device
 * @param delay delay on milliseconds for push notification
 * @returns {Promise}
 */
function sendPushNotification(tokens, alert, badgeCount, payload, category, delay = 1) {
  logger.info('[Notifications][sendPushNotification] -> Start');

  const apnProvider = new apn.Provider(APN_OPTIONS);
  const notification = new apn.Notification();

  // will expire in 24 hours from now
  notification.expiry = Math.floor(Date.now() / 1000) + 24 * 3600;
  notification.badge = badgeCount;
  notification.sound = 'ping.aiff';
  notification.alert = alert;
  notification.title = payload.title;
  notification.payload = payload;
  notification.topic = 'tech.gojupiter.metis';


  notification.category = `metis.category.${category || 'default'}`;
  console.log('-------------------------------------------------------------sending push.....', tokens, notification);
  setTimeout(async () => {
    // Send the actual notification
    const result = await apnProvider.send(notification, tokens);
    // shou down the provider after sending the push notification
    apnProvider.shutdown();
    // Show the result of the send operation:
    logger.info(JSON.stringify(result));
  }, delay);
  setTimeout(async () => {
    // Send the actual notification

    //@TODO payload.title needs to be refactored! why do we have userName@channelName?????
    const title = notification.payload.title;

    if(!title){
      throw new Error('title is not valid');
    }

    const body = notification.payload.message;

    if(!body){
      throw new Error('body is not valid');
    }

    if(!(notification.payload && notification.payload.metadata)){
      throw new Error(' notification object is not properly formed')
    }

    const data = notification.payload.metadata

    const message = firebaseService.generateMessage(title, body, data);
    const options = firebaseService.generateOptions();
    await firebaseService.sendPushNotification(tokens, message, options) //async sendPushNotification(registrationToken, message, options = null){

  }, delay);
}

module.exports = {
  sendPushNotification,
};
