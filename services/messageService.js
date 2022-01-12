const logger = require('../utils/logger')(module);
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {messagesConfig} = require("../config/constants");
const {FeeManager} = require("./FeeManager");
const {jupiterTransactionMessageService} = require("./jupiterTransactionMessageService");
const {getPNTokensAndSendPushNotification} = require("../services/PushNotificationMessageService");
const metis = require("../config/metis");
const {refreshGravityAccountProperties} = require("../gravity/instantiateGravityAccountProperties");
const {chanService} = require("./chanService");
const {StatusCode} = require("../utils/statusCode");

const generateNewMessageRecordJson = (
    senderAccountProperties,
    message,
    messageType = 'message',
    replyMessage = null,
    replyRecipientAlias = null,
    replyRecipientAddress = null,
    attachmentObj = null,
    version = '1.0',
) => {

    if(!(senderAccountProperties instanceof GravityAccountProperties)){throw new Error('senderAccountProperties is invalid')}

    const createdDate = Date.now();
    return {
        messageType, // message, message-file, file, invitation, removed
        recordType: 'messageRecord',
        status: 'active',
        senderAlias: senderAccountProperties.getCurrentAliasNameOrNull(),
        senderAddress: senderAccountProperties.address,
        message,
        replyMessage,
        replyRecipientAlias,
        replyRecipientAddress,
        attachmentObj,
        createdAt: createdDate,
        updatedAt: createdDate,
        version,
    };
};

/**
 *
 * @param fromAccountProperties
 * @param toAccountProperties
 * @param message
 * @param type
 * @param replyMessage
 * @param replyRecipientAlias
 * @param replyRecipientAddress
 * @param attachmentUrl
 * @param version
 * @return {Promise<{signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}>}
 */
const createMessageRecord = async (fromAccountProperties, toAccountProperties, message, type, replyMessage, replyRecipientAlias, replyRecipientAddress,attachmentUrl,version) => {
    try{
        const messageRecord = generateNewMessageRecordJson(
            fromAccountProperties,
            message,
            type,
            replyMessage,
            replyRecipientAlias,
            replyRecipientAddress,
            attachmentUrl,
            version,
        );
        const messageRecordString = JSON.stringify(messageRecord);
        const tag = messagesConfig.messageRecord;
        const feeType = FeeManager.feeTypes.account_record;
        return jupiterTransactionMessageService.sendTaggedAndEncipheredMetisMessage(
            fromAccountProperties.passphrase,
            toAccountProperties.address,
            messageRecordString,
            tag,
            feeType,
            toAccountProperties.publicKey
        );
    }catch(error){
        logger.error('Error creating messageRecord:')
        logger.error(`${error}`);
        throw error
    }
}

/**
 *
 * @param memberAccountProperties
 * @param channelAccountProperties
 * @param messageRecord
 * @return {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
 */
// const sendMetisMessage = async (memberAccountProperties, channelAccountProperties, messageRecord) => {
//     const messageRecordString = JSON.stringify(messageRecord);
//     const tag = messagesConfig.messageRecord;
//     const feeType = FeeManager.feeTypes.account_record;
//     if(channelAccountProperties.isMinimumProperties){
//         await refreshGravityAccountProperties(channelAccountProperties);
//     }
//
//     return jupiterTransactionMessageService.sendTaggedAndEncipheredMetisMessage(
//         memberAccountProperties.passphrase,
//         channelAccountProperties.address,
//         messageRecordString,
//         tag,
//         feeType,
//         channelAccountProperties.publicKey
//     );
//
// };

const sendMessagePushNotifications = async (memberAccountProperties, channelAccountProperties, mentions) => {
    logger.verbose(`#### sendMessagePushNotification()`);
    if(!(memberAccountProperties instanceof GravityAccountProperties)){throw new Error('Invalid memberAccountProperties')}
    if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('Invalid channelAccountProperties')}
    const senderAlias = memberAccountProperties.getCurrentAliasNameOrNull();
    const {channelName, address: channelAddress} = channelAccountProperties;
    if(channelAccountProperties.isMinimumProperties){
        await refreshGravityAccountProperties(channelAccountProperties);
    }
    const {memberProfilePicture} = await metis.getMember({
        channel: channelAccountProperties.address,
        account: channelAccountProperties.publicKey,
        password: channelAccountProperties.password,
    });
    let members = memberProfilePicture.map(member => member.accountRS);
    members = members.filter(member => member !== memberAccountProperties.address);
    if (Array.isArray(members) && members.length > 0) {
        const pnBody = `${senderAlias} has sent a message`;
        const pnTitle = `${senderAlias}`;
        await getPNTokensAndSendPushNotification(members, [channelAddress], pnBody, pnTitle, {channelAddress});
    }
    //TODO get channel name from channel account properties
    if (Array.isArray(mentions) && mentions.length > 0){
        // Push notification for mentioned members
        const pnmBody = `${senderAlias} was tagged`;
        const pnmTitle = `${senderAlias} has tagged`;
        getPNTokensAndSendPushNotification(mentions, [channelAddress], pnmBody, pnmTitle, {channelAddress});
    }
}


module.exports = { generateNewMessageRecordJson, sendMessagePushNotifications, createMessageRecord };
