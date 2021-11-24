import _ from 'lodash';
const gu = require('../utils/gravityUtils');
import controller from '../config/controller';
import {gravity} from '../config/gravity';
import Channel from '../models/channel';
import Message from '../models/message';
import metis from '../config/metis';
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";
import {jupiterAccountService} from "../services/jupiterAccountService";
import {chanService} from "../services/chanService";

const {
    v1: uuidv1,
    v4: uuidv4,
} = require('uuid');
const connection = process.env.SOCKET_SERVER;
const device = require('express-device');
const logger = require('../utils/logger')(module);
const {hasJsonStructure} = require('../utils/utils');
const {getPNTokensAndSendPushNotification, getPNTokenAndSendInviteNotification} = require('../services/messageService');

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
        logger.info('======================================================================================');
        console.log('');

        const memberAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
            req.user.passphrase,
            req.user.password
        )

        const allMemberChannels = await jupiterAccountService.getMemberChannels(memberAccountProperties);

        const listOfChannels = allMemberChannels.reduce((reduced, channelAccountProperties) =>{
             reduced.push({
                 channelAddress: channelAccountProperties.address,
                 channelName: channelAccountProperties.channelName});
             return reduced;
        }, [])

        res.send(listOfChannels);
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
        const memberAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
            req.user.passphrase,
            req.user.password
        );

            chanService.acceptInvitation(memberAccountProperties, channelAddress)
                .then(() => {
                    return res.send({success: true, message: 'Invite accepted'});
                })
                .catch(error => {
                    logger.error(`*********************************************`)
                    logger.error(`** channel/invite/accept ERROR`)
                    logger.error(`${error}`);
                    return res.status(500).send({error: true, fullError: `${error}`});
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

        const {user, channel} = req;
        const tableData = {
            passphrase: channel.channel_record.passphrase,
            account: channel.channel_record.account,
            password: channel.channel_record.password,
        };
        const channelModel = new Channel(tableData);
        channelModel.user = user;

        const order = _.get(req, 'headers.order', 'desc');
        const limit = _.get(req, 'headers.limit', 10); //TODO we need to get rid of this
        channelModel.loadMessages(req.params.scope, req.params.firstIndex, order, limit)
            .then(response => res.send(response))
            .catch(error => {
                console.log('Error getting messages', error);
                return res.status(500).send({success: false, message: 'Something went wrong'});
            });
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
        console.log('');

        let {data} = req.body;
        const {user, channel} = req;
        data = {
            ...data,
            name: user.userData.alias,
            sender: user.userData.account,
            senderAlias: user.userData.alias,
        };

        const tableData = channel.channel_record;
        const message = new Message(data);
        const {memberProfilePicture} = await metis.getMember({
            channel: tableData.account,
            account: tableData.publicKey,
            password: tableData.password,
        });

        const mentions = _.get(req, 'data.mentions', []);
        const channelName = _.get(tableData, 'name', 'a channel');
        const userData = JSON.parse(gravity.decrypt(user.accountData));

        message.sendRecord(userData, tableData)
            .then(() => {
                const messagePayload = {
                    sender: user.userData.account,
                    message: data.message,
                    name: user.userData.alias,
                    replyMessage: data.replyMessage,
                    replyRecipientName: data.replyRecipientName,
                    isInvitation: data.isInvitation || false,
                    messageVersion: data.messageVersion,
                    date: Date.now(),
                    encryptionLevel: "channel"
                };

                if (!!data.isInvitation) {
                    websocket.of('/chat').to(channel.id).emit('newMemberChannel');
                }
                websocket.of('/chat').to(channel.id).emit('createMessage', messagePayload);
            })
            .then(() => {
                let members = memberProfilePicture.map(member => member.accountRS);
                if (Array.isArray(members) && members.length > 0) {
                    const senderAccount = user.userData.account;
                    const senderName = user.userData.alias;
                    members = members.filter(member => member !== senderAccount && !mentions.includes(member));

                    const pnBody = `${senderName} has sent a message on channel ${channelName}`;
                    const pnTitle = `${senderName} @ ${channelName}`;

                    const channelAccount = channel && channel.channel_record
                        ? channel.channel_record.account : null;

                    getPNTokensAndSendPushNotification(members, senderName, channel, pnBody, pnTitle, {channelAccount});

                    // Push notification for mentioned members
                    const pnmBody = `${senderName} was tagged on ${channelName}`;
                    const pnmTitle = `${senderName} has tagged @ ${channelName}`;
                    getPNTokensAndSendPushNotification(mentions, senderName, channel, pnmBody, pnmTitle, {channelAccount});
                }
            })
            .then(() => res.send({success: true, message: 'Message successfully sent'}))
            .catch(error => {
                logger.error('[/data/messages]',`${error}`);
                res.status(500).send({success: false, fullError: `${error}`});
            });
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

        const memberAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
            req.user.passphrase,
            req.user.password
        )
        chanService.getChannelInvitations(memberAccountProperties)
            .then(channelInvitations => {
                res.send(channelInvitations);
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

            const inviterAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(user.passphrase, user.password);
            const channelAccountProperties = await jupiterAccountService.getChannelAccountPropertiesBelongingToMember(channelAddress, inviterAccountProperties);


            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('channelAccountProperties');
            console.log(channelAccountProperties);
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')


            //@TODO invite only once!!!!
            return chanService.createNewInvitation(
                channelAccountProperties,
                inviterAccountProperties,
                inviteeAddress)
                .then(response => {
                    const inviterAlias = inviterAccountProperties.getCurrentAliasNameOrNull();
                    const message = `${inviterAlias} invited you to join a channel`;
                    const metadata = {isInvitation: 'true'};
                    getPNTokensAndSendPushNotification([inviteeAddress], inviterAccountProperties.address, {}, message, 'Invitation', metadata);
                    res.send({success: true});
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
        if (!channelName) {
            return res.status(400).send({errorMessage: 'need channelName in body'})
        }

        const memberAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
            req.user.passphrase,
            req.user.password);



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
