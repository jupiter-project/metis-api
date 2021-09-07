var admin = require("firebase-admin");

var serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const sendPushNotification = (registrationToken, message, options, res) => {
    admin.messaging().sendToDevice(registrationToken, message, options)
        .then(response => {
            res.status(200).send("Notification sent successfully");
        })
        .catch(error => {
            console.log(error);
            res.status(500).send(error);
        });
}

const sendPushNotificationMessage = (registrationTokens, notification) => {
    var message = {
        notification: {
            title: notification.title,
            body: notification.payload,
        }
      };
      var options = {
        priority: "normal",
        timeToLive: 60 * 60
      };

    admin.messaging().sendToDevice(registrationTokens, message, options)
        .then(response => {
            console.log(response);
        })
        .catch(error => {
            console.log('Error:', error);
        });
}

module.exports.admin = admin;
module.exports.sendPushNotification = sendPushNotification;
module.exports.sendPushNotificationMessage = sendPushNotificationMessage;