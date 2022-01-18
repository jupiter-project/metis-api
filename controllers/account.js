import axios from 'axios';
import { gravity } from '../config/gravity';
import controller from '../config/controller';
import User from '../models/user';
import {JupiterAPIService} from "../services/jupiterAPIService";
import {FeeManager, feeManagerSingleton} from "../services/FeeManager";
import {FundingManager, fundingManagerSingleton} from "../services/fundingManager";
import {ApplicationAccountProperties} from "../gravity/applicationAccountProperties";
import {instantiateGravityAccountProperties} from "../gravity/instantiateGravityAccountProperties";

const logger = require('../utils/logger')(module);

module.exports = (app, passport, React, ReactDOMServer) => {
  let page;
  const connection = process.env.SOCKET_SERVER;

  app.get('/v1/api/balance', (req, res) => {
    console.log('');
    logger.info('======================================================================================');
    logger.info('==');
    logger.info('== Get Balance');
    logger.info('== GET: ');
    logger.info('==');
    logger.info('======================================================================================');
    console.log('');

    const { user } = req;

    if(!user.address){
      return res.status(400).send({message: 'User account not provided'});
    }

    const TRANSFER_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
    const ACCOUNT_CREATION_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const STANDARD_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const MINIMUM_TABLE_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table);
    const MINIMUM_APP_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user);
    const MONEY_DECIMALS = process.env.JUPITER_MONEY_DECIMALS;
    const DEADLINE = process.env.JUPITER_DEADLINE;


    //@TODO ApplicationAccountProperties class is obsolete. We need to switch to FeeManger and FundingManger
    const appAccountProperties = new ApplicationAccountProperties(
        DEADLINE, STANDARD_FEE, ACCOUNT_CREATION_FEE, TRANSFER_FEE, MINIMUM_TABLE_BALANCE, MINIMUM_APP_BALANCE, MONEY_DECIMALS,
    );
    const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties);
    jupiterAPIService.getBalance(user.address)
        .then(response => {
          if (response && response.data.unconfirmedBalanceNQT){
            return res.status(200).send({ balance: (response.data.unconfirmedBalanceNQT/100000000) });
          }
          return res.status(500).send({message: 'Balance not available'});
        })
        .catch(error => {
          logger.error(`${error}`);
          return res.status(500).send({message: 'Something went wrong', error: `${error}` });
        });
  });

  app.get('/v1/api/recent-transactions', (req, res) => {
    console.log('');
    logger.info('======================================================================================');
    logger.info('==');
    logger.info('== Recent Transactions');
    logger.info('== GET: ');
    logger.info('==');
    logger.info('======================================================================================');
    console.log('');

    const { user } = req;

    if(!user.address){
      return res.status(400).send({message: 'User account not provided'});
    }

    const TRANSFER_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
    const ACCOUNT_CREATION_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const STANDARD_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const MINIMUM_TABLE_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table);
    const MINIMUM_APP_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user);
    const MONEY_DECIMALS = process.env.JUPITER_MONEY_DECIMALS;
    const DEADLINE = process.env.JUPITER_DEADLINE;


    const appAccountProperties = new ApplicationAccountProperties(
        DEADLINE, STANDARD_FEE, ACCOUNT_CREATION_FEE, TRANSFER_FEE, MINIMUM_TABLE_BALANCE, MINIMUM_APP_BALANCE, MONEY_DECIMALS,
    );
    const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties);
    const params = {
      requestType: 'getBlockchainTransactions',
      account: user.address,
      type: 0, // TODO FIGURE OUT WHY TYPE IS STRING
      subtype: 0,
      firstIndex: 0,
      lastIndex: 9,
    };

    //TODO make the "get" function static in order to avoid generating all unnecessary properties
    jupiterAPIService.get(params)
        .then(response => {
          //TODO remove this line once filter by type = 0, subtype = 0
          const transactions = response.data.transactions.filter(txn => txn.type === 0);
          return res.status(200).send({transactions});
        })
        .catch(error => {
          logger.error(`${error}`);
          return res.status(500).send({message: 'Something went wrong', error: `${error}`});
        });
  });

  app.post('/v1/api/transfer-money', async (req, res) => {
    console.log('');
    logger.info('======================================================================================');
    logger.info('==');
    logger.info('== Transfer Money');
    logger.info('== POST: /v1/api/transfer-money');
    logger.info('==');
    logger.info('======================================================================================');
    console.log('');

    const { user } = req;
    console.log('USER data ---->', user);
    let { recipient, amount } = req.body;

    if (!recipient.toLowerCase().includes('jup-')) {
      const aliasResponse = await gravity.getAlias(recipient);
      recipient = aliasResponse.accountRS;
    }

    const TRANSFER_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
    const ACCOUNT_CREATION_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const STANDARD_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const MINIMUM_TABLE_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table);
    const MINIMUM_APP_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user);
    const MONEY_DECIMALS = process.env.JUPITER_MONEY_DECIMALS;
    const DEADLINE = process.env.JUPITER_DEADLINE;

    const appAccountProperties = new ApplicationAccountProperties(
        DEADLINE, STANDARD_FEE, ACCOUNT_CREATION_FEE, TRANSFER_FEE, MINIMUM_TABLE_BALANCE, MINIMUM_APP_BALANCE, MONEY_DECIMALS,
    );
    const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties);
    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    // const fromJupAccount = { address: user.address, passphrase: user.passphrase };
    const fromJupAccount = await instantiateGravityAccountProperties(user.passphrase, user.password);
    const toJupiterAccount = { address: recipient };

    //TODO make the "transferMoney" function static in order to avoid generating all unnecessary properties
    jupiterAPIService.transferMoney(fromJupAccount, toJupiterAccount, +amount, fee)
        .then(() => res.status(200).send({message: 'Transfer successfully executed'}))
        .catch(error => {
          logger.error('Error with the transfer ->' + `${error}`);
          res.status(500).send({message: 'Transfer failed', error: `${error}`});
        });
  });

  // ===========================================================
  // This constains constants needed to connect with Jupiter
  // ===========================================================

  // app.get('/account', controller.isLoggedIn, (req, res) => {
  //   const messages = req.session.flash;
  //   req.session.flash = null;
  //   const AccountPage = require('../views/account.jsx');
  //   page = ReactDOMServer.renderToString(
  //     React.createElement(AccountPage, {
  //       connection,
  //       messages,
  //       name: 'Metis - Profile',
  //       user: req.user,
  //       dashboard: true,
  //       public_key: req.session.public_key,
  //     }),
  //   );
  //   res.send(page);
  // });


  // app.get('/api/account', controller.isLoggedIn, (req, res) => {
  //   gravity.findById(req.user.record.id, 'users', { size: 'last' })
  //     .then((response) => {
  //       const userInfo = JSON.parse(response.record.user_record);
  //       res.send({ success: true, account_info: userInfo, message: 'Retrieved account info' });
  //     })
  //     .catch((error) => {
  //       logger.error(`${error}`);
  //       res.send({ success: false, errors: `${error}` });
  //     });
  // });


  // ===============================================================================
  // UPDATE ACCOUNT INFORMATION
  // ===============================================================================
  // app.put('/account', (req, res) => {
  //   // This sets the content-type of response
  //   res.setHeader('Content-Type', 'application/json');
  //   const params = req.body.account;
  //   /* const data = req.user.record;
  //   data.firstname = params.firstname;
  //   data.lastname = params.lastname;
  //   data.email = params.email;
  //   data.public_key = req.session.public_key; */
  //
  //   const user = new User(req.user.record, req.session.passport.user);
  //   user.record.firstname = params.firstname;
  //   user.record.lastname = params.lastname;
  //   user.record.email = params.email;
  //   user.record.alias = params.alias;
  //   user.record.public_key = req.session.public_key;
  //
  //   const jupKey = gravity.decrypt(req.session.jup_key);
  //
  //   user.update(jupKey)
  //     .then(() => {
  //       res.send({ success: true, message: 'Account info saved to blockchain', record: user.record });
  //     })
  //     .catch(err => {
  //       logger.error(`${err}`);
  //       res.send(`${err}`);
  //     });
  // });

  // ===============================================================================
  // GET PROPERTIES FROM JUPITER BLOCKCHAIN
  // ===============================================================================
  // app.get('/get_properties', (req, res) => {
  //   // This sets the content-type of response
  //   res.setHeader('Content-Type', 'application/json');
  //
  //   const data = req.body.parameters;
  //
  //   axios.post(`${gravity.jupiter_data.server}/nxt?requestType=GetAccountProperties&recipient='${data.address}`)
  //     .then((response) => {
  //       if (response.data.errorDescription == null) {
  //         res.send({
  //           success: true,
  //           message: 'Properties retrieved',
  //           properties: response.data.properties,
  //           full_response: response.data,
  //         });
  //       } else {
  //         res.send({ success: false, message: response.data.errorDescription });
  //       }
  //     })
  //     .catch((error) => {
  //       logger.error(`${error}`);
  //       res.send({ success: false, message: 'There was an error', error: error.response });
  //     });
  // });

  // ===============================================================================
  // UPDATE User's api key
  // ===============================================================================
  // app.post('/update_api_key', (req, res) => {
  //   const data = req.user.record;
  //   data.public_key = req.session.public_key;
  //   const user = new User(data);
  //
  //   if (user.record.api_key === req.body.api_key) {
  //     user.record.api_key = user.generateKey();
  //     // console.log(user.record.api_key);
  //     user.update()
  //       .then(() => {
  //         res.send({
  //           success: true,
  //           status: 'success',
  //           message: 'Api key updated',
  //           api_key: user.record.api_key,
  //         });
  //       })
  //       .catch((err) => {
  //         logger.error(`${err}`);
  //         res.send({ success: false, message: 'There was an error updating api key' });
  //       });
  //   } else {
  //     const error = {
  //       success: false,
  //       status: 'error',
  //       error: 'Api key provided in request is incorrect',
  //     };
  //     logger.error(`${error}`);
  //     res.send(`${error}`);
  //   }
  // });

  // =======================================================
  // 2FACTOR-AUTHENTICATION SETUP
  // We use route middleware to verify if user is logged in
  // =======================================================
  // app.get('/2fa_setup', controller.onlyLoggedIn, (req, res) => {
  //   const messages = req.session.flash;
  //   req.session.flash = null;
  //
  //   // Loads 2FA configuration page
  //   const SetupPage = require('../views/setup.jsx');
  //
  //   if (req.user.record.twofa_completed != null && req.user.record.twofa_completed !== true) {
  //     page = ReactDOMServer.renderToString(
  //       React.createElement(SetupPage, {
  //         messages,
  //         name: 'Metis - 2FA Setup',
  //         user: req.user,
  //         dashboard: true,
  //       }),
  //     );
  //
  //     res.send(page);
  //   } else {
  //     res.redirect('/');
  //   }
  // });

  // app.get('/2fa_checkup', controller.onlyLoggedIn, (req, res) => {
  //   const messages = req.session.flash;
  //   req.session.flash = null;
  //
  //   //  Page for 2fa checkup
  //   const VerificationPage = require('../views/verification.jsx');
  //
  //   const checkCode = ReactDOMServer.renderToString(
  //     React.createElement(VerificationPage, {
  //       messages,
  //       name: 'Metis - 2FA',
  //       user: req.user,
  //       dashboard: true,
  //     }),
  //   );
  //
  //   res.send(checkCode);
  // });

  // app.post('/start2fa', controller.onlyLoggedIn, (req, res) => {
  //   const speakeasy = require('speakeasy');
  //   const secret = speakeasy.generateSecret({ length: 20, name: (`Gravity: ${req.user.record.account}`) });
  //   const data = req.user.record;
  //   data.secret_key = secret.base32;
  //   data.twofa_enabled = true;
  //   data.public_key = req.session.public_key;
  //
  //   const user = new User(data, req.session.passport.user);
  //
  //   req.session.secret = data.secret_key;
  //   user.update()
  //     .then(() => {
  //       res.send({ user, status: 'success', secret: secret.otpauth_url });
  //     })
  //     .catch((err) => {
  //       logger.error(err);
  //       res.send(err);
  //     });
  // });

  // app.post('/verify_code', controller.onlyLoggedIn, (req, res) => {
  //   const verificationCode = req.body.verification_code;
  //   const userSecretKey = req.user.record.secret_key;
  //   //  verify that the user token matches what it should be at this moment
  //   const speakeasy = require('speakeasy');
  //   const verified = speakeasy.totp.verify({
  //     secret: userSecretKey,
  //     encoding: 'base32',
  //     token: verificationCode,
  //   });
  //   // console.log(verified)
  //   if (verified) {
  //     req.session.twofa_pass = true;
  //     req.flash('generalMessages', 'Passed verification!');
  //     res.send({ status: 'success', message: 'Verification code is correct!' });
  //   } else {
  //     const error = { status: 'error', message: 'Verification code is incorrect!' };
  //     logger.error(`${error}`);
  //     res.send(error);
  //   }
  // });

  // app.post('/verify_code_and_save', controller.onlyLoggedIn, (req, res) => {
  //   const verificationCode = req.body.verification_code;
  //   const userSecretKey = req.session.secret;
  //
  //   // verify that the user token matches what it should be at this moment
  //   const speakeasy = require('speakeasy');
  //   const verified = speakeasy.totp.verify({
  //     secret: userSecretKey,
  //     encoding: 'base32',
  //     token: verificationCode,
  //   });
  //
  //   if (verified) {
  //     const data = req.user.record;
  //     data.secret_key = userSecretKey;
  //     data.public_key = req.session.public_key;
  //     data.twofa_enabled = true;
  //     data.twofa_completed = true;
  //     const user = new User(data, req.session.passport.user);
  //
  //     user.update()
  //       .then(() => {
  //         req.session.twofa_enabled = true;
  //         req.session.twofa_pass = true;
  //         req.session.twofa_completed = true;
  //         res.send({ user, status: 'success', message: 'Authentication succeeded! Update pushed to blockchain for saving.' });
  //       })
  //       .catch((err) => {
  //         logger.error(err);
  //         res.send(err);
  //       });
  //   } else {
  //     const error = { status: 'error', message: 'Verification code is incorrect!' };
  //     logger.error(`${error}`);
  //     res.send(error);
  //   }
  // });


  // app.post('/update_2fa_settings', controller.onlyLoggedIn, (req, res) => {
  //   res.setHeader('Content-Type', 'application/json');
  //   const params = req.body;
  //   const data = req.user.record;
  //   const twofaEnabled = params.enable_2fa === 'true';
  //   data.twofa_enabled = twofaEnabled;
  //   data.public_key = req.session.public_key;
  //   const user = new User(data, req.session.passport.user);
  //
  //   if (twofaEnabled) {
  //     req.flash('loginMessage', 'Begining 2FA');
  //     req.session.twofa_enabled = true;
  //     req.session.twofa_completed = false;
  //     user.record.twofa_enabled = true;
  //     user.record.twofa_completed = false;
  //   } else {
  //     req.session.twofa_enabled = false;
  //     req.flash('loginMessage', '2FA disable update sent to the blockchain. It might take a few minutes for the change to be confirmed.');
  //     user.record.twofa_enabled = false;
  //     user.record.twofa_completed = false;
  //     user.record.secret_key = null;
  //   }
  //
  //   user.update()
  //     .then(() => {
  //       if (twofaEnabled) {
  //         // console.log('This thing triggered');
  //         res.redirect('/2fa_setup');
  //       } else if (user.record.twofa_enabled === false) {
  //         // console.log('This is the other triggered');
  //         res.redirect('/security');
  //       }
  //     })
  //     .catch((err) => {
  //       logger.error(err);
  //       res.redirect('/security');
  //     });
  // });
};
