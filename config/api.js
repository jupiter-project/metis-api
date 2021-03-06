import find from 'find';
import jwt from 'jsonwebtoken';
import { gravity } from './gravity';
import ChannelRecord from "../models/channel.js";
const logger = require('../utils/logger')(module);


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
    console.log('');
    logger.info('======================================================================================');
    logger.info('==');
    logger.info('== Validate alias availability');
    logger.info('== GET');
    logger.info('==');
    logger.info('======================================================================================');
    const aliasCheckup = await gravity.getAlias(req.params.aliasName);
    logger.debug('Is alias available', JSON.stringify(aliasCheckup))
    res.send(aliasCheckup);
  });

  /**
   * Get a table associated with a user
   */
  // app.get('/v1/api/users/:id/:tableName', (req, res, next) => {
  //   const { user } = req;
  //   const { tableName } = req.params;
  //   const exceptions = ['users'];
  //   let model = '';
  //
  //   logger.info(req.user);
  //
  //   // If table in route is in the exception list, then it goes lower in the route list
  //   if (exceptions.includes(tableName)) {
  //     next();
  //   } else {
  //     find.fileSync(/\.js$/, './models').forEach((file) => {
  //       const modelName = file.replace('models/', '').replace('.js', '');
  //       let isIncluded = tableName.includes(modelName);
  //       if (tableName.includes('_')) {
  //         if (!modelName.includes('_')) {
  //           isIncluded = false;
  //         }
  //       }
  //       if (isIncluded) {
  //         model = modelName;
  //       }
  //     });
  //
  //     const file = `../models/${model}.js`;
  //
  //     const Record = require(file);
  //
  //     // We verify the user data here
  //     const recordObject = new Record({
  //       user_id: user.id,
  //       public_key: user.publicKey,
  //       user_api_key: user.publicKey,
  //     });
  //
  //     logger.info('\n\nGRAVITY DECRYPT\n\n\n');
  //
  //     recordObject.loadRecords(JSON.parse(gravity.decrypt(user.accountData)))
  //       .then((response) => {
  //         const { records } = response;
  //
  //         gravity.sortByDate(records);
  //         res.send({ success: true, [tableName]: records, [`total_${tableName}_number`]: response.records_found });
  //       })
  //       .catch((error) => {
  //         logger.error('[loadRecords]:');
  //         logger.error(`${error}`);
  //         res.send({ success: false, errors: `${error}` });
  //       });
  //   }
  // });


  /**
   * Get channel records associated with a user
   */
  // app.get('/v1/api/users/channels', (req, res, next) => {
  //   const { user } = req;
  //   const { tableName } = req.params;
  //   const exceptions = ['users'];
  //   // If table in route is in the exception list, then it goes lower in the route list
  //   if (exceptions.includes(tableName)) {
  //     next();
  //   } else {
  //     const ChannelRecord = require('../models/channel.js');
  //
  //     // We verify the user data here
  //     const channelRecord = new ChannelRecord({
  //       user_id: user.id,
  //       public_key: user.publicKey,
  //       user_api_key: user.publicKey,
  //     });
  //
  //     const userData = JSON.parse(gravity.decrypt(user.accountData));
  //     channelRecord.loadRecords(userData)
  //       .then((response) => {
  //         const { records } = response;
  //         gravity.sortByDate(records);
  //         if (records) {
  //           return records.map((channel) => {
  //             const token = jwt.sign({ ...channel }, process.env.SESSION_SECRET);
  //             return { ...channel, token };
  //           });
  //         }
  //         return records;
  //       })
  //       .then((channelList) => {
  //         res.status(200).send({
  //           success: true,
  //           channels: channelList,
  //           total_channels_number: channelList.length,
  //         });
  //       })
  //       .catch((error) => {
  //         logger.error('[loadRecords]:');
  //         logger.error(`${error}`);
  //         res.status(500).send({
  //           success: false,
  //           errors: `${error}`
  //         });
  //       });
  //   }
  // });


  /**
   * Get channel records associated with a user
   */
  // app.get('/v1/api/:account/channel', (req, res, next) => {
  //   const { user } = req;
  //   const { account } = req.params;
  //
  //   // We verify the user data here
  //   const channelRecord = new ChannelRecord({
  //     user_id: user.id,
  //     public_key: user.publicKey,
  //     user_api_key: user.publicKey,
  //   });
  //
  //   const userData = JSON.parse(gravity.decrypt(user.accountData));
  //   channelRecord.loadChannelByAddress(account, userData)
  //       .then(channel => {
  //         const token = jwt.sign({ ...channel }, process.env.SESSION_SECRET);
  //         return { ...channel, token };
  //       })
  //       .then(channel => res.status(200).send({ success: true, channel }))
  //       .catch((error) => {
  //         logger.error('[Channel id]->[loadRecords]:');
  //         logger.error(`${error}`);
  //         res.status(500).send({ success: false, error });
  //       });
  // });


  /**
   * Create a record, assigned to the current user
   * TODO verify if we can remove this commented code, check table creation commands
   */
  // app.post('/v1/api/create/:tableName', (req, res, next) => {
  //   logger.verbose(`app.post(/v1/api/create/:tableName)`);
  //   const params = req.body;
  //   let { data } = params;
  //   const { tableName } = req.params;
  //   const {
  //     id,
  //     accessKey,
  //     accountData,
  //     userData,
  //   } = req.user;
  //
  //   const decryptedAccountData = JSON.parse(gravity.decrypt(accountData));
  //
  //   logger.sensitive(`userData = ${ JSON.stringify(decryptedAccountData)}`);
  //
  //   const exceptions = ['users'];
  //   let model = '';
  //   data = {
  //     ...data,
  //     address: decryptedAccountData.account,
  //     passphrase: '',
  //     password: '',
  //     public_key: decryptedAccountData.publicKey,
  //     user_address: decryptedAccountData.account,
  //     user_api_key: accessKey,
  //     user_id: id,
  //     sender: userData.account,
  //     createdBy: userData.account,
  //   };
  //
  //   // If table in route is in the exception list, then it goes lower in the route list
  //   if (exceptions.includes(tableName)) {
  //     next();
  //   } else {
  //     find.fileSync(/\.js$/, './models').forEach((file) => {
  //       const modelName = file.replace('models/', '').replace('.js', '');
  //       let isIncluded = tableName.includes(modelName);
  //       if (tableName.includes('_')) {
  //         if (!modelName.includes('_')) {
  //           isIncluded = false;
  //         }
  //       }
  //       if (isIncluded) {
  //         model = modelName;
  //       }
  //     });
  //
  //     const file = `../models/${model}.js`;
  //     const Record = require(file);
  //
  //
  //     const recordObject = new Record(data);
  //     if (recordObject.belongsTo === 'user') {
  //       if (accountData) {
  //         recordObject.accessLink = accountData;
  //       }
  //     }
  //     recordObject.create()
  //       .then((response) => {
  //         res.status(200).send(response);
  //       })
  //       .catch((err) => {
  //         logger.error(`app.post() recordObject.create().catch() ${ JSON.stringify(err)}`);
  //         res.status(500).send({
  //           success: false,
  //           errors: err.errors
  //         });
  //       });
  //   }
  // });

  /**
   * Update a record, assigned to the current user
   */

  // app.put('/v1/api/:tableName', (req, res, next) => {
  //   const params = req.body;
  //   const { data } = params;
  //   const { tableName } = req.params;
  //   const exceptions = ['users'];
  //   let model = '';
  //
  //   // If table in route is in the exception list, then it goes lower in the route list
  //   if (exceptions.includes(tableName)) {
  //     next();
  //   } else {
  //     find.fileSync(/\.js$/, './models').forEach((file) => {
  //       const modelName = file.replace('models/', '').replace('.js', '');
  //       let isIncluded = tableName.includes(modelName);
  //       if (tableName.includes('_')) {
  //         if (!modelName.includes('_')) {
  //           isIncluded = false;
  //         }
  //       }
  //       if (isIncluded) {
  //         model = modelName;
  //       }
  //     });
  //
  //     const file = `../models/${model}.js`;
  //
  //     const Record = require(file);
  //
  //     // We verify the user data here
  //     const recordObject = new Record(data);
  //
  //     recordObject.update()
  //       .then((response) => {
  //         res.send(response);
  //       })
  //       .catch((err) => {
  //         logger.error(err);
  //         res.send(err);
  //       });
  //   }
  // });
};
