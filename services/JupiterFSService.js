import Message from '../models/message';
import { gravity } from '../config/gravity';

const axios = require('axios');


module.exports = {
  fileUpload: (req, res) => {
    const { payload, message } = req.body;
    const { user, channel } = req;
    if (!(payload)) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    // TODO request a token through the login to JIM


    const dataLogin = {
      account: channel.channel_record.account,
      passphrase: channel.channel_record.passphrase,
      password: channel.channel_record.password,
    };
    axios.post(`${process.env.JIM_SERVER}/api/signin`, dataLogin)
      .then((token) => {
        const msjHeaders = { headers: { Authorization: `Bearer ${token}` } };
        const data = { payload };
        return axios.post(`${process.env.JIM_SERVER}api/image`, data, msjHeaders);
      })
      .then(async (response) => {
        const dataMessage = {
          name: user.userData.alias,
          sender: user.userData.account,
          senderAlias: user.userData.alias,
          channel,
          message,
          replyMessage: '',
          replyRecipientName: '',
          isInvitation: false,
          messageVersion: '1.0',
          type: 'storage',
          payload: response,
        };
        const tableData = channel.channel_record;
        const userData = JSON.parse(gravity.decrypt(user.accountData));
        const messageModel = new Message(dataMessage);
        await messageModel.sendMessage(userData, tableData, messageModel.record);
        const data = {};
        res.status(200).json(data);
      })
      .catch(error => res.status(500).json({ msg: 'Something went wrong', error }));
  },
};
