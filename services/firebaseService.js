import {firebaseAdmin} from '../server';

/**
 *
 */
class FirebaseService {

    /**
     *
     * @param {} firebaseAdmin
     */
    constructor(firebaseAdmin) {
        this.firebaseAdmin = firebaseAdmin;
    }


    /**
     *
     * @param registrationToken
     * @param message
     * @param options
     * @returns {Object}
     */
    async sendPushNotification(registrationToken, message, options = null){
        if(!registrationToken){
            throw new Error('registration token is invalid')
        }

        // @TODO the message should check for a string or json object
        if(!message){
            throw new Error('Invalid message')
        }

        return this.firebaseAdmin.messaging().sendToDevice(registrationToken, message, options)
    }

    /**
     *
     * @param title
     * @param body
     * @param data
     * @returns {{notification: {title, body}, data: null}}
     */
    generateMessage(title, body, data = null) {
        if (!title) {
            throw new Error('invalid title');
        }

        if (!body) {
            throw new Error('invalid body');
        }

        return {
            data: data,
            notification: {
                title: title,
                body: body
            }
        }
    }

    /**
     *
     * @returns {{timeToLive: number, priority: string}}
     */
    generateOptions(){
        return {
            priority: "normal",
            timeToLive: 1200 //60 * 60 -- 1 min
        }
    }

}

module.exports.firebaseService = new FirebaseService(firebaseAdmin)
