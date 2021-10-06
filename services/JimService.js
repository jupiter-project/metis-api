import Message from '../models/message';
import { gravity } from '../config/gravity';
import metis from '../config/metis';
import { loadInitialJFSImage } from '../utils/utils';
import {FeeManager, feeManagerSingleton} from "./FeeManager";
import jupiterApiService from "./jupiterAPIService";
import fs from "fs";
const FormData = require('form-data');
const axios = require('axios');
const { getPNTokensAndSendPushNotification, errorMessageHandler } = require('./messageService');
const accountPropertyFee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_property);  //ACCOUNT_PROPERTY_FEE
const logger = require('../utils/logger')(module);


/**
 *
 * @param jupAccount
 * @param passphraseAccount
 * @param passwordAccount
 * @param fileBase64Encoded
 * @param fileName
 * @returns {Promise<AxiosResponse>}
 */
const UploadAnImageButFirstCheckForStorageAndCreateIfMissing = (
  jupAccount,
  passphraseAccount,
  passwordAccount,
  fileBase64Encoded,
  fileName,
) => {

  if ( !jupAccount || !passphraseAccount || !passwordAccount || !fileBase64Encoded ) {
    throw new Error('Missing params, Account, passphrase ans password are required');
  }

  const dataLogin = {
    account: jupAccount,
    passphrase: passphraseAccount,
    password: passwordAccount,
  };

  const defaultHeader = {
    headers: {
      Authorization: '',
    },
  };

  // @TODO  In the near future /api/v1/storage will return a jobID so we need to poll for the job.
  // @TODO this code (post:storage) might not be needed anymore since a metis signup will create the storage.
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

const profileDelete = (passphrase, account, password) => {

  const dataLogin = { account, passphrase, password };
  const defaultHeader = { headers: { Authorization: '' } };
  const addressBreakdown = account.split('-');

  if(!(addressBreakdown.length === 5) ){
    throw new Error('Wrong jup address, please enter a valid one');
  }

  return axios.post(`${process.env.JIM_SERVER}/api/v1/signin`, dataLogin)
      .then((response) => {
        defaultHeader.headers.Authorization = `Bearer ${response.data.token}`;
        return gravity.getAccountProperties({ recipient: account })
      })
      .then((userProperties) => {
        const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));

        if (!profilePicture || !profilePicture.value) {
          throw new Error('The account does not have profile picture');
        }
        return profilePicture.value;
      })
      .then((profilePicUrl) => {
        //@TODO cannt assume the url is what you are expecting!
        const urlArray = profilePicUrl.split('/');
        if(urlArray.length == 0){
          throw new Error('Theres a problem with the jim image url');
        }
        const id = urlArray.pop();
        return axios.delete(`${process.env.JIM_SERVER}/api/v1/file/${id}`, defaultHeader);
      })
      .then(() => {
        const accountPropertyParams = {
          passphrase,
          recipient: account,
          value: '',
          feeNQT: accountPropertyFee,
          property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
        };
        return gravity.setAcountProperty(accountPropertyParams);
      })
}





module.exports = {

  uploadPixiImageAndWait: async (account, passphrase, encryptionPassword) => {
    logger.debug('uploadPixiImageAndWait()');
    if (!account || !passphrase || !encryptionPassword) {
      logger.debug('Missing parameters required.', account, passphrase, encryptionPassword);
      throw new Error('Missing parameters required.');
    }
    const fileName = 'pixi.jpg';
    const initialPixiImage = fs.readFileSync('./pixi.jpg', {encoding: 'base64'});
    return UploadAnImageButFirstCheckForStorageAndCreateIfMissing(account, passphrase, encryptionPassword, initialPixiImage, fileName);
  },
  // userProfileDelete: (req, res) => {
  //   const { user } = req;
  //   if (!user) {
  //     return res.status(500).json({ msg: 'No user info' });
  //   }
  //   const userAccount = JSON.parse(gravity.decrypt(user.accountData));
  //   const { passphrase, account, password } = userAccount;
  //   const dataLogin = { account, passphrase, password };
  //   const defaultHeader = { headers: { Authorization: '' } };
  //   const addressBreakdown = account.split('-');
  //   axios.post(`${process.env.JIM_SERVER}/api/v1/signin`, dataLogin)
  //       .then((response) => {
  //         defaultHeader.headers.Authorization = `Bearer ${response.data.token}`;
  //         return axios.get(`${process.env.JIM_SERVER}/api/v1/storage`, defaultHeader);
  //       })
  //       .then(() => gravity.getAccountProperties({ recipient: userAccount.account }))
  //       .then((userProperties) => {
  //         const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));
  //
  //         if (!profilePicture || !profilePicture.value) {
  //           throw new Error('The account does not have profile picture');
  //         }
  //         return profilePicture.value;
  //       })
  //       .then((url) => {
  //         const id = url.split('/').pop();
  //         return axios.delete(`${process.env.JIM_SERVER}/api/v1/file/${id}`, defaultHeader);
  //       })
  //       .then(() => {
  //         const accountPropertyParams = {
  //           passphrase,
  //           recipient: account,
  //           value: '',
  //           feeNQT: accountPropertyFee,
  //           property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
  //         };
  //         return gravity.setAcountProperty(accountPropertyParams);
  //       })
  //       .then(() => res.status(200).json({ url: '' }))
  //       .catch((error) => {
  //         logger.debug('Something went wrong', error);
  //         res.status(500).json(errorMessageHandler(error));
  //       });
  // },

  deleteUserProfile: (req, res) => {
    const { user } = req;
    if (!user) {
      return res.status(500).json({ msg: 'No user info' });
    }
    const userAccount = JSON.parse(gravity.decrypt(user.accountData));
    const { passphrase, account, password } = userAccount;

    profileDelete(passphrase, account, password)
        .then(() => res.status(200).json({ url: '' }))
        .catch((error) => {
          logger.debug('Something went wrong', error);
          res.status(500).json(errorMessageHandler(error));
        });
  },

  deleteChannelProfile: (req, res) => {
    const { channel } = req;

    if (!channel) {
      return res.status(500).json({ msg: 'No channel info' });
    }
    const { passphrase, account, password } = channel.channel_record;

    profileDelete(passphrase, account, password)
        .then(() => res.status(200).json({ url: '' }))
        .catch((error) => {
          logger.debug('Something went wrong', error);
          res.status(500).json(errorMessageHandler(error));
        });
  },


  //@TODO pass in channel not req
  channelProfileDisplay: (req, res) => {
    const { channel } = req;

    if (!channel) {
      return res.status(500).json({ msg: 'No channel info' });
    }

    gravity.getAccountProperties({ recipient: channel.channel_record.account })
      .then((userProperties) => {
        const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));
        const url = profilePicture && profilePicture.value ? profilePicture.value : null;
        const response = typeof url === 'string' && url.includes('threshold') ? { url: null } : { url };
        res.send(response);
      })
      .catch((error) => {
        logger.debug('Something went wrong', error);
        res.status(500).json(errorMessageHandler(error));
      });
  },
  channelProfileUpload: (req, res) => {
    logger.debug('[channelProfileUpload]: Start');
    const { user, channel } = req;
    const { passphrase, account, password } = channel.channel_record;
    const fileBase64Encoded = req.body.base64Image;
    const fileName = user.userData.account;
    const addressBreakdown = account.split('-');

    if (!(fileBase64Encoded) || !channel || !fileName) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    UploadAnImageButFirstCheckForStorageAndCreateIfMissing(account, passphrase, password, fileBase64Encoded, fileName)
      .then((response) => {
        logger.debug(`jupiterUpload().then()`)
        const { url } = response.data;
        const accountPropertyParams = {
          passphrase,
          recipient: account,
          value: url,
          feeNQT: accountPropertyFee,
          property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
        };

        logger.debug(JSON.stringify(accountPropertyParams));

        return Promise.all([url, gravity.setAcountProperty(accountPropertyParams)]);
      })
      .then((response) => {
        logger.debug(`jupiterUpload().then().then()`)
        // logger.debug(response)
        const [url, accountPropertyResponse] = response;
        if (accountPropertyResponse && accountPropertyResponse.errorDescription) {
          logger.debug('Catch error from JIM server:' + accountPropertyResponse.errorDescription)
          throw new Error(accountPropertyResponse.errorDescription);
        }
        res.status(200).json({ url });
      })
      .catch((error) => {
        logger.debug('Something went wrong', error);
        const response = errorMessageHandler(error);
        res.status(400).send(response);
      });
  },
  userProfileUpload: (req, res) => {
    logger.debug('[userProfileUpload]: Start');
    const { user } = req;
    if (!user) {
      return res.status(500).json({ msg: 'No user info' });
    }
    const userAccount = JSON.parse(gravity.decrypt(user.accountData));
    const { passphrase, account, encryptionPassword } = userAccount;
    const fileBase64Encoded = req.body.base64Image;
    const fileName = userAccount.account;
    const addressBreakdown = account.split('-');  // ex JUP-D5A4-2LSA-8VLJ-6MGJM

    if(addressBreakdown.length !== 5 ){
      return res.status(500).json({msg: 'Internal Error'});
    }

    if (!(fileBase64Encoded) || !user || !fileName) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    UploadAnImageButFirstCheckForStorageAndCreateIfMissing(account, passphrase, encryptionPassword, fileBase64Encoded, fileName)
        .then((response) => {
          const { url } = response.data;
          const accountPropertyParams = {
            passphrase,
            recipient: account,
            value: url,
            feeNQT: accountPropertyFee,
            property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
          };
          return Promise.all([url, gravity.setAcountProperty(accountPropertyParams)]);
        })
        .then((response) => {
          const [url, accountPropertyResponse] = response;
          if (accountPropertyResponse && accountPropertyResponse.errorDescription) {
            throw new Error(accountPropertyResponse.errorDescription);
          }
          logger.debug('[jupiterUpload]:', url);
          res.status(200).json({ url });
        })
        .catch((error) => {
          logger.debug('Something went wrong', error);
          res.status(500).json(errorMessageHandler(error));
        });
  },
  jimSignin: (req, res) =>{
    const { user } = req;
    if (!user) {
      return res.status(500).json({ msg: 'No user info' });
    }
    const userAccount = JSON.parse(gravity.decrypt(user.accountData));
    const { passphrase, account, encryptionPassword } = userAccount;
    const dataLogin = { account, passphrase, password: encryptionPassword };

    axios.post(`${process.env.JIM_SERVER}/api/v1/signin`, dataLogin)
      .then((response) => {
        if (response && response.data && response.data.token){
          return res.status(200).json(response.data.token);
        }

        return res.status(500).json({msg: 'Error generating token'});
      })
      .catch((error) => {
        logger.debug('Something went wrong whit JIM login', error);
        res.status(500).json({ msg: 'Something went wrong whit JIM login', error });
      });
  },
  userProfileDisplay: (req, res) => {
    const { user } = req;
    if (!user) {
      return res.status(500).json({ msg: 'No user info' });
    }
    const userAccount = JSON.parse(gravity.decrypt(user.accountData));

    gravity.getAccountProperties({ recipient: userAccount.account })
      .then((userProperties) => {
        const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));
        const url = profilePicture && profilePicture.value ? profilePicture.value : null;
        const response = url === '{"threshold":"25000"}' ? { url: null } : { url };
        res.send(response);
      })
      .catch((error) => {
        logger.debug('Something went wrong', error);
        res.status(500).json(errorMessageHandler(error));
      });
  },
  fileUpload: (req, res) => {
    logger.debug('[fileUpload]: Start');
    const { user, channel } = req;
    const fileBase64Encoded = req.body.file.data;
    const fileName = req.body.file.name;
    const messageObj = req.body.message.data;

    if (!(fileBase64Encoded) || !channel || !fileName) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    UploadAnImageButFirstCheckForStorageAndCreateIfMissing(
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
        return messageModel.sendRecord(userData, tableData, messageModel.record);
      })
      .then(() => metis.getMember({
        channel: channel.channel_record.account,
        account: channel.channel_record.publicKey,
        password: channel.channel_record.password,
      }))
      .then(({ memberProfilePicture }) => {
        if (Array.isArray(memberProfilePicture) && memberProfilePicture.length > 0) {
          const pnTitle = `${channel.channel_record.name}`;
          const senderName = user.userData.alias;
          const message = `${senderName} sent an image`;

          const channelMembers = memberProfilePicture.map(member => member.accountRS);
          const membersWithoutSender = channelMembers.filter(member => member !== senderName);
          getPNTokensAndSendPushNotification(membersWithoutSender, senderName, channel, message, pnTitle, {});
        }
      })
      .then(() => res.status(200).json({}))
      .catch((error) => {
        logger.debug('Something went wrong', error);
        res.status(500).json(errorMessageHandler(error));
      });
  },

  // userStorageCreate: async (account, passphrase, encryptionPassword) => {
  //   logger.debug('[userStorageCreate]: Start');
  //   await uploadPixiImageAndWait(account, passphrase, encryptionPassword);
  //   logger.debug('[userStorageCreate]: Creating...');
  // },
  // channelStorageCreate: async (account, passphrase, encryptionPassword) => {
  //   logger.debug('[channelStorageCreate]: Start');
  //   await uploadPixiImageAndWait(account, passphrase, encryptionPassword);
  //   logger.debug('[channelStorageCreate]: Creating...');
  // },
};
