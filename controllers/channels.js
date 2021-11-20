import _ from 'lodash';
import mailer from 'nodemailer';
import controller from '../config/controller';
import {gravity} from '../config/gravity';
import {channelConfig, messagesConfig} from '../config/constants';
import Invite from '../models/invite';
import Channel from '../models/channel';
import Message from '../models/message';
import metis from '../config/metis';
import {FeeManager, feeManagerSingleton} from "../services/FeeManager";
import {FundingManager, fundingManagerSingleton} from "../services/fundingManager";
import {ApplicationAccountProperties} from "../gravity/applicationAccountProperties";
import {JupiterAPIService} from "../services/jupiterAPIService";
import {JupiterTransactionsService} from "../services/jupiterTransactionsService";
import {GravityCrypto} from "../services/gravityCrypto";
import channelRecord from "../models/channel.js";
import {jupiterFundingService} from "../services/jupiterFundingService";
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";

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
     * Render Channels page
     */
    app.get('/channels', controller.isLoggedIn, (req, res) => {
        const messages = req.session.flash;
        req.session.flash = null;

        const PageFile = require('../views/channels.jsx');

        const page = ReactDOMServer.renderToString(
            React.createElement(PageFile, {
                connection,
                messages,
                name: 'Metis - Chats',
                user: req.user,
                dashboard: true,
                public_key: req.session.public_key,
                validation: req.session.jup_key,
                accessData: req.session.accessData,
            }),
        );

        res.send(page);
    });

    app.post('/v1/api/reportUser', controller.isLoggedIn, (req, res) => {
        const transporter = mailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.EMAIL,
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN,
            },
        });

        const data = req.body.data;

        const body = `
      User Report: <br />
      The user <b>${data.reporter}</b> wants to report the following message: <br />
      ${JSON.stringify(data.message)}
      <br />
      Description:
      ${data.description}
    `;
        transporter.sendMail({
            subject: `Report user: ${data.message.sender}`,
            html: body,
            to: 'info+report-a-user@sigwo.com',
            from: process.env.EMAIL,
        }, (err, data) => {
            if (err != null) {
                res.send({success: true});
                return;
            }

            res.send({success: true, data});
        });
    });

    /**
     * Render invites page
     */
    app.get('/invites', controller.isLoggedIn, (req, res) => {
        const messages = req.session.flash;
        req.session.flash = null;

        const PageFile = require('../views/invites.jsx');

        const page = ReactDOMServer.renderToString(
            React.createElement(PageFile, {
                connection,
                messages,
                name: 'Metis - Invites',
                user: req.user,
                dashboard: true,
                public_key: req.session.public_key,
                validation: req.session.jup_key,
                accessData: req.session.accessData,
            }),
        );

        res.send(page);
    });

    /**
     * Get a user's invites
     */
    app.get('/v1/api/channels/invites', async (req, res) => {
        logger.info('/n/n/nChannel Invites/n/n');
        const {accountData} = req.user;
        const invite = new Invite();
        const userData = JSON.parse(gravity.decrypt(accountData));
        logger.sensitive(JSON.stringify(userData));
        invite.user = userData;

        invite.get()
            .then(response => res.send(response))
            .catch(error => {
                logger.verbose(`*********************************************`)
                logger.error(`** invite.get.catch(error)`)
                logger.error(`Error getting invites: ${JSON.stringify(error)}`);
                res.status(500).send({success: false, error});
            })
    });

    /**
     * Send an invite
     */
    app.post('/v1/api/channels/invite', async (req, res) => {
        const {data} = req.body;
        const {user} = req;

        data.sender = user.userData.account;
        const invite = new Invite(data);
        invite.user = JSON.parse(gravity.decrypt(user.accountData));

        try {
            await invite.send();
            const sender = user.userData.alias;
            let recipient = _.get(data, 'recipient', '');

            if (!recipient.toLowerCase().includes('jup-')) {
                const aliasResponse = await gravity.getAlias(recipient);
                recipient = aliasResponse.accountRS;
            }

            const message = `${sender} invited you to join a channel`;
            const metadata = {isInvitation: 'true'};
            getPNTokensAndSendPushNotification([recipient], sender, {}, message, 'Invitation', metadata);
            res.send({success: true});
        } catch (e) {
            logger.error(e);
            res.status(500).send(e);
        }
    });


    /**
     * Send an invite
     */
    app.post('/v1/api/channels/call', async (req, res) => {
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
            res.status(500).send(e);
        }
    });

    /**
     * Accept channel invite
     */
    app.post('/v1/api/channels/import', async (req, res) => {
        const {accountData, userData} = req.user;
        const {channel_record} = req.channel;

        channel_record.invited = true;
        channel_record.sender = userData.account;
        const channel = new Channel(channel_record);
        channel.user = JSON.parse(gravity.decrypt(accountData));

        let decryptedAccountData = null;

        try {
            decryptedAccountData = JSON.parse(gravity.decrypt(accountData));
        } catch (error) {
            return res.status(500).send({success: false, message: 'Error while decrypting the user information'});
        }

        const params = {
            channel: channel_record.account,
            password: channel_record.password,
            account: decryptedAccountData.account,
            alias: userData.alias,
        };

        const channelProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(channel_record.passphrase, channel_record.password);
        const memberProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(decryptedAccountData.passphrase, decryptedAccountData.password);

        return metis.addToMemberList(params) //TODO we need to get rid of this
            .then(() => metis.addMemberToChannelIfDoesntExist(memberProperties, channelProperties))
            .then(() => {
                logger.verbose(`------------------------------------------`)
                logger.verbose(`-- channel.import.then()`)
                return channel.import(channel.user);
            })
            .then(() => {
                // websocket.of('/channels').to(`channel-creation`).emit('channelMemberAdded', { channelToken: req.channel.token });
                return res.send({success: true, message: 'Invite accepted'});
            })
            .catch(error => {
                logger.verbose(`*********************************************`)
                logger.error(`** channel.import.catch(error)`)
                logger.error(`Error accepting invite: ${JSON.stringify(error)}`);
                return res.status(500).send({error: true, fullError: error});
            });
    });

    /**
     * Render a channel's conversations
     */
    app.get('/channels/:id', controller.isLoggedIn, (req, res) => {
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
        logger.verbose(`###################################################################################`);
        logger.verbose(`## Send A Message)`);
        logger.verbose(`## app.post('/v1/api/data/messages'(req, res)`);
        logger.verbose(`## `);
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
                logger.error('[/data/messages]', JSON.stringify(error));
                res.status(500).send({success: false, fullError: error});
            });
    });

    /**
     * Create a record, assigned to the current user
     */
    app.post('/v1/api/create/channels', (req, res, next) => {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## app.post('/v1/api/create/channels')(req,res,next)`);
        logger.verbose(`## `);
        const {channelName, userPublicKey} = req.body;
        const {
            id,
            accessKey,
            accountData,
            userData,
        } = req.user;

        let decryptedAccountData = null;

        try {
            decryptedAccountData = JSON.parse(gravity.decrypt(accountData));
        } catch (error) {
            return res.status(500).send({success: false, message: 'Error while decrypting the user information'});
        }


        const data = {
            name: channelName,
            date_confirmed: Date.now(),
            address: decryptedAccountData.account,
            passphrase: '',
            password: '',
            public_key: decryptedAccountData.publicKey,
            user_address: decryptedAccountData.account,
            user_api_key: accessKey,
            user_id: id,
            sender: userData.account,
            createdBy: userData.account,
        };

        logger.sensitive(`data=${JSON.stringify(data)}`);
        const channelRecord = require('../models/channel.js');
        const channelObject = new channelRecord(data);
        channelObject.create(decryptedAccountData)
            .then(channelCreationResponse => {
                logger.verbose(`-----------------------------------------------------------------------------------`);
                logger.verbose(`-- channelObject.then(response)`);
                logger.verbose(`-- `);
                logger.sensitive(`response=${JSON.stringify(channelCreationResponse)}`);
                logger.sensitive(`decryptedAccountData=${JSON.stringify(decryptedAccountData)}`);

                const {transaction} = channelCreationResponse.accountInfo;
                decryptedAccountData.alias = userData.alias;
                const transactionData = {channelRecord: channelObject, decryptedAccountData, userPublicKey};

                const job = jobs.create('channel-creation-confirmation', transactionData)
                    .priority('high')
                    .removeOnComplete(false)
                    .save(err => {
                        if (err) {
                            logger.error(`there is a problem saving to redis`);
                            logger.error(JSON.stringify(err));
                            console.log('Socket on failed');
                            websocket.of('/channels').to(userData.account).emit('channelCreationFailed', job.id);
                        }
                        logger.verbose(`jobQueue.save() id= ${job.id}`);
                        const channel = {
                            account: channelObject.record.account,
                            name: channelObject.record.name,
                            status: 'inProgress'
                        };
                        websocket.of('/channels').to(userData.account).emit('channelCreated', {jobId: job.id, channel});
                        res.status(200).send({jobId: job.id, paymentTransaction: transaction});
                    });

                job.on('complete', function (result) {
                    console.log('Socket on completed');
                    const channel = {
                        account: channelObject.record.account,
                        name: channelObject.record.name
                    }
                    websocket.of('/channels').to(userData.account).emit('channelSuccessful', {jobId: job.id, channel});
                });

                job.on('failed attempt', function (errorMessage, doneAttempts) {
                    console.log('Socket on failed attempt');
                    websocket.of('/channels').to(userData.account).emit('channelCreationFailed', job.id);
                });

                job.on('failed', function (errorMessage) {
                    console.log('Socket on failed');
                    websocket.of('/channels').to(userData.account).emit('channelCreationFailed', job.id);
                });

            })
            .catch((err) => {
                logger.error(`***********************************************************************************`);
                logger.error(`** channelObject.create(decryptedAccountData).catch(err)`);
                logger.error(`** `);
                logger.sensitive(`err=${JSON.stringify(err)}`);
                res.status(500).send({
                    success: false,
                    errors: err.errors
                });
            });
    });
};
