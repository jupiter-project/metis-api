const logger = require('../utils/logger')(module);
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {messagesConfig} = require("../config/constants");
const {FeeManager} = require("./FeeManager");
const {jupiterTransactionMessageService} = require("./jupiterTransactionMessageService");
const {getPNTokensAndSendPushNotification} = require("../services/PushNotificationMessageService");
const metis = require("../config/metis");
const {refreshGravityAccountProperties} = require("../gravity/instantiateGravityAccountProperties");

const generateNewMessageRecordJson = (
    senderAccountProperties,
    message,
    type = 'message',
    replyMessage = null,
    replyRecipientAlias = null,
    replyRecipientAddress = null,
    attachmentObj = null,
    version = '1.0',
) => {

    if(!(senderAccountProperties instanceof GravityAccountProperties)){throw new Error('senderAccountProperties is invalid')}

    const createdDate = Date.now();
    return {
        recordType: 'messageRecord',
        status: 'active',
        senderAlias: senderAccountProperties.getCurrentAliasNameOrNull(),
        senderAddress: senderAccountProperties.address,
        message,
        replyMessage,
        replyRecipientAlias,
        replyRecipientAddress,
        type, // message, invitation, attachment, removed
        attachmentObj,
        createdAt: createdDate,
        updatedAt: createdDate,
        version,
    };
};


const sendMetisMessage = async (memberAccountProperties, channelAccountProperties, messageRecord) => {
    const messageRecordString = JSON.stringify(messageRecord);
    const tag = messagesConfig.messageRecord;
    const feeType = FeeManager.feeTypes.account_record;
    if(channelAccountProperties.isMinimumProperties){
        await refreshGravityAccountProperties(channelAccountProperties);
    }

    return jupiterTransactionMessageService.sendTaggedAndEncipheredMetisMessage(
        memberAccountProperties.passphrase,
        channelAccountProperties.address,
        messageRecordString,
        tag,
        feeType,
        channelAccountProperties.publicKey
    );

};

const sendMessagePushNotifications = async (memberAccountProperties, channelAccountProperties, mentions) => {
    logger.sensitive(`#### sendMessagePushNotification()`);
    if(!memberAccountProperties instanceof GravityAccountProperties){throw new Error('Invalid memberAccountProperties')}
    if(!channelAccountProperties instanceof GravityAccountProperties){throw new Error('Invalid channelAccountProperties')}
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


module.exports = { generateNewMessageRecordJson, sendMetisMessage, sendMessagePushNotifications };
