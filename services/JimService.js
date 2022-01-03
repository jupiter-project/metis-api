import { gravity } from '../config/gravity';
import metis from '../config/metis';
import {FeeManager, feeManagerSingleton} from "./FeeManager";
import {
    instantiateGravityAccountProperties,
    refreshGravityAccountProperties
} from "../gravity/instantiateGravityAccountProperties";
import {chanService} from "./chanService";
import {generateNewMessageRecordJson, createMessageRecord} from "./messageService";
import {StatusCode} from "../utils/statusCode";
const FormData = require('form-data');
const axios = require('axios');
const { getPNTokensAndSendPushNotification, errorMessageHandler } = require('./PushNotificationMessageService');
const accountPropertyFee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_property);  //ACCOUNT_PROPERTY_FEE
const logger = require('../utils/logger')(module);

const getSignInToken = (dataLogin) => {
    logger.sensitive(`#### getSignInToken(dataLogin)`);
  return axios.post(`${process.env.JIM_SERVER}/api/v1/signin`, dataLogin)
      .then((response) => {
        if (!(response && response.data && response.data.token)){
          throw new Error('Error generating token')
        }

        return response.data.token;
      });
}

/**
 *
 * @param accountProperties
 * @param fileBase64Encoded
 * @param fileName
 * @param mimeType
 * @returns {Promise<AxiosResponse>}
 */
const UploadAnImageButFirstCheckForStorageAndCreateIfMissing = (
  accountProperties,
  fileBase64Encoded,
  fileName,
  mimeType
) => {

  const dataLogin = {
    account: accountProperties.address,
    passphrase: accountProperties.passphrase,
    password: accountProperties.password,
  };

  const defaultHeader = {
    headers: {
      Authorization: '',
    },
  };

  // @TODO  In the near future /api/v1/storage will return a jobID so we need to poll for the job.
  // @TODO this code (post:storage) might not be needed anymore since a metis signup will create the storage.
  return getSignInToken(dataLogin)
      .then(token => {
        defaultHeader.headers.Authorization = `Bearer ${token}`;
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
      const formOptions = { filename: fileName, contentType: mimeType };
      form.append('file', buffer, formOptions);
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
        if(urlArray.length === 0){
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
  deleteUserProfile: (req, res) => {
    const { passphrase, password, address } = req.user;
    profileDelete(passphrase, address, password)
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
  channelProfileDisplay: (req, res) => {
      const { channelAddress } = req.params

      if (!channelAddress) {
          return res.status(500).json({ msg: 'No channel address' });
      }

    gravity.getAccountProperties({ recipient: channelAddress })
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
  channelProfileUpload: async (req, res) => {
    logger.debug('[channelProfileUpload]: Start');
      const { address, passphrase, password } = req.user;
      const {
          channelAddress,
          base64Image: fileBase64Encoded,
          mimeType
      } = req.body;

      if (!fileBase64Encoded || !channelAddress) {
          return res.status(400).json({ msg: 'Missing parameters required.' });
      }

      const memberAccountProperties = await instantiateGravityAccountProperties(passphrase, password);
      const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(memberAccountProperties, channelAddress);

      if(!channelAccountProperties){
          return res.status(403).send({message: 'Invalid channel address.'})
      }

    const fileName = address;
    const addressBreakdown = address.split('-');
    UploadAnImageButFirstCheckForStorageAndCreateIfMissing(channelAccountProperties, fileBase64Encoded, fileName, mimeType)
      .then((response) => {
        logger.debug(`jupiterUpload().then()`)
        const { url } = response.data;
        const accountPropertyParams = {
          passphrase,
          recipient: channelAddress,
          value: url,
          feeNQT: accountPropertyFee,
          property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
        };

        logger.debug(JSON.stringify(accountPropertyParams));
        return Promise.all([url, gravity.setAcountProperty(accountPropertyParams)]);
      })
      .then((response) => {
        logger.debug(`jupiterUpload().then().then()`)
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
  userProfileUpload: async (req, res) => {
    logger.debug('[userProfileUpload]: Start');
    const { passphrase, password, address } = req.user;
    const { base64Image: fileBase64Encoded, mimeType } = req.body;

    const fileName = address;
    const addressBreakdown = address.split('-');

    if(addressBreakdown.length !== 5 ){
      return res.status(500).json({msg: 'Internal Error'});
    }

    if (!fileBase64Encoded) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    const memberAccountProperties = await instantiateGravityAccountProperties(passphrase, password);
    UploadAnImageButFirstCheckForStorageAndCreateIfMissing(memberAccountProperties, fileBase64Encoded, fileName, mimeType)
        .then((response) => {
          const { url } = response.data;
          const accountPropertyParams = {
            passphrase,
            recipient: address,
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
      logger.sensitive(`#### jimSignIn(req,res)`);
      const { address, password, passphrase } = req.user;
      const dataLogin = { account: address, passphrase, password };
      getSignInToken(dataLogin)
        .then(token => res.status(StatusCode.SuccessOK).json(token))
        .catch((error) => {
        logger.debug(`Something went wrong whit JIM login: ${error}`);
        res.status(StatusCode.ServerErrorInternal).json({ msg: 'Something went wrong whit JIM login'});
      });
  },

  jimChannelSignIn: async (req, res) => {
    const { passphrase, password } = req.user;
    const { channelAddress } = req.body;

    const memberAccountProperties = await instantiateGravityAccountProperties(passphrase, password);
    const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(memberAccountProperties, channelAddress);

    if(!channelAccountProperties){
      return res.status(403).send({message: 'Invalid channel address.'})
    }

    const dataLogin = {
      account: channelAccountProperties.address,
      passphrase: channelAccountProperties.passphrase,
      password: channelAccountProperties.password,
    };

    getSignInToken(dataLogin)
        .then(token => res.status(200).json(token))
        .catch((error) => {
          logger.debug('Something went wrong whit JIM login', error);
          res.status(500).json({ msg: 'Something went wrong whit JIM login', error });
        });
  },
  userProfileDisplay: (req, res) => {
    const { address } = req.user;

    gravity.getAccountProperties({ recipient: address })
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

  fileUpload: async (req, res) => {
    logger.debug('[fileUpload]: Start');
    const { user } = req;
    const {
      channelAddress,
      message: messageObj,
      file: fileBase64Encoded
    } = req.body;
    const fileName = fileBase64Encoded.name;

    if (!fileBase64Encoded || !channelAddress || !fileName) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    const memberAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);
    const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(memberAccountProperties, channelAddress);

    if(!channelAccountProperties){
      return res.status(403).send({message: 'Invalid channel address.'})
    }

      if(channelAccountProperties.isMinimumProperties){
          await refreshGravityAccountProperties(channelAccountProperties);
      }

    UploadAnImageButFirstCheckForStorageAndCreateIfMissing(
        channelAccountProperties,
        fileBase64Encoded.data,
        fileName,
        fileBase64Encoded.type
        )
      .then(async (response) => {
        logger.info('UploadAnImageButFirstCheckForStorageAndCreateIfMissing.then()');
        logger.debug(JSON.stringify(response.data))
        if (!response.data) {
          throw new Error('Error trying to save image');
        }

        return createMessageRecord(
            memberAccountProperties,
            channelAccountProperties,
            messageObj.message,
            messageObj.type,
             messageObj.replyMessage,
             messageObj.replyRecipientAlias,
             null,
             response.data,
             messageObj.version,
          );
        // websocket.of('/chat').to(channelAddress).emit('createMessage', { message: messageRecord })
        // return sendMetisMessage(memberAccountProperties, channelAccountProperties, messageRecord);
      })
      .then(() => metis.getMember({
        channel: channelAccountProperties.address,
        account: channelAccountProperties.publicKey,
        password: channelAccountProperties.password,
      }))
      .then(({ memberProfilePicture }) => {
        if (Array.isArray(memberProfilePicture) && memberProfilePicture.length > 0) {
          const pnTitle = `${channelAccountProperties.firstName}`;
          const senderName = user.userData.alias;
          const message = `${senderName} sent an image`;

          const channelMembers = memberProfilePicture.map(member => member.accountRS);
          const membersWithoutSender = channelMembers.filter(member => member !== senderName);
          getPNTokensAndSendPushNotification(membersWithoutSender, senderName, channelAddress, message, pnTitle, {});
        }
      })
      .then(() => res.status(200).json({}))
      .catch((error) => {
        logger.debug('Something went wrong', error);
        res.status(500).json(errorMessageHandler(error));
      });
  }
};
