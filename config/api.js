import find from 'find';
import jwt from 'jsonwebtoken';
import { gravity } from './gravity';
import ChannelRecord from "../models/channel.js";
const logger = require('../utils/logger')(module);

const getModelFilePath = tableName => {
  const fileMatchRegex = new RegExp(`.*[\/ | \\\\]${tableName}\\.js`, 'g');
  console.log('fileMatchRegex =', fileMatchRegex);
  console.log('testing fileSync =', find.fileSync(fileMatchRegex, './models'));
  const filePathArray = find.fileSync(fileMatchRegex, './models');
  if(filePathArray && filePathArray.length) {
    const filePath = filePathArray[0];
    console.log('filePath:', filePath);
    const fileFullPath = `../${filePath}`;
    return fileFullPath;
  }
  return;
};

const sendSuccessResponse = ({req, res, data, statusCode=200}) => {
  logger.info(`Request ${req.method} ${req.originalUrl} is responded with success response: ${JSON.stringify(data)}`);
  return res.status(statusCode).send({
    success: true,
    data
  });
};

const sendFailureResponse = ({req, res, error, statusCode=500}) => {
  logger.error(`Request ${req.method} ${req.originalUrl} is responded with error response: ${JSON.stringify(error)}`);
  return res.status(statusCode).send({
    success: false,
    errors: error.errors
  });
}

// This file handles the app's different pages and how they are routed by the system

module.exports = (app) => {
  // let bcrypt = require('bcrypt-nodejs');
  // let session = require('express-session');
  // let flash = require('connect-flash');
  // let Queue = require('bull');
  // let controller = require('../config/controller.js');

  // ===========================================================
  // This constains constants needed to connect with Jupiter
  // ===========================================================
  // Loads Gravity module
  // let gravity = require('../config/gravity.js');


  // ===============================================================================
  //  API GENERAL ROUTES
  // ===============================================================================

  /**
   * Get alias
   */
  app.get('/v1/api/jupiter/alias/:aliasName', async (req, res) => {
    const aliasCheckup = await gravity.getAlias(req.params.aliasName);
    return sendSuccessResponse({req, res, data: aliasCheckup});
  });

  /**
   * Get a table associated with a user
   */
  app.get('/v1/api/users/:id/:tableName', (req, res, next) => {
    const { tableName } = req.params;
    const exceptions = ['users'];
    // If table in route is in the exception list, then it goes lower in the route list
    if (exceptions.includes(tableName)) {
      next();
    } else {
      const fileFullPath = getModelFilePath(tableName);
      if(!fileFullPath) {
        const error = {
          errors: `couldn't find the table ${ tableName }`
        }
        return sendFailureResponse({req, res, error});
      }
      const { id, publicKey, accountData } = req.user;   
      logger.info(req.user);
      const Record = require(fileFullPath);

      // We verify the user data here
      const recordObject = new Record({
        user_id: id,
        public_key: publicKey,
        user_api_key: publicKey,
      });

      logger.info('\n\nGRAVITY DECRYPT\n\n\n');
      recordObject.loadRecords(JSON.parse(gravity.decrypt(accountData)))
        .then((response) => {
          const { records } = response;
          gravity.sortByDate(records);
          const responseData = {
            [tableName]: records, 
            [`total_${tableName}_number`]: response.records_found 
          };
          return sendSuccessResponse({req, res, data: responseData})
        })
        .catch((error) => {
          return sendFailureResponse({req, res, error});
        });
    }
  });


  /**
   * Get channel records associated with a user
   */
  app.get('/v1/api/users/channels', (req, res, next) => {
    const { tableName } = req.params;
    const exceptions = ['users'];
    // If table in route is in the exception list, then it goes lower in the route list
    if (exceptions.includes(tableName)) {
      next();
    } else {
      const ChannelRecord = require('../models/channel.js');
      const { id, publicKey, accountData } = req.user;
      // We verify the user data here
      const channelRecord = new ChannelRecord({
        user_id: id,
        public_key: publicKey,
        user_api_key: publicKey,
      });

      const userData = JSON.parse(gravity.decrypt(accountData));
      channelRecord.loadRecords(userData)
        .then((response) => {
          const { records } = response;
          gravity.sortByDate(records);
          if (records) {
            return records.map((channel) => {
              const token = jwt.sign({ ...channel }, process.env.SESSION_SECRET);
              return { ...channel, token };
            });
          }
          return records;
        })
        .then(channelList => {
          const responseData = {
            channels: channelList,
            total_channels_number: channelList.length,
          }
          return sendSuccessResponse({req, res, data: responseData});
        })
        .catch(error => {
          return sendFailureResponse({req, res, error});
        });
    }
  });

  /**
   * Create a record, assigned to the current user
   */
  app.post('/v1/api/create/:tableName', (req, res, next) => {
    logger.verbose(`app.post(/v1/api/create/:tableName)`);
    const { tableName } = req.params;
    // If table in route is in the exception list, then it goes lower in the route list
    const exceptions = ['users'];
    if (exceptions.includes(tableName)) {
      next();
    } else {
      const fileFullPath = getModelFilePath(tableName);
      if(!fileFullPath) {
        error = {
          errors: `couldn't find the table ${ tableName }`
        };
        return sendFailureResponse({req, res, error});
      }
      const Record = require(fileFullPath);
      let { data } = req.body;
      const { id, accessKey, accountData, userData } = req.user;
      const decryptedAccountData = JSON.parse(gravity.decrypt(accountData));
      logger.sensitive(`userData = ${ JSON.stringify(decryptedAccountData)}`);

      data = {
        ...data,
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
      const recordObject = new Record(data);
      if (recordObject.belongsTo === 'user' && accountData) {
        recordObject.accessLink = accountData;
      }
      recordObject.create()
        .then(response => {
          return sendSuccessResponse({req, res, data: response});
        })
        .catch(error => {
          return sendFailureResponse({req, res, error});
        });      
    }
  });

  app.get('/v1/api/:account/channel', (req, res, next) => {
    const { user } = req;
    const { account } = req.params;

    // We verify the user data here
    const channelRecord = new ChannelRecord({
      user_id: user.id,
      public_key: user.publicKey,
      user_api_key: user.publicKey,
    });

    const userData = JSON.parse(gravity.decrypt(user.accountData));
    channelRecord.loadChannelByAddress(account, userData)
        .then(channel => {
          const token = jwt.sign({ ...channel }, process.env.SESSION_SECRET);
          return { ...channel, token };
        })
        .then(channel => res.status(200).send({ success: true, channel }))
        .catch((error) => {
          logger.error('[Channel id]->[loadRecords]:');
          logger.error(error);
          res.status(500).send({ success: false, error });
        });
  });

  /**
   * Update a record, assigned to the current user
   */
  app.put('/v1/api/:tableName', (req, res, next) => {
    const { tableName } = req.params;
    const exceptions = ['users'];

    // If table in route is in the exception list, then it goes lower in the route list
    if (exceptions.includes(tableName)) {
      next();
    } else {
      const fileFullPath = getModelFilePath(tableName);
      if(!fileFullPath) {
        const error = {
          errors: `couldn't find the table ${ tableName }`
        };
        return sendFailureResponse({req,res, error})
      }
      const Record = require(fileFullPath);

      const { data } = req.body;
      // We verify the user data here
      const recordObject = new Record(data);

      recordObject.update()
        .then(response => {
          return sendSuccessResponse({req, res, data: response})
        })
        .catch(error => {
          return sendFailureResponse({req, res, error})
        });
    }
  });
};
