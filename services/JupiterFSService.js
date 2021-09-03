import Message from '../models/message';
import { gravity } from '../config/gravity';
import metis from '../config/metis';

const FormData = require('form-data');
const axios = require('axios');
const { getPNTokensAndSendPushNotification } = require('./messageService');

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
  channelProfileDelete: (req, res) => {
    const { channel } = req;
    if (!channel) {
      return res.status(500).json({ msg: 'No channel info' });
    }

    const { passphrase, account, password } = channel.channel_record;
    const dataLogin = { account, passphrase, password };
    const defaultHeader = { headers: { Authorization: '' } };
    const addressBreakdown = account.split('-');


    axios.post(`${process.env.JIM_SERVER}/api/v1/signin`, dataLogin)
      .then((response) => {
        defaultHeader.headers.Authorization = `Bearer ${response.data.token}`;
        return axios.get(`${process.env.JIM_SERVER}/api/v1/storage`, defaultHeader);
      })
      .then(() => gravity.getAccountProperties({ recipient: channel.channel_record.account }))
      .then((userProperties) => {
        const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));

        if (!profilePicture || !profilePicture.value) {
          throw new Error('The account does not have profile picture');
        }
        return profilePicture.value;
      })
      .then((url) => {
        const id = url.split('/').pop();
        return axios.delete(`${process.env.JIM_SERVER}/api/v1/file/${id}`, defaultHeader);
      })
      .then(() => {
        const accountPropertyParams = {
          passphrase,
          recipient: account,
          value: '',
          feeNQT: 100,
          property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
        };
        return gravity.setAcountProperty(accountPropertyParams);
      })
      .then(() => res.status(200).json({ url: '' }))
      .catch((error) => {
        console.log('Something went wrong', error);
        res.status(500).json({ msg: 'Something went wrong', error });
      });
  },
  channelProfileDisplay: (req, res) => {
    const { channel } = req;

    if (!channel) {
      return res.status(500).json({ msg: 'No channel info' });
    }

    gravity.getAccountProperties({ recipient: channel.channel_record.account })
      .then((userProperties) => {
        const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));
        const url = profilePicture && profilePicture.value ? profilePicture.value : null;
        const response = url === '{"threshold":"25000"}' ? { url: null } : { url };
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
    const { passphrase, account, password } = channel.channel_record;
    const fileBase64Encoded = req.body.base64Image;
    const fileName = user.userData.account;
    const addressBreakdown = account.split('-');

    if (!(fileBase64Encoded) || !channel || !fileName) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    jupiterUpload(account, passphrase, password, fileBase64Encoded, fileName)
      .then((response) => {
        const { url } = response.data;
        const accountPropertyParams = {
          passphrase,
          recipient: account,
          value: url,
          feeNQT: 2000,
          property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
        };
        return Promise.all([url, gravity.setAcountProperty(accountPropertyParams)]);
      })
      .then((response) => {
        const [url, accountPropertyResponse] = response;
        if (accountPropertyResponse && accountPropertyResponse.errorDescription) {
          throw new Error(accountPropertyResponse.errorDescription);
        }

        res.status(200).json({ url });
      })
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
      .then(() => metis.getMember({
        channel: channel.channel_record.account,
        account: channel.channel_record.publicKey,
        password: channel.channel_record.password,
      }))
      .then(({ members }) => {
        if (Array.isArray(members) && members.length > 0) {
          const pnTitle = `${channel.channel_record.name}`;
          const senderName = user.userData.alias;
          const message = `${senderName} sent an image`;
          getPNTokensAndSendPushNotification(members, senderName, channel, message, pnTitle);
        }
      })
      .then(() => res.status(200).json({}))
      .catch((error) => {
        console.log('Something went wrong', error);
        res.status(500).json({ msg: 'Something went wrong', error });
      });
  },
};
