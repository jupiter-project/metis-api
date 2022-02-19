import {chanService} from "./chanService";

const logger = require('../utils/logger')(module);
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {messagesConfig} = require("../config/constants");
const {FeeManager} = require("./FeeManager");
const {jupiterTransactionMessageService} = require("./jupiterTransactionMessageService");
const {getPNTokensAndSendPushNotification} = require("../services/PushNotificationMessageService");
import mError from "../errors/metisError";
import {metisConstants} from "../src/metis/constants/constants";
const gu = require("../utils/gravityUtils")

/**
 *
 * @param {GravityAccountProperties} senderAccountProperties
 * @param {string} message
 * @param {string} messageType
 * @param {string|null} replyMessage
 * @param {string|null} replyRecipientAlias
 * @param {string|null} replyRecipientAddress
 * @param {object|null} attachmentObj
 * @param {string} version
 * @return {{senderAddress: string, recordType: string, replyRecipientAddress: null, replyRecipientAlias: null, senderAlias: (string|null), message, version: string, createdAt: number, messageType: string, replyMessage: null, attachmentObj: null, status: string, updatedAt: number}}
 */
const generateNewMessageRecordJson = (
    senderAccountProperties,
    message,
    messageType = metisConstants.messageRecord.type.message,
    replyMessage = null,
    replyRecipientAlias = null,
    replyRecipientAddress = null,
    attachmentObj = null,
    version = '1.0',
) => {
    if(!(senderAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`senderAccountProperties`);
    if(!message) throw new mError.MetisError(`message cannot be empty`);
    if(!messageType) throw new mError.MetisError(`messageType cannot be empty`);
    const createdDate = Date.now();
    return {
        messageType, // message, message-file, file, invitation, removed
        recordType: metisConstants.recordTypes.messageRecord,
        status: metisConstants.messageRecord.status.active,
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
 * @param {GravityAccountProperties} fromAccountProperties
 * @param {GravityAccountProperties} toAccountProperties
 * @param {string} message
 * @param messageType
 * @param replyMessage
 * @param replyRecipientAlias
 * @param replyRecipientAddress
 * @param attachmentUrl
 * @param version
 * @return {Promise<{signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}>}
 */
const sendChatMessage = async (fromAccountProperties,
                               toAccountProperties,
                               message,
                               messageType,
                               replyMessage,
                               replyRecipientAlias,
                               replyRecipientAddress,
                               attachmentUrl,
                               version) => {
    try{
        const messageRecord = generateNewMessageRecordJson(
            fromAccountProperties,
            message,
            messageType,
            replyMessage,
            replyRecipientAlias,
            replyRecipientAddress,
            attachmentUrl,
            version,
        );
        const messageRecordString = JSON.stringify(messageRecord);
        const tag = messagesConfig.messageRecord;
        const feeType = FeeManager.feeTypes.metisMessage;
        return jupiterTransactionMessageService.sendTaggedAndEncipheredMetisMessage(
            fromAccountProperties.passphrase,
            toAccountProperties.address,
            messageRecordString,
            tag,
            feeType,
            toAccountProperties.publicKey
        );
    } catch(error) {
        console.log('\n')
        logger.error(`************************* ERROR ***************************************`);
        logger.error(`* ** sendMessage.catch(error)`);
        logger.error(`************************* ERROR ***************************************\n`);
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

/**
 *
 * @param {object} senderAccountProperties
 * @param {object} channelAccountProperties
 * @param {string[]} mentions
 * @return {Promise<void>}
 */
const sendMessagePushNotifications = async (senderAccountProperties, channelAccountProperties, mentions = []) => {
    logger.verbose(`#### sendMessagePushNotifications(memberAccountProperties, channelAccountProperties, mention)`);
    try {
        if (!(senderAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadJupiterAddress('Invalid memberAccountProperties')
        if (!(channelAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadJupiterAddress('Invalid channelAccountProperties')
        if(!Array.isArray(mentions)) throw new mError.MetisError(`mentions needs to be an array`);



        mentions.forEach(mentionedMemberAddress => {
            if(!gu.isWellFormedJupiterAddress(mentionedMemberAddress)) throw new mError.MetisErrorBadJupiterAddress('', mentionedMemberAddress);
        })
        const senderAlias = senderAccountProperties.getCurrentAliasNameOrNull();
        const {address: channelAddress} = channelAccountProperties;
        const allChannelMembers = await chanService.getChannelMembers(channelAccountProperties)
        const channelMembersExceptOne = allChannelMembers.filter( member => member.memberAccountAddress !== senderAccountProperties.address );
        const channelMemberAddresses = channelMembersExceptOne.map(member => member.memberAccountAddress);
        const pnBody = (senderAlias)?
            `${senderAlias} has sent a message`:
            `${senderAccountProperties.address} has sent a message`;
        const pnTitle = (senderAlias) ?
            `${senderAlias}`:
            `${senderAccountProperties.address}`;
        await getPNTokensAndSendPushNotification(channelMemberAddresses, [channelAccountProperties.address], pnBody, pnTitle, {channelAddress: channelAccountProperties.address});
        const promises = mentions.map( (mentionedMemberAddress) => {
            const body = (senderAlias)?
                `${senderAlias} was tagged`:
                `${senderAccountProperties.address} was tagged`;
            const title = (senderAlias) ?
                `${senderAlias} was tagged`:
                `${senderAccountProperties.address} was tagged`;
            return getPNTokensAndSendPushNotification(mentionedMemberAddress, [channelAccountProperties.address], body, title, {channelAddress});
        })

        //
        // // if (channelAccountProperties.isMinimumProperties) {
        // //     await refreshGravityAccountProperties(channelAccountProperties);
        // // }
        // const {memberProfilePicture} = await metis.getMember({
        //     channel: channelAccountProperties.address,
        //     account: channelAccountProperties.publicKey,
        //     password: channelAccountProperties.password,
        // });
        // let members = memberProfilePicture.map(member => member.accountRS);
        // members = members.filter(member => member !== memberAccountProperties.address);
        // if (Array.isArray(members) && members.length > 0) {
        //     const pnBody = `${senderAlias} has sent a message`;
        //     const pnTitle = `${senderAlias}`;
        //     await getPNTokensAndSendPushNotification(members, [channelAddress], pnBody, pnTitle, {channelAddress});
        // }
        // //TODO get channel name from channel account properties
        // if (Array.isArray(memberAddressMentions) && memberAddressMentions.length > 0) {
        //     // Push notification for mentioned members
        //     const pnmBody = `${senderAlias} was tagged`;
        //     const pnmTitle = `${senderAlias} has tagged`;
        //     await getPNTokensAndSendPushNotification(memberAddressMentions, [channelAddress], pnmBody, pnmTitle, {channelAddress});
        // }
    }catch(error){
        console.log('\n')
        logger.error(`************************* ERROR ***************************************`);
        logger.error(`* ** sendMessagePushNotifications(memberAccountProperties, channelAccountProperties, mentions).catch(error)`);
        logger.error(`************************* ERROR ***************************************\n`);
        logger.error(`error= ${error}`)
        throw new mError.MetisErrorPushNotificationFailed(`${error.message}`);
    }
}

module.exports = { generateNewMessageRecordJson, sendMessagePushNotifications, sendChatMessage };
