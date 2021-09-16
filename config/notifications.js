//@TODO we need to refactor the code the handle situations when a PN doesnt go through.
// a solution could be that we use a MessageQueue to handle retries.

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
async function sendFirebasePN(tokens, title, message, metadata=null, delay = 1){
  logger.verbose('###############################3')
  logger.verbose(`sendFirebasePN()`);
  if(!title){throw new Error('title is not valid');}
  if(!message){throw new Error('message is not valid');}
  // if(!metadata){throw new Error(' notification object is not properly formed')}

  setTimeout(async () => {
    // Send the actual notification
    const message = firebaseService.generateMessage(title, message, metadata);
    const options = firebaseService.generateOptions();
    return firebaseService.sendPushNotification(tokens, message, options) //async sendPushNotification(registrationToken, message, options = null){
  }, delay);
}

/**
 *
 * @param title
 * @returns {{title}}
 */
function generateApplePayload(title){
  return {
    title: title
  }
}

/**
 *
 * @param tokens
 * @param alertMessage
 * @param badgeCount
 * @param payload
 * @param category
 * @param delay
 */
async function sendApplePN(tokens, alertMessage, badgeCount, payload, category, delay = 1){
  logger.verbose('###############################3')
  logger.verbose(`sendAPN()`);

  const apnProvider = new apn.Provider(APN_OPTIONS);
  const notification = new apn.Notification();

  // will expire in 24 hours from now
  notification.expiry = Math.floor(Date.now() / 1000) + 24 * 3600;
  notification.badge = badgeCount;
  notification.sound = 'ping.aiff';
  notification.alert = alertMessage;
  notification.title = payload.title;
  notification.payload = payload;
  notification.topic = 'tech.gojupiter.metis'; // BundleID. Application Name
  notification.category = `metis.category.${category || 'default'}`;

  logger.verbose('  sending Apple PN.....');
  setTimeout(async () => {
    // Send the actual notification
    // const result = await apnProvider.send(notification, tokens);
    return apnProvider.send(notification, tokens)
        .then(result=>{
          logger.debug(JSON.stringify(result));
          apnProvider.shutdown(); // close all open connections when queue is fully drained.
        })
  }, delay);

}






module.exports = {
  sendFirebasePN,
  generateApplePayload,
  sendApplePN
};
