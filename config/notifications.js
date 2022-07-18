//@TODO we need to refactor the code the handle situations when a PN doesnt go through.
// a solution could be that we use a MessageQueue to handle retries.

const { firebaseService } = require('../services/firebaseService')
const apn = require('apn')
const { APN_OPTIONS } = require('./apn')
const logger = require('../utils/logger')(module)
/**
 *
 * @param {string} token  It's a String containing the hex-encoded device token. Could be a string or array
 * @param {string} title
 * @param {string} message
 * @param {object} metadata
 * @return {Promise<void>}
 */
async function sendFirebasePN(token, title, message, metadata = null) {
  logger.verbose('###############################3')
  logger.verbose(`sendFirebasePN()`)
  if (!title) {
    throw new Error('title is not valid')
  }
  if (!message) {
    throw new Error('message is not valid')
  }
  const body = firebaseService.generateMessage(title, message, metadata)
  const options = firebaseService.generateOptions()
  return firebaseService.sendPushNotification(token, body, options) //async sendPushNotification(registrationToken, message, options = null){
}

/**
 *
 * @param title
 * @returns {{title}}
 */
function generateApplePayload(title) {
  return {
    title: title
  }
}

/**
 *
 * @param {string} token
 * @param {string} alertMessage
 * @param badgeCount
 * @param {{title,body,metadata}} payload
 * @param {string} category
 * @return {*}
 */
function sendApplePN(token, alertMessage, badgeCount, payload, category) {
  logger.verbose(`####  sendApplePN(tokens, alertMessage, badgeCount, payload, category)`)
  const apnProvider = new apn.Provider(APN_OPTIONS)
  const notification = new apn.Notification()
  // will expire in 24 hours from now
  notification.expiry = Math.floor(Date.now() / 1000) + 24 * 3600
  notification.badge = badgeCount
  notification.sound = 'ping.aiff'
  notification.alert = alertMessage
  notification.title = payload.title
  notification.payload = payload
  notification.topic = 'tech.gojupiter.metis' // BundleID. Application Name
  notification.category = `metis.category.${category || 'default'}`
  logger.verbose('  sending Apple PN.....')
  // setTimeout(async () => {
  return apnProvider
    .send(notification, token)
    .then((result) => {
      logger.debug(`${result}`)
      apnProvider.shutdown() // close all open connections when queue is fully drained.
    })
    .catch((error) => logger.error(`Error sending PN ${error}`))
  // }, delay);
}

module.exports = {
  sendFirebasePN,
  generateApplePayload,
  sendApplePN
}
