import axios from 'axios';
import { gravity } from '../config/gravity';
import controller from '../config/controller';
import User from '../models/user';

const logger = require('../utils/logger')(module);

module.exports = (app) => {
  /**app.get('/api/account', controller.isLoggedIn, (req, res) => {
    gravity.findById(req.user.record.id, 'users', { size: 'last' })
      .then((response) => {
        const userInfo = JSON.parse(response.record.user_record);
        res.send({ success: true, account_info: userInfo, message: 'Retrieved account info' });
      })
      .catch((error) => {
        logger.error(error);
        res.send({ success: false, errors: error });
      });
  });


  // ===============================================================================
  // UPDATE ACCOUNT INFORMATION
  // ===============================================================================
  app.put('/account', (req, res) => {
    // This sets the content-type of response
    res.setHeader('Content-Type', 'application/json');
    const params = req.body.account;
    /* const data = req.user.record;
    data.firstname = params.firstname;
    data.lastname = params.lastname;
    data.email = params.email;
    data.public_key = req.session.public_key; 

    const user = new User(req.user.record, req.session.passport.user);
    user.record.firstname = params.firstname;
    user.record.lastname = params.lastname;
    user.record.email = params.email;
    user.record.alias = params.alias;
    user.record.public_key = req.session.public_key;

    const jupKey = gravity.decrypt(req.session.jup_key);

    user.update(jupKey)
      .then(() => {
        res.send({ success: true, message: 'Account info saved to blockchain', record: user.record });
      })
      .catch((err) => {
        logger.error(err);
        res.send(err);
      });
  });

  // ===============================================================================
  // GET PROPERTIES FROM JUPITER BLOCKCHAIN
  // ===============================================================================
  app.get('/get_properties', (req, res) => {
    // This sets the content-type of response
    res.setHeader('Content-Type', 'application/json');

    const data = req.body.parameters;

    axios.post(`${gravity.jupiter_data.server}/nxt?requestType=getAccountProperties&recipient='${data.address}`)
      .then((response) => {
        if (response.data.errorDescription == null) {
          res.send({
            success: true,
            message: 'Properties retrieved',
            properties: response.data.properties,
            full_response: response.data,
          });
        } else {
          res.send({ success: false, message: response.data.errorDescription });
        }
      })
      .catch((error) => {
        logger.error(error);
        res.send({ success: false, message: 'There was an error', error: error.response });
      });
  });

  // ===============================================================================
  // UPDATE User's api key
  // ===============================================================================
  app.post('/update_api_key', (req, res) => {
    const data = req.user.record;
    data.public_key = req.session.public_key;
    const user = new User(data);

    if (user.record.api_key === req.body.api_key) {
      user.record.api_key = user.generateKey();
      // console.log(user.record.api_key);
      user.update()
        .then(() => {
          res.send({
            success: true,
            status: 'success',
            message: 'Api key updated',
            api_key: user.record.api_key,
          });
        })
        .catch((err) => {
          logger.error(err);
          res.send({ success: false, message: 'There was an error updating api key' });
        });
    } else {
      const error = {
        success: false,
        status: 'error',
        error: 'Api key provided in request is incorrect',
      };
      logger.error(error);
      res.send(error);
    }
  });

  app.post('/start2fa', controller.onlyLoggedIn, (req, res) => {
    const speakeasy = require('speakeasy');
    const secret = speakeasy.generateSecret({ length: 20, name: (`Gravity: ${req.user.record.account}`) });
    const data = req.user.record;
    data.secret_key = secret.base32;
    data.twofa_enabled = true;
    data.public_key = req.session.public_key;

    const user = new User(data, req.session.passport.user);

    req.session.secret = data.secret_key;
    user.update()
      .then(() => {
        res.send({ user, status: 'success', secret: secret.otpauth_url });
      })
      .catch((err) => {
        logger.error(err);
        res.send(err);
      });
  });

  app.post('/verify_code', controller.onlyLoggedIn, (req, res) => {
    const verificationCode = req.body.verification_code;
    const userSecretKey = req.user.record.secret_key;
    //  verify that the user token matches what it should be at this moment
    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: userSecretKey,
      encoding: 'base32',
      token: verificationCode,
    });
    // console.log(verified)
    if (verified) {
      req.session.twofa_pass = true;
      req.flash('generalMessages', 'Passed verification!');
      res.send({ status: 'success', message: 'Verification code is correct!' });
    } else {
      const error = { status: 'error', message: 'Verification code is incorrect!' };
      logger.error(error);
      res.send(error);
    }
  });

  app.post('/verify_code_and_save', controller.onlyLoggedIn, (req, res) => {
    const verificationCode = req.body.verification_code;
    const userSecretKey = req.session.secret;

    // verify that the user token matches what it should be at this moment
    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: userSecretKey,
      encoding: 'base32',
      token: verificationCode,
    });

    if (verified) {
      const data = req.user.record;
      data.secret_key = userSecretKey;
      data.public_key = req.session.public_key;
      data.twofa_enabled = true;
      data.twofa_completed = true;
      const user = new User(data, req.session.passport.user);

      user.update()
        .then(() => {
          req.session.twofa_enabled = true;
          req.session.twofa_pass = true;
          req.session.twofa_completed = true;
          res.send({ user, status: 'success', message: 'Authentication succeeded! Update pushed to blockchain for saving.' });
        })
        .catch((err) => {
          logger.error(err);
          res.send(err);
        });
    } else {
      const error = { status: 'error', message: 'Verification code is incorrect!' };
      logger.error(error);
      res.send(error);
    }
  });


  app.post('/update_2fa_settings', controller.onlyLoggedIn, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const params = req.body;
    const data = req.user.record;
    const twofaEnabled = params.enable_2fa === 'true';
    data.twofa_enabled = twofaEnabled;
    data.public_key = req.session.public_key;
    const user = new User(data, req.session.passport.user);

    if (twofaEnabled) {
      req.flash('loginMessage', 'Begining 2FA');
      req.session.twofa_enabled = true;
      req.session.twofa_completed = false;
      user.record.twofa_enabled = true;
      user.record.twofa_completed = false;
    } else {
      req.session.twofa_enabled = false;
      req.flash('loginMessage', '2FA disable update sent to the blockchain. It might take a few minutes for the change to be confirmed.');
      user.record.twofa_enabled = false;
      user.record.twofa_completed = false;
      user.record.secret_key = null;
    }

    user.update()
      .then(() => {
        if (twofaEnabled) {
          // console.log('This thing triggered');
          res.redirect('/2fa_setup');
        } else if (user.record.twofa_enabled === false) {
          // console.log('This is the other triggered');
          res.redirect('/security');
        }
      })
      .catch((err) => {
        logger.error(err);
        res.redirect('/security');
      });
  });*/
};
