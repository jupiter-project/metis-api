import Message from '../models/message';
import { gravity } from '../config/gravity';

const FormData = require('form-data');
const axios = require('axios');

const jupiterUpload = (
  channelAccount,
  channelPassphrase,
  channelPassword,
  fileBase64Encoded,
  fileName,
) => {
  const dataLogin = {
    account: channelAccount,
    passphrase: channelPassphrase,
    password: channelPassword,
  };

  const defaultHeader = {
    headers: {
      Authorization: '',
    },
  };

  return axios.post(`${process.env.JIM_SERVER}/api/v1/signin`, dataLogin)
    .then((response) => {
      defaultHeader.headers.Authorization = `Bearer ${response.data.token}`;
      return axios.get(`${process.env.JIM_SERVER}/api/v1/storage`, defaultHeader);
    })
    .then((responseStorageInfo) => {
      if (!responseStorageInfo.data) {
        return axios.post(`${process.env.JIM_SERVER}/api/v1/storage`, {}, defaultHeader);
      }

      return responseStorageInfo.data;
    })
    .then(() => {
      const buffer = Buffer.from(fileBase64Encoded, 'base64');
      const form = new FormData();
      form.append('file', buffer, fileName);

      defaultHeader.headers['Content-Type'] = `multipart/form-data; boundary=${form.getBoundary()}`;
      return axios.post(`${process.env.JIM_SERVER}/api/v1/file`, form, defaultHeader);
    });
};

module.exports = {
  channelProfileDisplay: (req, res) => {
    const { channel } = req;

    if (!channel) {
      return res.status(500).json({ msg: 'No channel info' });
    }

    gravity.getAccountProperties({ recipient: channel.channel_record.account })
      .then((userProperties) => {
        const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));
        const response = { url: profilePicture.value || null };
        res.send(response);
      })
      .catch((error) => {
        console.log('Something went wrong', error);
        res.status(500).json({ msg: 'Something went wrong', error });
      });
  },
  channelProfileUpload: (req, res) => {
    console.log('[channelProfileUpload]: Start');
    const { user, channel } = req;
    const fileBase64Encoded = req.body.base64Image;
    const fileName = user.userData.account;

    if (!(fileBase64Encoded) || !channel || !fileName) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    jupiterUpload(
      channel.channel_record.account,
      channel.channel_record.passphrase,
      channel.channel_record.password,
      fileBase64Encoded,
      fileName,
    )
      .then((response) => {
        const addressBreakdown = channel.channel_record.account.split('-');
        const { url } = response.data;
        const accountPropertyParams = {
          passphrase: channel.channel_record.passphrase,
          recipient: channel.channel_record.account,
          property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
          value: response.data.url,
          feeNQT: 100,
        };

        return Promise.all([url, gravity.setAcountProperty(accountPropertyParams)]);
      })
      .then(([url]) => res.status(200).json({ url }))
      .catch((error) => {
        console.log('Something went wrong', error);
        res.status(500).json({ msg: 'Something went wrong', error });
      });
  },
  fileUpload: (req, res) => {
    console.log('[fileUpload]: Start');
    const { user, channel } = req;
    const fileBase64Encoded = req.body.file.data;
    const fileName = req.body.file.name;
    const messageObj = req.body.message.data;

    if (!(fileBase64Encoded) || !channel || !fileName) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    jupiterUpload(
      channel.channel_record.account,
      channel.channel_record.passphrase,
      channel.channel_record.password,
      fileBase64Encoded,
      fileName,
    )
      .then((response) => {
        if (!response.data) {
          res.status(500).json({ success: false, message: 'Error trying to save image' });
        }
        const dataMessage = {
          ...messageObj,
          name: user.userData.alias,
          sender: user.userData.account,
          senderAlias: user.userData.alias,
          type: 'storage',
          payload: response.data,
        };
        const tableData = channel.channel_record;
        const userData = JSON.parse(gravity.decrypt(user.accountData));
        const messageModel = new Message(dataMessage);
        return messageModel.sendMessage(userData, tableData, messageModel.record);
      })
      .then(() => res.status(200).json({}))
      .catch((error) => {
        console.log('Something went wrong', error);
        res.status(500).json({ msg: 'Something went wrong', error });
      });
  },
};
