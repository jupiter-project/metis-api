import Message from '../models/message';
import { gravity } from '../config/gravity';
const Files = require('../models/files.js');
const uuid = require("uuid");
const os = require('os');

const FormData = require('form-data');
const axios = require('axios');

const sendToMongo = (user, channel, fileBase64Encoded, fileName, messageObj, res, mimetype, size) => {
  const id = uuid.v4()
  const hostname = os.hostname();
  const file = new Files({
    id: id,
    account: user.userData.account,
    originalname: fileName,
    mimetype: mimetype,
    url: `https://${hostname}/v1/api/jim/file?id=${id}`,
    size: size,
    data: fileBase64Encoded
  });

  file.save()
    .then((resp) => {
      console.log(resp);
    })
    .catch((err) => {
      console.log(err);
    });
    const payload = {
      originalname: file.originalname,
      mimetype: file.mimetype,
      url: file.url,
      size: file.size
    };
    const dataMessage = {
      ...messageObj,
      name: user.userData.alias,
      sender: user.userData.account,
      senderAlias: user.userData.alias,
      type: 'storage',
      payload: payload,
    };
    const tableData = channel.channel_record;
    const userData = JSON.parse(gravity.decrypt(user.accountData));
    const messageModel = new Message(dataMessage);
    messageModel.sendMessage(userData, tableData, messageModel.record)
    .then(resp => {
        const data = {};
        res.status(200).json(data);
      }
    )
    .catch(
      error => res.status(500).json({ msg: 'Something went wrong', error })
    );
};

const sendToJIM = (user, channel, fileBase64Encoded, fileName, messageObj, res) => {
  const dataLogin = {
    account: channel.channel_record.account,
    passphrase: channel.channel_record.passphrase,
    password: channel.channel_record.password,
  };

  axios.post(`${process.env.JIM_SERVER}/api/v1/signin`, dataLogin)
    .then((response) => {
      const buffer = Buffer.from(fileBase64Encoded, 'base64');
      const form = new FormData();
      form.append('image', buffer, fileName);

      const msjHeaders = {
        headers: {
          Authorization: `Bearer ${response.data.token}`,
          'Content-Type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
      };

      return axios.post(`${process.env.JIM_SERVER}/api/v1/image`, form, msjHeaders);
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
}

module.exports = {
  fileUpload: (req, res) => {
    console.log('[fileUpload]: Start');
    const { user, channel } = req;
    const mimetype = req.body.file.type;
    const size = req.body.file.size;
    const fileBase64Encoded = req.body.file.data;
    const fileName = req.body.file.name;
    const messageObj = req.body.message.data;

    if (!(fileBase64Encoded)) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    if(process.env.JIMTEST && process.env.JIMTEST === false){
      sendToJIM(user, channel, fileBase64Encoded, fileName, messageObj, res);
    } else {
      sendToMongo(user, channel, fileBase64Encoded, fileName, messageObj, res, mimetype, size);
    }

  },
  getFile: (req, res) => {
    const { id } = req.query;
    const file = Files.findOne({'id': id});
    file.then( resp => {
      if (!resp)
        return res.status(404).json({
          message: "The Product was not found",
        });
      const buffer = Buffer.from(resp.data, "base64");
      res.write(buffer, {'Content-Type':'image/jpeg'});
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({});
    });

  },
};
