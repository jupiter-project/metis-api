import axios from 'axios';
import jwt from 'jsonwebtoken';
import { gravity } from '../config/gravity';
import {jupiterAPIService} from "../services/jupiterAPIService";
import {JupiterApiError, MetisError} from "../errors/metisError";
import {StatusCode} from "../utils/statusCode";
// import {chanService} from "../services/chanService";
// import {axiosDefault} from "../config/axiosConf";
import {MetisErrorCode} from "../utils/metisErrorCode";
import {metisConf} from "../config/metisConf";
const logger = require('../utils/logger')(module);
const bcrypt = require("bcrypt-nodejs");
const mError = require("../errors/metisError");
const gu = require("../utils/gravityUtils");
const jupiterServer = metisConf.appJupiterServerUrl;

module.exports = (app, passport, jobs, websocket) => {
  // const connection = process.env.SOCKET_SERVER;
  // app.get('/test', (req, res) => {
  //   res.send({ success: true });
  // });

  // =======================================================
  // LOGOUT
  // =======================================================
  // app.get('/logout', (req, res) => {
  //   req.logout();
  //   req.session.destroy();
  //   // console.log(req.session);
  //   res.send('logged out');
  //   // res.redirect('/');
  // });


  // ===============================================================================
  // JUPITER CALLS
  // ===============================================================================

  // app.post('/v1/api/get-jupiter-account', (req, res) => {
  //   console.log('');
  //   logger.info('======================================================================================');
  //   logger.info('==');
  //   logger.info('== Get Jupiter Account');
  //   logger.info('== POST');
  //   logger.info('==');
  //   logger.info('======================================================================================');
  //   console.log('');
  //
  //   axios.get(`${gravity.jupiter_data.server}/nxt?requestType=getAccountId&secretPhrase=${req.body.jup_passphrase}`)
  //     .then((response) => {
  //       const { accountRS, publicKey } = response.data;
  //       res.send({
  //         success: true,
  //         account: accountRS,
  //         public_key: publicKey,
  //       });
  //     })
  //     .catch((error) => {
  //       logger.error(`${error}`);
  //       res.send({
  //         success: false,
  //         message: 'There was an error in verifying the passphrase with the Blockchain',
  //       });
  //     });
  // });

  // ===============================================================================
  // NEW ACCOUNT GENERATION
  // ===============================================================================

  app.post('/v1/api/create-jupiter-account', async (req, res) => {
      logger.info(`\n\n`);
      logger.info('======================================================================================');
      logger.info('==');
      logger.info('== New Account Generation');
      logger.info('== POST: /v1/api/create-jupiter-account');
      logger.info('==');
      logger.info(`======================================================================================\n\n`);

      try {
        if (!req.body.account_data) {
          return res.status(500).send({message: 'missing account_data'});
        }
        const accountData = req.body.account_data;
        const passwordHash = bcrypt.hashSync(accountData.encryption_password, bcrypt.genSaltSync(8), null);
        const passphrase = accountData.passphrase;
        const getAccountIdResponse = await jupiterAPIService.getAccountId(passphrase);
        const jupiterAccount = {
          account: getAccountIdResponse.data.accountRS,
          public_key: getAccountIdResponse.data.publicKey,
          alias: getAccountIdResponse.data.alias,
          accounthash: passwordHash,
          jup_account_id: getAccountIdResponse.data.account,
          email: accountData.email,
          firstname: accountData.firstname,
          lastname: accountData.lastname,
          twofa_enabled: accountData.twofa_enabled,
        };
        if (getAccountIdResponse.data.accountRS === null) {
          return res.status(StatusCode.ServerErrorInternal).send({
            message: 'There was an error in saving the trasaction record',
            transaction: getAccountIdResponse.data
          });
        } else {
          return res.send({message: 'Jupiter account created', account: jupiterAccount});
        }
      } catch(error) {
        logger.error(`****************************************************************`);
        logger.error(`** /v1/api/create-jupiter-account.catch(error)`);
        console.log(error)

        if(error instanceof JupiterApiError){
          return res.status(StatusCode.ServerErrorInternal).send({ message: `Internal Error`});
        }

        return res.status(StatusCode.ServerErrorInternal).send({ message: `There was an error: ${error.response}`});
      }
    })


  // /**
  //  * SIGNUP V1
  //  */
  // app.post('/v1/api/signup', (req, res, next) => {
  //   console.log(`\n\n`);
  //   logger.info('======================================================================================');
  //   logger.info('== SignUp');
  //   logger.info('== POST: /v1/api/signup ');
  //   logger.info(`======================================================================================\n\n`);
  //   passport.authenticate('gravity-signup', (error, jobId, _) => {
  //     if (error) {
  //       console.log(error);
  //       return res.status(StatusCode.ServerErrorInternal).send({ jobId: jobId });
  //     }
  //     return res.status(StatusCode.SuccessOK).send({
  //       job: {
  //         id: jobId,
  //         href: `/v1/api/job/status?jobId=${jobId}`,
  //       }
  //     });
  //   })(req, res, next);
  // });



  // /**
  //  *  Login
  //  */
  // app.post('/v1/api/appLogin', (req, res, next) => {
  //   logger.info(`\n\n`)
  //   logger.info(`======================================================================================`);
  //   logger.info('== Login');
  //   logger.info('== POST: /v1/api/appLogin');
  //   logger.info(`======================================================================================/n/n`);
  //   logger.sensitive(`headers= ${JSON.stringify(req.headers)}`);
  //
  //   const {account,encryptionPassword, jupkey} = req.body;
  //
  //   if(!gu.isWellFormedPassphrase(jupkey)) {
  //     return res.status(StatusCode.ClientErrorBadRequest).send({message: 'account is missing', code: MetisErrorCode.MetisError});
  //   }
  //   if(!gu.isWellFormedJupiterAddress(account)) {
  //     return res.status(StatusCode.ClientErrorBadRequest).send({message: 'jupkey is missing', code: MetisErrorCode.MetisError});
  //   }
  //   if(!encryptionPassword) {
  //     return res.status(StatusCode.ClientErrorBadRequest).send({message: 'encryptionPassword is missing', code: MetisErrorCode.MetisError});
  //   }
  //
  //   passport.authenticate('gravity-login', (error, user, message) => {
  //     logger.verbose(`#### /v1/api/appLogin > passport.authenticate('gravity-login', CALLBACK(*)`);
  //     if (error) {
  //       if(error instanceof mError.MetisErrorFailedUserAuthentication){
  //         return res.status(StatusCode.ClientErrorBadRequest).send({message: 'Not able to authenticate.', code: error.code});
  //       }
  //       console.log('\n')
  //       logger.error(`************************* ERROR ***************************************`);
  //       logger.error(`* ** /v1/api/appLogin > passport.authenticate() catch(error)`);
  //       logger.error(`************************* ERROR ***************************************\n`);
  //       console.log(error)
  //       return res.status(StatusCode.ServerErrorInternal).json({message: error.message, code: error.code})
  //     }
  //
  //     if (!user) {
  //       const errorMessage = 'There was an error in verifying the passphrase with the Blockchain..';
  //       logger.error(errorMessage);
  //       return res.status(StatusCode.ClientErrorUnauthorized).json({message: errorMessage});
  //     }
  //
  //     const userInfo = {
  //       accessKey: user.accessKey,
  //       encryptionKey: user.encryptionKey,
  //       account: user.account,
  //       publicKey: user.publicKey,
  //       profilePictureURL: user.profilePictureURL,
  //       userData: user.userData
  //     }
  //     const token = jwt.sign(userInfo, process.env.SESSION_SECRET, {expiresIn: process.env.JWT_TOKEN_EXPIRATION});
  //
  //     const userContainer = {
  //       profilePictureURL: user.profilePictureURL,
  //       alias: user.userData.alias,
  //       account: user.userData.account,
  //     };
  //
  //     res.status(200).send({ user: userContainer, token });
  //   })(req, res, next);
  // });


  // ===============================================================================
  // GET PASSPHRASE
  // ===============================================================================
  app.get('/create_passphrase', (req, res) => {
    const seedphrase = gravity.generate_passphrase();
    res.send({ success: true, result: seedphrase, message: 'Passphrase generated' });
  });
};
