import _ from 'lodash';
import controller from '../config/controller';
import {gravity} from '../config/gravity';
import {jupiterAccountService} from "../services/jupiterAccountService";
import {chanService} from "../services/chanService";
import {
    instantiateGravityAccountProperties, instantiateMinimumGravityAccountProperties,
    refreshGravityAccountProperties
} from "../gravity/instantiateGravityAccountProperties";
import {jupiterTransactionsService} from "../services/jupiterTransactionsService";
import {jupiterAPIService} from "../services/jupiterAPIService";


import {generateNewMessageRecordJson, sendMessagePushNotifications, createMessageRecord} from "../services/messageService";
const mError = require("../errors/metisError");
import {StatusCode} from "../utils/statusCode";
import {messagesConfig} from "../config/constants";
import {MetisErrorCode} from "../utils/metisErrorCode";

var moment = require('moment'); // require
const gu = require('../utils/gravityUtils');
const {v4: uuidv4} = require('uuid');
const connection = process.env.SOCKET_SERVER;
const logger = require('../utils/logger')(module);
const {getPNTokensAndSendPushNotification} = require('../services/PushNotificationMessageService');


module.exports = (app, passport, jobs, websocket) => {

    /**
     * Get List of Channels
     */
    app.get('/v1/api/channels', async (req, res) => {
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Get member Channels');
        logger.info('== GET: /v1/api/channels');
        logger.sensitive(`== req.user.passphrase: ${req.user.passphrase}`);
        logger.sensitive(`== req.user.password: ${req.user.password}`);
        logger.info('======================================================================================');
        console.log('');

        const memberAccountProperties = await instantiateGravityAccountProperties(
            req.user.passphrase,
            req.user.password
        )

        const allMemberChannels = await chanService.getMemberChannels(memberAccountProperties);

        const listOfChannels = allMemberChannels.reduce((reduced, channelAccountProperties) => {
            reduced.push({
                channelAddress: channelAccountProperties.address,
                channelName: channelAccountProperties.channelName
            });
            return reduced;
        }, [])

        res.send(listOfChannels);

        console.log('');
        logger.info('^======================================================================================^');
        logger.info('^ Get member Channels');
        logger.info('^ GET: /v1/api/channels');
    })

    /**
     * Video Conference
     */
    app.post('/v1/api/channels/call', async (req, res) => {  //@TODO what is this used for?
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Video Conference');
        logger.info('== POST: v1/api/channels/call');
        logger.info('======================================================================================');
        console.log('');


        const {data} = req.body;
        const {user} = req;
        try {
            const senderAlias = user.userData.alias;
            let recipientAddress = _.get(data, 'recipient', '');

            if (!recipientAddress.toLowerCase().includes('jup-')) {
                const aliasResponse = await gravity.getAlias(recipientAddress);
                recipientAddress = aliasResponse.accountRS;
            }

            const message = `${senderAlias} is inviting you to a video call`;
            const url = `metis/${uuidv4()}`;
            const metadata = {isCall: 'true', url: url, recipient: recipientAddress, sender: senderAlias};
            getPNTokensAndSendPushNotification([recipientAddress], senderAlias, {}, message, 'call', metadata);
            res.send({success: true, url: url});
        } catch (e) {
            logger.error(e);
            res.status(500).send(`${e}`);
        }
    });

    /**
     * Accept channel invite
     */
    app.post('/v1/api/channel/invite/accept', async (req, res) => {
        console.log(`\n\n`)
        logger.info('======================================================================================');
        logger.info('== Accept Channel Invite');
        logger.info('== v1/api/channel/invite/accept');
        logger.info(`======================================================================================\n\n`);

        const {channelAddress} = req.body

        if(!gu.isWellFormedJupiterAddress(channelAddress)) throw new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)
        // if(!gu.isWellFormedJupiterAddress(channelAddress)){throw new BadJupiterAddressError(channelAddress)}

        // if (!gu.isWellFormedJupiterAddress(channelAddress)) {
        //     throw new BadJupiterAddressError(channelAddress)
        // }

        const memberAccountProperties = await instantiateGravityAccountProperties(
            req.user.passphrase,
            req.user.password
        );

        chanService.acceptInvitation(memberAccountProperties, channelAddress)
            .then(() => {
                websocket.of('/chat').to(channelAddress).emit('newMemberChannel');
                res.status(StatusCode.SuccessOK).send({message: 'Invite accepted'});
            })
            .catch(error => {
                logger.error(`*********************************************`)
                logger.error(`** channel/invite/accept ERROR`)
                logger.error(`${error}`);
                if (error.message === 'Invitation Not Found') {
                    return res.status(404).send({message: error.message});
                }
                return res.status(StatusCode.ServerErrorInternal).send({message: error.message});
            });

    });

    /**
     * Render a channel's conversations
     */
    app.get('/channels/:id', controller.isLoggedIn, (req, res) => {
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Render a channel conversations');
        logger.info('== GET: channels/:id');
        logger.info('======================================================================================');
        console.log('');

        const messages = req.session.flash;
        req.session.flash = null;

        const PageFile = require('../views/convos.jsx');

        const page = ReactDOMServer.renderToString(
            React.createElement(PageFile, {
                connection,
                messages,
                name: `Metis - Convo#${req.params.id}`,
                user: req.user,
                dashboard: true,
                public_key: req.session.public_key,
                validation: req.session.jup_key,
                accessData: req.session.accessData,
                channelId: req.params.id,
            }),
        );

        res.send(page);
    });

    /**
     * Get a channel's messages
     */
    app.get('/v1/api/data/messages', async (req, res) => {
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Get a channel\'s messages');
        logger.info('== GET: /v1/api/data/messages/:firstIndex');
        logger.info('======================================================================================\n');
        const { user } = req;
        // pageNumber starts at Page 0;
        const { channelAddress, pageNumber: _pageNumber, pageSize: _pageSize } = req.query

        if (!channelAddress) {
            return res.status(StatusCode.ClientErrorBadRequest).send({message: 'channelAddress is required'});
        }
        if (!gu.isWellFormedJupiterAddress(channelAddress)) {
            return res.status(StatusCode.ClientErrorBadRequest).send({message: `bad channel address: ${channelAddress}`})
        }

        if(isNaN(_pageNumber)){
            return res.status(StatusCode.ClientErrorBadRequest).send({message: 'pageNumber needs to be an integer'});
        }
        if (isNaN(_pageSize)) {
            return res.status(StatusCode.ClientErrorBadRequest).send({message: 'pageSize needs to be an integer'});
        }
        const pageNumber = parseInt(_pageNumber);
        const pageSize = parseInt(_pageSize);

        if(!(pageSize > 0 && pageSize < 1000)){
            return res.status(StatusCode.ClientErrorBadRequest).send({message: 'pageSize can only be between 1 and 1000'});
        }
        if(pageNumber < 0){
            return res.status(StatusCode.ClientErrorBadRequest).send({message: 'pageNumber needs to be more than 0'});
        }
        try{
            const firstIndex = pageNumber * pageSize
            const lastIndex = firstIndex + (pageSize - 1);
            const memberAccountProperties = instantiateMinimumGravityAccountProperties(user.passphrase, user.password, user.address);
            // const memberAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);
            const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(memberAccountProperties, channelAddress);

            if (!channelAccountProperties) {
                return res.status(StatusCode.ServerErrorInternal).send({message: `channel is not available: ${channelAddress}`})
            }

            //@TODO this will be a big problem when channel has alot of messages!!!!!!!
            const messageTransactions = await jupiterTransactionsService.getReadableTaggedMessageContainers(channelAccountProperties, messagesConfig.messageRecord, false, null, null);

            // Sorting messages descending
            messageTransactions.sort((a, b) =>
                new Date(b.message.createdAt) - new Date(a.message.createdAt)
            );

            const paginatesMessages = messageTransactions.slice(firstIndex, lastIndex + 1);

            res.send(paginatesMessages);
        } catch (error) {
            logger.error('Error getting messages:');
            logger.error(`${error}`);
            res.status(StatusCode.ServerErrorInternal).send({message: 'Error getting messages'})
        }
    });

    /**
     * Send a message
     */
    app.post('/v1/api/data/messages', async (req, res) => {
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Send a message');
        logger.info('== POST: /v1/api/data/messages');
        logger.info('======================================================================================');

        const {user} = req;
        const {
            message,
            address,
            replyMessage,
            replyRecipientAlias,
            replyRecipientAddress,
            attachmentUrl,
            version,
            mentions = [],
            type = 'message'
        } = req.body;

        if (!message || !address) {
            return res.status(StatusCode.ClientErrorBadRequest).send({message: 'Must include a valid message and address'});
        }

        const memberAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);

        try {
            const messageRecord = generateNewMessageRecordJson(
                memberAccountProperties,
                message,
                type,
                replyMessage,
                replyRecipientAlias,
                replyRecipientAddress,
                attachmentUrl,
                version,
            );

            if (type === 'invitation') {
                websocket.of('/chat').to(address).emit('newMemberChannel');
            }

            websocket.of('/chat').to(address).emit('createMessage', { message: messageRecord });
            const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(memberAccountProperties, address);
            if(!channelAccountProperties){
                return res.status(StatusCode.ClientErrorBadRequest).send({message: 'Invalid channel address.'})
            }
            // if(channelAccountProperties.isMinimumProperties){
            //     await refreshGravityAccountProperties(channelAccountProperties)
            // }
            await createMessageRecord(
                memberAccountProperties,
                channelAccountProperties,
                message,
                type,
                replyMessage,
                replyRecipientAlias,
                replyRecipientAddress,
                attachmentUrl,
                version
                )
            // await sendMetisMessage(memberAccountProperties, channelAccountProperties, messageRecord);
            // await sendMetisMessage(memberAccountProperties, channelAccountProperties, messageRecord);
            await sendMessagePushNotifications(memberAccountProperties, channelAccountProperties, mentions);
            res.send({message: 'Message successfully sent'});
        } catch (error) {
            logger.error('Error sending metis message:')
            logger.error(JSON.stringify(error));
            return res.status(500).send({message: 'Error sending message'})
        }
    });

    /**
     * Get a user's invites
     */
    app.get('/v1/api/channel/invites', async (req, res) => {
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Get user invites');
        logger.info('== GET: /v1/api/channel/invites');
        logger.info('======================================================================================');
        console.log('');

        try {
            const memberAccountProperties = await instantiateGravityAccountProperties(
                req.user.passphrase,
                req.user.password
            )
            await chanService.getChannelInvitationContainersSentToAccount(memberAccountProperties)
                .then(channelInvitations => {
                    const payload = channelInvitations.map(channelInvitationContainer => {

                        return {
                            invitationId: channelInvitationContainer.transactionId,
                            channelName: channelInvitationContainer.message.channelRecord.channelName,
                            channelAddress: channelInvitationContainer.message.channelRecord.address,
                            inviterAddress: channelInvitationContainer.message.inviterAddress,
                            invitationSentAt: channelInvitationContainer.message.createdAt
                        }
                    })
                    res.send(payload);
                })
        } catch(error) {
            console.log(error);
            res.status(StatusCode.ServerErrorInternal).send({message: `Internal Error`, code: error.code});
        }
    });

    /**
     * Send an invite
     */
    app.post('/v1/api/channel/invite', async (req, res) => {
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Send An Invite');
        logger.info('== POST: api/channel/invite');
        logger.info('======================================================================================');
        console.log('');
        const {channelAddress, inviteeAddressOrAlias} = req.body;
        const {user} = req;
        if(!gu.isWellFormedJupiterAddress(channelAddress)) {
            return res.status(StatusCode.ClientErrorBadRequest).send({message: `channelAddress is invalid`, code: MetisErrorCode.MetisErrorBadJupiterAddress});
        }
        try {
            const inviteeAccountInfo = await jupiterAccountService.fetchAccountInfoFromAliasOrAddress(inviteeAddressOrAlias);
            const inviteeAddress = inviteeAccountInfo.address;
            const inviteePublicKey = inviteeAccountInfo.publicKey;
            const inviterAccountProperties = user.gravityAccountProperties;
            // const inviterAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);
            const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(inviterAccountProperties, channelAddress);
            if(channelAccountProperties === null){
                return res.status(StatusCode.ClientErrorBadRequest).send({message: `channelAddress is invalid`, code: MetisErrorCode.MetisErrorBadJupiterAddress});
            }
            const newInvitation = await chanService.createInvitation(
                channelAccountProperties,
                inviterAccountProperties,
                inviteeAddress,
                inviteePublicKey
                )

            const inviterAlias = inviterAccountProperties.getCurrentAliasNameOrNull();
            const message = `${inviterAlias} invited you to join a channel`;
            const metadata = {isInvitation: 'true'};
            // getPNTokensAndSendPushNotification: async (recipientAddressArray, channelAddress, message, title, metadata) => {
            // getPNTokensAndSendPushNotification: async (recipientAddressArray, mutedChannelsToExclude, message, title, metadata) => {
            getPNTokensAndSendPushNotification(
                [inviteeAddress],
                [],
                message,
                'Invitation',
                metadata
            );

            // const createInvitationResponse = {
            //     invitationId: sendTaggedAndEncipheredMetisMessageResponse.data.transaction,
            //     channelAddress: channelAccountProperties.address,
            //     channelName: channelAccountProperties.channelName,
            //     inviteeAddressOrAlias: inviteeAddressOrAlias.address,
            // }

            res.status(StatusCode.SuccessOK).send(newInvitation);


                // .catch(error => {
                //     logger.error(`${error}`);
                //     res.sendStatus(500);
                // })
        } catch (error) {
            console.log(error);
            res.status(StatusCode.ServerErrorInternal).send({message: `Internal Error`, code: error.code});
        }

        const inviterAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);
        const channelAccountProperties = await jupiterAccountService.getChannelAccountPropertiesBelongingToMember(channelAddress, inviterAccountProperties);

        return chanService.createInvitation(
            channelAccountProperties,
            inviterAccountProperties,
            inviteeAddress)
            .then(response => {
                websocket.of('/invite').to(`${inviteeAddress}`).emit('newInvite');
                return response;
            })
            .then(response => {
                const inviterAlias = inviterAccountProperties.getCurrentAliasNameOrNull();
                const message = `${inviterAlias} invited you to join a channel`;
                const metadata = {isInvitation: 'true'};
                getPNTokensAndSendPushNotification(
                    [inviteeAddress],
                    [],
                    message,
                    'Invitation',
                    metadata
                );
                res.send(response);
            })
            .catch(error => {
                logger.error(`${error}`);
                res.sendStatus(500);
            })
    });


    /**
     * Create a Channel, assigned to the current user
     */
    app.post('/v1/api/channel', async (req, res, next) => {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== Create a Channel, assigned to the current user');
        logger.info('== app.post(\'/v1/api/channel\')(req,res,next)');
        logger.info(`======================================================================================\n\n\n`);
        const startTime = Date.now();
        const {channelName} = req.body;
        // const { userData: { alias, account } } = req.user;
        if (!channelName) {
            return res.status(StatusCode.ClientErrorBadRequest).send({message: 'Need channelName in body'})
        }
        const memberAccountProperties = await instantiateMinimumGravityAccountProperties(
            req.user.passphrase,
            req.user.password,
            req.user.address
            );
        const job = jobs.create('channel-creation-confirmation', {channelName, memberAccountProperties})
            .priority('high')
            .removeOnComplete(false)
            .save( error => {
                logger.verbose(`---- JobQueue: channel-creation-confirmation.save(error)`);
                logger.sensitive(`error= ${error}`);
                if (error) {
                    websocket.of('/channels').to(memberAccountProperties.address).emit('channelCreationFailed', job.id);
                    throw new Error('channel-creation-confirmation');
                }
                logger.verbose(`job.id= ${job.id}`);
                res.status(StatusCode.SuccessOK).send({
                    job: {
                        id: job.id,
                        createdAt: job.created_at,
                        href: `/v1/api/job/status?jobId=${job.id}`,
                    }
                });
                websocket.of('/channels').to(memberAccountProperties.address).emit('channelCreated', {jobId: job.id});
            });
        job.on('complete', function (result) {
            logger.verbose(`---- JobQueue: channel-creation-confirmation.on(complete)`);
            logger.sensitive(`result= ${JSON.stringify(result)}`);
            const endTime = Date.now();
            const processingTime = `${moment.duration(endTime-startTime).minutes()}:${moment.duration(endTime-startTime).seconds()}`
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            logger.info('++ Create a Channel');
            logger.info(`++ Processing TIME`);
            logger.info(`++ ${processingTime}`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            // const payload = {channelName: result.channelName, account: result.channelAccountProperties.address}
            websocket.of('/channels').to(memberAccountProperties.address).emit('channelSuccessful', {
                jobId: job.id,
                channelName: result.channelName,
                channelAddress: result.channelAccountProperties.address
            });
        });
        job.on('failed attempt', function (errorMessage, doneAttempts) {
            logger.error(`****************************************************************`);
            logger.error(`** JobQueue: channel-creation-confirmation.on(failed attempt))`);
            logger.error(`****************************************************************`);
            // logger.error(`errorMessage= ${JSON.stringify(errorMessage)}`);
            // logger.error(`doneAttempts= ${JSON.stringify(doneAttempts)}`);
            websocket.of('/channels').to(memberAccountProperties.address).emit('channelCreationFailed', job.id);
            console.log(errorMessage)
            console.log(doneAttempts)
        });

        job.on('failed', function (errorMessage) {
            logger.error(`****************************************************************`);
            logger.error(`** JobQueue: channel-creation-confirmation.on(failed))`);
            logger.error(`****************************************************************`);
            // logger.error(`error= ${error}`)
            // logger.error(`errorMessage= ${JSON.stringify(errorMessage)}`);
            websocket.of('/channels').to(memberAccountProperties.address).emit('channelCreationFailed', job.id);
            // throw new Error(errorMessage);
            console.log(errorMessage)
        });
    })
};
