var admin = require("firebase-admin");

var serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

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
    const users = notification.payload.title.split('@');
    var data;
    if(notification.payload && notification.payload.channel){
        data = {
            channelId: notification.payload.channel.id,
            channelDate: ''+notification.payload.channel.date,
            channelToken: notification.payload.channel.token,
            channelKey: ''+notification.payload.channel.key,
            channelName: notification.payload.channel.name,
        }
    }
    var message = {
        data:data,
        notification: {
            title: 'Metis',
            body: users[0] + ' has sent a message to channel ' + users[1],
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