import _ from 'lodash';
import controller from '../config/controller';
import {gravity} from '../config/gravity';
import Channel from '../models/channel';
import ChannelRecord from '../models/channel';
import Message from '../models/message';
import metis from '../config/metis';
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";
import {jupiterAccountService} from "../services/jupiterAccountService";
import {chanService} from "../services/chanService";
import {instantiateGravityAccountProperties} from "../gravity/instantiateGravityAccountProperties";
import {jupiterTransactionsService} from "../services/jupiterTransactionsService";
import jupiterAPIService from "../services/jupiterAPIService";
import {jupiterTransactionMessageService} from "../services/jupiterTransactionMessageService";
import {messagesConfig} from "../config/constants";
import {FeeManager} from "../services/FeeManager";
import {generateNewMessageRecordJson, sendMessagePushNotifications, sendMetisMessage} from "../services/messageService";

const gu = require('../utils/gravityUtils');
const jwt = require('jsonwebtoken');

const {
    v1: uuidv1,
    v4: uuidv4,
} = require('uuid');
const connection = process.env.SOCKET_SERVER;
const device = require('express-device');
const logger = require('../utils/logger')(module);
const {getPNTokensAndSendPushNotification, getPNTokenAndSendInviteNotification} = require('../services/PushNotificationMessageService');


module.exports = (app, passport, React, ReactDOMServer, jobs, websocket) => {
    app.use(device.capture());

    /**
     * Get List of Channels
     */
    app.get('/v1/api/channels', async (req,res) => {
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

        const allMemberChannels = await jupiterAccountService.getMemberChannels(memberAccountProperties);

        const listOfChannels = allMemberChannels.reduce((reduced, channelAccountProperties) =>{
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
            const sender = user.userData.alias;
            let recipient = _.get(data, 'recipient', '');

            if (!recipient.toLowerCase().includes('jup-')) {
                const aliasResponse = await gravity.getAlias(recipient);
                recipient = aliasResponse.accountRS;
            }

            const message = `${sender} is inviting you to a video call`;
            const url = `metis/${uuidv4()}`;
            const metadata = {isCall: 'true', url: url, recipient: recipient, sender: sender};
            getPNTokensAndSendPushNotification([recipient], sender, {}, message, 'call', metadata);
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
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Accept Channel Invite');
        logger.info('== v1/api/channel/invite/accept');
        logger.info('======================================================================================');
        console.log('');

        const {channelAddress} = req.body
        if(!gu.isWellFormedJupiterAddress(channelAddress)){throw new Error('channelAddress is incorrect')};
        const memberAccountProperties = await instantiateGravityAccountProperties(
            req.user.passphrase,
            req.user.password
        );

        chanService.acceptInvitation(memberAccountProperties, channelAddress)
            .then(() => {
                res.send({success: true, message: 'Invite accepted'});
            })
            .catch(error => {
                logger.error(`*********************************************`)
                logger.error(`** channel/invite/accept ERROR`)
                logger.error(`${error}`);
                res.status(500).send({error: true, fullError: `${error}`});
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
    app.get('/v1/api/data/messages/:scope/:firstIndex', async (req, res) => {
        console.log('');
        logger.info('======================================================================================');
        logger.info('==  Get a channel\'s messages');
        logger.info('== GET: /v1/api/data/messages/:scope/:firstIndex');
        logger.info('======================================================================================');
        console.log('');
        const { user } = req;
        const { channelAddress } = req.query

        if (!channelAddress) {
            return res.status(400).send({success: false, message: 'Channel account is required'});
        }

        try{
            if(!gu.isWellFormedJupiterAddress(channelAddress)){
                return res.status(500).send({success: false, error: `${error}`})
            }

            const memberAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.decryptedAccountData.encryptionPassword);
            const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress);

            if(!channelAccountProperties){
                return res.status(500).send({message:'channel is not available'})
            }

            const tag = 'v1.metis.message.message-record';
            const messageTransactions = await jupiterTransactionsService.getReadableTaggedMessageContainersByIndex(0, 10, channelAccountProperties, tag, false);
            res.send(messageTransactions);
        } catch (error){
            logger.error('Error getting messages:');
            logger.error(JSON.stringify(error));
            res.status(500).send({message: 'Error getting messages'})
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

        const { user } = req;
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

        if(!message || !address){
            return res.status(400).send({message: 'Must include a valid message and address'});
        }

        const memberAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);
        const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNull(memberAccountProperties, address);

        if(!channelAccountProperties){
            return res.status(403).send({message: 'Invalid channel address.'})
        }

        try{
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

            await sendMetisMessage(memberAccountProperties, channelAccountProperties, messageRecord);
            if (type === 'invitation') {
                websocket.of('/chat').to(address).emit('newMemberChannel');
            }
            websocket.of('/chat').to(address).emit('createMessage', { message: messageRecord });
        }catch(error){
            logger.error('Error sending metis message:')
            logger.error(JSON.stringify(error));
            return res.status(500).send({message: 'Error sending message'})
        }
        res.send({ message: 'Message successfully sent' });
        await sendMessagePushNotifications(memberAccountProperties, channelAccountProperties, mentions);
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

        const memberAccountProperties = await instantiateGravityAccountProperties(
            req.user.passphrase,
            req.user.password
        )
        chanService.getChannelInvitationContainersSentToAccount(memberAccountProperties)
            .then(channelInvitations => {
                const payload = channelInvitations.map( channelInvitationContainer => {
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

        const {channelAddress, inviteeAddress} = req.body;
        const {user} = req;

        try {
            if(!gu.isWellFormedJupiterAddress(channelAddress)){throw new Error('channelAddress not well formed')}
            if(!gu.isWellFormedJupiterAddress(inviteeAddress)){throw new Error('inviteeAddress not well formed')}

            const inviterAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);
            const channelAccountProperties = await jupiterAccountService.getChannelAccountPropertiesBelongingToMember(channelAddress, inviterAccountProperties);


            return chanService.createInvitation(
                channelAccountProperties,
                inviterAccountProperties,
                inviteeAddress)
                .then(response => {
                    const inviterAlias = inviterAccountProperties.getCurrentAliasNameOrNull();
                    const message = `${inviterAlias} invited you to join a channel`;
                    const metadata = {isInvitation: 'true'};
                    getPNTokensAndSendPushNotification([inviteeAddress], inviterAccountProperties.address, {}, message, 'Invitation', metadata);

                    // const createInvitationResponse = {
                    //     invitationId: sendTaggedAndEncipheredMetisMessageResponse.data.transaction,
                    //     channelAddress: channelAccountProperties.address,
                    //     channelName: channelAccountProperties.channelName,
                    //     inviteeAddress: inviteeAddress.address,
                    // }

                    res.send(response);

                })
                .catch(error => {
                    logger.error(`${error}`);
                    res.sendStatus(500);
                })
        } catch (error) {
            logger.error(`${error}`);
            res.sendStatus(500);
        }
    });


    /**
     * Create a Channel, assigned to the current user
     */
    app.post('/v1/api/channel', async (req, res, next) => {
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Create a Channel, assigned to the current user');
        logger.info('== app.post(\'/v1/api/channel\')(req,res,next)');
        logger.info('======================================================================================');
        console.log('');

        const {channelName} = req.body;
        const { userData: { alias, account } } = req.user;
        if (!channelName) {
            return res.status(400).send({errorMessage: 'need channelName in body'})
        }
        const memberAccountProperties = await instantiateGravityAccountProperties(
            req.user.passphrase,
            req.user.password);

        const aliasInfo = {
            aliasName: alias,
            aliasURI: '--',
            accountRS: account,
        };

        memberAccountProperties.addAlias(aliasInfo); //TODO remove this


        console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
        console.log('memberAccountProperties.address');
        console.log(memberAccountProperties.address);
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')


        const job = jobs.create('channel-creation-confirmation', {channelName, memberAccountProperties})
            .priority('high')
            .removeOnComplete(false)
            .save(error => {
                logger.verbose(`-----------------------------------------------------------------------------------`);
                logger.verbose(`-- JobQueue: channel-creation-confirmation.save(error)`);
                logger.verbose(`-- `);
                logger.sensitive(`error= ${JSON.stringify(error)}`);
                if (error) {
                    websocket.of('/channels').to(memberAccountProperties.address).emit('channelCreationFailed', job.id);
                    throw new Error('channel-creation-confirmation');
                }

                logger.verbose(`job.id= ${job.id}`);
                res.status(200).send({jobId: job.id});
                websocket.of('/channels').to(memberAccountProperties.address).emit('channelCreated', {jobId: job.id});
            });

        job.on('complete', function (result) {
            logger.verbose(`-----------------------------------------------------------------------------------`);
            logger.verbose(`-- JobQueue: channel-creation-confirmation.on(complete)`);
            logger.verbose(`-- `);
            logger.sensitive(`result=${JSON.stringify(result)}`);
            const payload = {channelName: result.channelName, account: result.channelAccountProperties.address}
            websocket.of('/channels').to(memberAccountProperties.address).emit('channelSuccessful', {
                jobId: job.id,
                channelName: result.channelName,
                channelAddress: result.channelAccountProperties.address
            });
        });

        job.on('failed attempt', function (errorMessage, doneAttempts) {
            logger.verbose(`-----------------------------------------------------------------------------------`);
            logger.verbose(`-- JobQueue: channel-creation-confirmation.on(failed attempt)`);
            logger.verbose(`-- `);
            logger.error(`errorMessage= ${JSON.stringify(errorMessage)}`);
            logger.error(`doneAttempts= ${JSON.stringify(doneAttempts)}`);
            websocket.of('/channels').to(memberAccountProperties.address).emit('channelCreationFailed', job.id);
        });

        job.on('failed', function (errorMessage) {
            logger.verbose(`-----------------------------------------------------------------------------------`);
            logger.verbose(`-- JobQueue: channel-creation-confirmation.on(failed)`);
            logger.verbose(`-- `);
            logger.error(`errorMessage= ${JSON.stringify(errorMessage)}`);
            websocket.of('/channels').to(memberAccountProperties.address).emit('channelCreationFailed', job.id);
        });


    })

};
