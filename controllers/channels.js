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
const {
  v1: uuidv1,
  v4: uuidv4,
} = require('uuid');
const connection = process.env.SOCKET_SERVER;
const device = require('express-device');
const logger = require('../utils/logger')(module);
const { hasJsonStructure } = require('../utils/utils');
const { getPNTokensAndSendPushNotification, getPNTokenAndSendInviteNotification } = require('../services/messageService');

const decryptUserData = req => JSON.parse(gravity.decrypt(req.session.accessData));

module.exports = (app, passport, React, ReactDOMServer) => {
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
        res.send({ success: true });
        return;
      }

      res.send({ success: true, data });
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
    logger.info(req.session);
    const { accountData } = req.user;
    const invite = new Invite();
    const userData = JSON.parse(gravity.decrypt(accountData));
    invite.user = userData;
    let response;
    try {
      response = await invite.get('channelInvite');
    } catch (e) {
      logger.error(e);
      response = e;
    }
    res.send(response);
  });

  /**
   * Send an invite
   */
  app.post('/v1/api/channels/invite', async (req, res) => {
    const { data } = req.body;
    const { user } = req;

    data.sender = user.userData.account;
    const invite = new Invite(data);
    invite.user = JSON.parse(gravity.decrypt(user.accountData));

    try {
      await invite.send();
      const sender = user.userData.alias;
      let recipient = _.get(data, 'recipient', '');
      const channelName = _.get(data, 'channel.name', '');


      if (!recipient.toLowerCase().includes('jup-')) {
        const aliasResponse = await gravity.getAlias(recipient);
        recipient = aliasResponse.accountRS;
      }

      const message = `${sender} invited you to the channel: ${channelName}`;
      const metadata = { isInvitation: 'true' };
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
    const { data } = req.body;
    const { user } = req;
    try {
      const sender = user.userData.alias;
      let recipient = _.get(data, 'recipient', '');

      if (!recipient.toLowerCase().includes('jup-')) {
        const aliasResponse = await gravity.getAlias(recipient);
        recipient = aliasResponse.accountRS;
      }

      const message = `${sender} is inviting you to a video call`;
      const url = `metis/${uuidv4()}`;
      const metadata = { isCall: 'true', url: url, recipient: recipient, sender: sender};
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

    logger.verbose('#########################################################');
    logger.verbose(`## Accept Channel Invitation`);
    logger.verbose(`## app.post(/v1/api/channels/import)`);
    logger.verbose('##');
    const { accountData, userData } = req.user;
    const { channel_record: channelRecord } = req.channel;
    logger.sensitive(`accountData=${JSON.stringify(accountData)}`)
    logger.sensitive(`userData=${JSON.stringify(userData)}`)
    channelRecord.invited = true;
    channelRecord.sender = userData.account;
    logger.sensitive(`channel_record=${JSON.stringify(channelRecord)}`)
    const channel = new Channel(channelRecord);
    const decryptedAccountData = JSON.parse(gravity.decrypt(accountData));
    logger.sensitive(`decryptedAccountData= ${JSON.stringify(decryptedAccountData)}`);
    channel.user = decryptedAccountData;
    channel.import(channel.user)
        .then(() => {
          logger.verbose(`------------------------------------------`)
          logger.verbose(`-- channel.import.then()`)
          return res.send({success: true, message: 'Invite accepted'});
        })
        .catch(error => {
          logger.verbose(`*********************************************`)
          logger.error(`** channel.import.catch(error)`)
          logger.error(`Error accepting invite: ${JSON.stringify(error)}`);
          return res.status(500).send({ error: true, fullError: error });
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
    const { user, channel } = req;
    const tableData = {
      passphrase: channel.channel_record.passphrase,
      account: channel.channel_record.account,
      password: channel.channel_record.password,
    };
    const channelModel = new Channel(tableData);
    channelModel.user = user;

      const order = _.get(req, 'headers.order', 'desc');
      const limit = _.get(req, 'headers.limit', 10);
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
    let response;
      let { data } = req.body;
      const { user, channel } = req;
      data = {
        ...data,
        name: user.userData.alias,
        sender: user.userData.account,
        senderAlias: user.userData.alias,
      };

      const tableData = channel.channel_record;
      const message = new Message(data);
      const { memberProfilePicture } = await metis.getMember({
        channel: tableData.account,
        account: tableData.publicKey,
        password: tableData.password,
      });

      const mentions = _.get(req, 'data.mentions', []);
      const channelName = _.get(tableData, 'name', 'a channel');
      const userData = JSON.parse(gravity.decrypt(user.accountData));
      try {
        response = await message.sendRecord(userData, tableData);
        let members = memberProfilePicture.map(member => member.accountRS);
        if (Array.isArray(members) && members.length > 0) {
          const senderAccount = user.userData.account;
          const senderName = user.userData.alias;
          members = members.filter(member => member !== senderAccount && !mentions.includes(member));

          const pnBody = `${senderName} has sent a message on channel ${channelName}`;
          const pnTitle = `${senderName} @ ${channelName}`;

          const channelAccount = channel && channel.channel_record
              ? channel.channel_record.account : null;

          getPNTokensAndSendPushNotification(members, senderName, channel, pnBody, pnTitle, { channelAccount });

          // Push notification for mentioned members
          const pnmBody = `${senderName} was tagged on ${channelName}`;
          const pnmTitle = `${senderName} has tagged @ ${channelName}`;
          getPNTokensAndSendPushNotification(mentions, senderName, channel, pnmBody, pnmTitle, { channelAccount });
        }
        res.send(response);
      } catch (e) {
        logger.error('[/data/messages]', JSON.stringify(e));
        res.status(500).send({ success: false, fullError: e });
      }
  });

  /**
   * Create a record, assigned to the current user
   */
  app.post('/v1/api/create/channels', (req, res, next) => {
    logger.verbose(`app.post(/v1/api/create/channels)`);
    const params = req.body;
    let { channelName } = params;
    const {
      id,
      accessKey,
      accountData,
      userData,
    } = req.user;

    const decryptedAccountData = JSON.parse(gravity.decrypt(accountData));

    logger.sensitive(`userData = ${ JSON.stringify(decryptedAccountData)}`);
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

    const channelRecord = require('../models/channel.js');
    const channelObject = new channelRecord(data);
    channelObject.create(decryptedAccountData)
        .then((response) => {
          res.status(200).send(response);
        })
        .catch((err) => {
          logger.error(`app.post() recordObject.create().catch() ${ JSON.stringify(err)}`);
          res.status(500).send({
            success: false,
            errors: err.errors
          });
        });

  });
};
