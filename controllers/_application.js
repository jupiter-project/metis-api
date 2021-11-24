import axios from 'axios';
import jwt from 'jsonwebtoken';
import { gravity } from '../config/gravity';
import { gravityCLIReporter } from '../gravity/gravityCLIReporter';
import controller from '../config/controller';
import {jobScheduleService} from '../services/jobScheduleService';
import {jupiterAccountService} from "../services/jupiterAccountService";
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";
const logger = require('../utils/logger')(module);
const bcrypt = require("bcrypt-nodejs");

// This files handles the app's different pages and how they are routed by the system

module.exports = (app, passport, React, ReactDOMServer) => {
  /* var bcrypt = require('bcrypt-nodejs');
    var session = require('express-session');
    var flash = require('connect-flash');
    var Queue = require('bull'); */

  // ===========================================================
  // This constains constants needed to connect with Jupiter
  // ===========================================================
  // Loads Gravity module
  let page;

  const connection = process.env.SOCKET_SERVER;

  app.get('/test', (req, res) => {
    res.send({ success: true });
  });

  // ===========================================================
  // This constains the versions
  // ===========================================================
  // Loads versions
  app.get('/v1/api/version', (req, res) => {
    console.log('');
    logger.info('======================================================================================');
    logger.info('==');
    logger.info('== Get Version');
    logger.info('== GET: /v1/api/version');
    logger.info('==');
    logger.info('======================================================================================');
    console.log('');

    const os = require('os');
    const hostname = os.hostname();
    const jupiInfoUrl = `${process.env.JUPITERSERVER}/nxt?=%2Fnxt&requestType=getBlockchainStatus`;
    axios.get(jupiInfoUrl)
      .then((response) => {

        const version = [
          { name: 'Metis App Version', version: '1.1.2' },
          { name: 'Metis Server Version', version: process.env.VERSION },
          { name: 'Jupiter Network', version: response.data.isTestnet ? 'testnet' : 'prod' },
          { name: 'Jupiter Version', version: response.data.version },
        ];

        console.log(version);
        res.send(version);
      })
      .catch((error) => {
        logger.error(`${error}`);
        res.send({
          success: false,
          message: 'There was an error getting jupiter version',
        });
      });
  });

    // ===========================================================
  // This constains the aliases from an account
  // ===========================================================
  // Loads aliases
  app.get('/v1/api/aliases', (req, res) => {
    console.log('');
    logger.info('======================================================================================');
    logger.info('==');
    logger.info('== Loads Aliases');
    logger.info('== GET: /v1/api/aliases ');
    logger.info('==');
    logger.info('======================================================================================');
    console.log('');

    const {account} = req.query
    const aliases = `${process.env.JUPITERSERVER}/nxt?requestType=getAliases&account=${account}`;
    res.setHeader('Content-Type', 'application/json');
    axios.get(aliases)
      .then((response) => {
        res.send(response.data);
      })
      .catch((error) => {
        logger.error(`${error}`);
        res.send({
          success: false,
          message: 'There was an error getting aliases from jupiter',
        });
      });
  });


  // =======================================================
  // LOGOUT
  // =======================================================
  app.get('/logout', (req, res) => {
    req.logout();
    req.session.destroy();
    // console.log(req.session);
    res.send('logged out');
    // res.redirect('/');
  });


  // ===============================================================================
  // JUPITER CALLS
  // ===============================================================================

  app.post('/v1/api/get_jupiter_account', (req, res) => {
    console.log('');
    logger.info('======================================================================================');
    logger.info('==');
    logger.info('== Get Jupiter Account');
    logger.info('== POST');
    logger.info('==');
    logger.info('======================================================================================');
    console.log('');

    axios.get(`${gravity.jupiter_data.server}/nxt?requestType=getAccountId&secretPhrase=${req.body.jup_passphrase}`)
      .then((response) => {
        const { accountRS, publicKey } = response.data;
        res.send({
          success: true,
          account: accountRS,
          public_key: publicKey,
        });
      })
      .catch((error) => {
        logger.error(`${error}`);
        res.send({
          success: false,
          message: 'There was an error in verifying the passphrase with the Blockchain',
        });
      });
  });

  // ===============================================================================
  // NEW ACCOUNT GENERATION
  // ===============================================================================

  app.post('/v1/api/create_jupiter_account', (req, res) => {
    console.log('');
    logger.info('======================================================================================');
    logger.info('==');
    logger.info('== New Account Generation');
    logger.info('== POST: /v1/api/create_jupiter_account');
    logger.info('==');
    logger.info('======================================================================================');
    console.log('');

    if(!req.body.account_data){
      return res.send({ success: false, message: 'missing account_data'});
    }
    const accountData = req.body.account_data;
    const passwordHash = bcrypt.hashSync(accountData.encryption_password, bcrypt.genSaltSync(8), null);
    const passphrase = accountData.passphrase;
    res.setHeader('Content-Type', 'application/json');
    axios.get(`${gravity.jupiter_data.server}/nxt?requestType=getAccountId&secretPhrase=${passphrase}`) // will create an account if doesnt exist.
      .then((response) => {
        const jupiterAccount = {
          account: response.data.accountRS,
          public_key: response.data.publicKey,
          alias: response.data.alias,
          accounthash: passwordHash,
          jup_account_id: response.data.account,
          email: accountData.email,
          firstname: accountData.firstname,
          lastname: accountData.lastname,
          twofa_enabled: accountData.twofa_enabled,
        };

        logger.sensitive(`jupiterAccount=${ JSON.stringify(jupiterAccount)}`);

        if (response.data.accountRS == null) {
          res.send({ success: false, message: 'There was an error in saving the trasaction record', transaction: response.data });
        } else {
          res.send({ success: true, message: 'Jupiter account created', account: jupiterAccount });
        }
      })
      .catch((error) => {
        logger.error(`${error}`);
        res.send({ success: false, message: 'There was an error', error: error.response });
      });
  });


  /**
   * SIGNUP
   */
  app.post('/v1/api/signup', (req, res, next) => {
    console.log('');
    logger.info('======================================================================================');
    logger.info('==');
    logger.info('== SignUp');
    logger.info('== POST: /v1/api/signup ');
    logger.info('==');
    logger.info('======================================================================================');
    console.log('');

    passport.authenticate('gravity-signup', (error, user, message) => {
      console.log(error, user, message);
      if (error) {
        console.log(error);
        return res.status(500).send({ success: false, message });
      }
      return res.status(200).send({ success: true, message });
    })(req, res, next);
  });

   /**
   *
   */
    app.get('/v1/api/job/status', (req, res, next) => {
      console.log('');
      logger.info('======================================================================================');
      logger.info('==');
      logger.info('== Job Status');
      logger.info('== GET: /v1/api/job/status ');
      logger.info('==');
      logger.info('======================================================================================');
      console.log('');

      const {jobId} = req.query;
      const callback = function(err, job) {
        if(!err){
          return res.status(200).send({ success: true, status: job.state() });
        } else {
          console.log(err);
          return res.status(404).send({ success: false, status: `Problem with job id: ${jobId}` });
        }
      }
      jobScheduleService.checkJobStatus(jobId, callback);
    });


    app.put('/v1/api/publicKey', async (req, res) => {
      console.log('');
      logger.info('======================================================================================');
      logger.info('==');
      logger.info('== Add Publickey');
      logger.info('== PUT: /v1/api/publicKey ');
      logger.info('==');
      logger.info('======================================================================================');
      console.log('');

      const { user } = req;
      const { userPublicKey } = req.body;

      if (!userPublicKey){
        return res.status(400).send({ successful: false, message: 'User public key is required' });
      }

      const userProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(user.passphrase, user.password);

     jupiterAccountService.addPublicKeyToUserAccount(userPublicKey, userProperties)
         .then(() => jupiterAccountService.updateAllMemberChannelsWithNewPublicKey(userProperties, userPublicKey))
         .then(() =>
             res.status(200).send({ successful: true, message: 'Public key was successfully added' })
         )
         .catch(error => {
           // TODO move 'PUBLIC-KEY_EXIST' to constants file
           if (error && error.code && error.code === 'PUBLIC-KEY_EXIST'){
             return res.status(200).send({ successful: true, message: error.message })
           }

           logger.error('Error adding public key');
           console.log(error);
           res.status(500).send({successful: false, message: `${error}`})
         })
    });

  /**
   *  Login
   */
  app.post('/v1/api/appLogin', (req, res, next) => {
    console.log('');
    logger.info('======================================================================================');
    logger.info('== Login');
    logger.info('== POST: /v1/api/appLogin');
    logger.info('======================================================================================');
    console.log('');

    logger.sensitive(`headers= ${JSON.stringify(req.headers)}`);

    passport.authenticate('gravity-login', (error, user, message) => {
      logger.debug('passport.authentication(CALLBACK).');

      if (error) {
        logger.error(`Error! ${error}`);
        return next(error);
      }

      if (!user) {
        const errorMessage = 'There was an error in verifying the passphrase with the Blockchain';
        logger.error(errorMessage);

        return res.status(400).json({
          success: false,
          message: errorMessage,
        });
      }

      let accountData = {};
      try {
        logger.verbose('attempting to decrypt the accountData');
        accountData = JSON.parse(gravity.decrypt(user.accountData));
      } catch (error) {
        const errorMessage = 'Unable to decrypt your data.';
        gravityCLIReporter.addItem('Account Data', 'Unable to decrypt Account Data');
        return res.status(400).json({
          success: false,
          message: errorMessage,
        });
      }

      const token = jwt.sign(
        { ...user },
        process.env.SESSION_SECRET, {
          expiresIn: process.env.JWT_TOKEN_EXPIRATION,
        },
      );
      const userContainer = {
        id: user.id,
        profilePictureURL: user.profilePictureURL,
        alias: user.userData.alias,
        account: user.userData.account,
      };


      res.status(200).send({ user: userContainer, token });
    })(req, res, next);
  });

  // ===============================================================================
  // GET PASSPHRASE
  // ===============================================================================
  app.get('/create_passphrase', (req, res) => {
    const seedphrase = gravity.generate_passphrase();
    res.send({ success: true, result: seedphrase, message: 'Passphrase generated' });
  });
};
