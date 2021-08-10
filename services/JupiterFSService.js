import Message from '../models/message';
import { gravity } from '../config/gravity';

const FormData = require('form-data');
const axios = require('axios');

module.exports = {
  fileUpload: (req, res) => {
    console.log('[fileUpload]: Start');
    const { user, channel } = req;
    const fileBase64Encoded = req.body.file.data;
    const fileName = req.body.file.name;
    const messageObj = req.body.message.data;

    if (!(fileBase64Encoded)) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    const dataLogin = {
      account: channel.channel_record.account,
      passphrase: channel.channel_record.passphrase,
      password: channel.channel_record.password,
    };

    const defaultHeader = {
      headers: {
        Authorization: '',
      },
    };

    axios.post(`${process.env.JIM_SERVER}/api/v1/signin`, dataLogin)
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
      .then((() => {
        const buffer = Buffer.from(fileBase64Encoded, 'base64');
        const form = new FormData();
        form.append('file', buffer, fileName);

        defaultHeader.headers['Content-Type'] = `multipart/form-data; boundary=${form.getBoundary()}`;
        return axios.post(`${process.env.JIM_SERVER}/api/v1/file`, form, defaultHeader);
      })
      .then(async (response) => {
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
        await messageModel.sendMessage(userData, tableData, messageModel.record);
        res.status(200).json({});
      })
      .catch((error) => {
        console.log('Something went wrong', error);
        res.status(500).json({ msg: 'Something went wrong', error });
      });
  },
};
