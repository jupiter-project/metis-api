import _ from 'lodash';
import mailer from 'nodemailer';
import controller from '../config/controller';
import {gravity} from '../config/gravity';
import {messagesConfig} from '../config/constants';
import Invite from '../models/invite';
import Channel from '../models/channel';
import Message from '../models/message';
import metis from '../config/metis';
const device = require('express-device');
const logger = require('../utils/logger')(module);
const { hasJsonStructure } = require('../utils/utils');
const { getPNTokensAndSendPushNotification, getPNTokenAndSendInviteNotification } = require('../services/messageService');

const decryptUserData = req => JSON.parse(gravity.decrypt(req.session.accessData));

module.exports = (app) => {
  app.use(device.capture());

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
      const metadata = { isInvitation: true };
      getPNTokensAndSendPushNotification([recipient], sender, {}, message, 'Invitation', metadata);
      res.send({success: true});
    } catch (e) {
      logger.error(e);
      res.status(500).send(e);
    }
  });

  /**
   * Accept channel invite
   */
  app.post('/v1/api/channels/import', async (req, res) => {
    const { data } = req.body;
    const { accountData } = req.user;
    const channel = new Channel(data.channel_record);
    channel.user = JSON.parse(gravity.decrypt(accountData));

    let response;
    try {
      response = await channel.import(channel.user);
    } catch (e) {
      logger.error(e);
      response = { error: true, fullError: e };
    }

    res.send(response);
  });

  /**
   * Get a channel's messages
   */
  app.get('/v1/api/data/messages/:scope/:firstIndex', async (req, res) => {
    let response;
    const { user } = req;

    const tableData = {
      passphrase: req.headers.channelaccess,
      account: req.headers.channeladdress,
      password: req.headers.channelkey,
    };

    const channel = new Channel(tableData);
    channel.user = user;
    try {
      const order = _.get(req, 'headers.order', 'desc');
      const limit = _.get(req, 'headers.limit', 10);
      const data = await channel.loadMessages(
        req.params.scope,
        req.params.firstIndex,
        order,
        limit,
      );
      response = data;
    } catch (e) {
      logger.error(e);
      response = { success: false, fullError: e };
    }

    if (!response.success) {
      return res.status(400).send(response);
    }

    return res.send(response);
  });

  /**
   * Send a message
   */
  app.post('/v1/api/data/messages', async (req, res) => {

    let response;

      let { tableData, data } = req.body;
      const { user } = req;
      data = {
        ...data,
        name: user.userData.alias,
        sender: user.userData.account,
        senderAlias: user.userData.alias,
      };

      const message = new Message(data);
      const { memberProfilePicture } = await metis.getMember({
        channel: tableData.account,
        account: tableData.publicKey,
        password: tableData.password,
      });

      const mentions = _.get(req, 'body.mentions', []);
      const channel = _.get(req, 'body.channel', []);
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
};
