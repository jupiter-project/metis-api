import events from 'events';
import { gravity } from './gravity';
import User from '../models/user';
import RegistrationWorker from '../workers/registration';
import { gravityCLIReporter } from '../gravity/gravityCLIReporter';

import { ApplicationAccountProperties } from '../gravity/applicationAccountProperties';
import { GravityAccountProperties } from '../gravity/gravityAccountProperties';
import { JupiterFundingService } from '../services/jupiterFundingService';
import { JupiterAccountService } from '../services/jupiterAccountService';
import { TableService } from '../services/tableService';
import { JupiterTransactionsService } from '../services/jupiterTransactionsService';
import { FundingNotConfirmedError } from '../errors/metisError';

const { JupiterAPIService } = require('../services/jupiterAPIService');
const { AccountRegistration } = require('./accountRegistration');
const LocalStrategy = require('passport-local').Strategy;
const logger = require('../utils/logger')(module);

// Used to serialize the user for the session
const serializeUser = (passport) => {
  passport.serializeUser((accessData, done) => {
    done(null, accessData);
  });
};

/**
 * In a typical web application, the credentials used to authenticate a user will only be transmitted during the login request.
 * If authentication succeeds, a session will be established and maintained via a cookie set in the user's browser.
 * Each subsequent request will not contain credentials, but rather the unique cookie that identifies the session.
 * In order to support login sessions, Passport will serialize and deserialize user instances to and from the session.
 * @param {*} passport
 */
const deserializeUser = (passport) => {
  passport.deserializeUser((accessData, done) => {
    const user = new User({ id: accessData.id }, accessData);

    user.findById()
      .then((response) => {
        logger.info('Deserializer response');
        logger.info(response);
        const thisUser = user;
        done(null, thisUser);
      })
      .catch((err) => {
        logger.error(err);
        done(err, null);
      });
  });
};


/**
 *
 * @param account
 * @param requestBody
 * @returns {{public_key, firstname, twofa_enabled: boolean, jup_account_id: *, lastname, secret_key: null, twofa_completed: boolean, jup_key: string, alias: (string|*), encryption_password: (string|*), passphrase, account, email}}
 */
const getSignUpUserInformation = (account, requestBody) => ({
  account,
  email: requestBody.email,
  alias: requestBody.alias,
  firstname: requestBody.firstname,
  lastname: requestBody.lastname,
  secret_key: null,
  twofa_enabled: false,
  twofa_completed: false,
  public_key: requestBody.public_key,
  encryption_password: requestBody.encryption_password,
  passphrase: requestBody.key,
  jup_key: gravity.encrypt(requestBody.key), // passphrase
  jup_account_id: requestBody.jup_account_id,
});

/**
 *
 * @param account
 * @param requestBody
 * @returns {Promise<unknown>}
 */
const metisRegistration = async (account, requestBody) => {
  logger.verbose('#####################################################################################');
  logger.verbose('metisRegistration()');
  logger.verbose('#####################################################################################');
  logger.sensitive(`requestBody= ${JSON.stringify(requestBody)}`);

  const applicationGravityAccountProperties = new GravityAccountProperties(
    process.env.APP_ACCOUNT_ADDRESS,
    process.env.APP_ACCOUNT_ID,
    process.env.APP_PUBLIC_KEY,
    process.env.APP_ACCOUNT,
    '', // hash
    process.env.ENCRYPT_PASSWORD,
    process.env.ENCRYPT_ALGORITHM,
    process.env.APP_EMAIL,
    process.env.APP_NAME,
    '', // lastname
  );

  const TRANSFER_FEE = 100;
  const ACCOUNT_CREATION_FEE = 750;
  const STANDARD_FEE = 500;
  const MINIMUM_TABLE_BALANCE = 500000;
  const MINIMUM_APP_BALANCE = 100000;
  const MONEY_DECIMALS = 8;
  const DEADLINE = 60;

  const appAccountProperties = new ApplicationAccountProperties(
    DEADLINE, STANDARD_FEE, ACCOUNT_CREATION_FEE, TRANSFER_FEE, MINIMUM_TABLE_BALANCE, MINIMUM_APP_BALANCE, MONEY_DECIMALS,
  );

  applicationGravityAccountProperties.addApplicationAccountProperties(appAccountProperties);

  const signUpUserInformation = getSignUpUserInformation(account, requestBody);
  logger.sensitive(`signUpUserInformation = ${JSON.stringify(signUpUserInformation)}`);

  const newUserGravityAccountProperties = new GravityAccountProperties(
    signUpUserInformation.account, // address
    signUpUserInformation.jup_account_id, // account Id
    signUpUserInformation.public_key, // public key
    signUpUserInformation.passphrase, // passphrase
    signUpUserInformation.hash, // password hash
    signUpUserInformation.encryption_password, // password
    process.env.ENCRYPT_ALGORITHM, // algorithm
    signUpUserInformation.email, // email
    signUpUserInformation.firstName, // firstname
    signUpUserInformation.lastName, // lastname
  );

  logger.sensitive(`newUserGravityAccountProperties= ${JSON.stringify(newUserGravityAccountProperties)}`);

  newUserGravityAccountProperties.addAlias(signUpUserInformation.alias);

  const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties);
  const jupiterFundingService = new JupiterFundingService(jupiterAPIService, applicationGravityAccountProperties);
  const jupiterTransactionsService = new JupiterTransactionsService(jupiterAPIService);
  const tableService = new TableService(jupiterTransactionsService);
  const jupiterAccountService = new JupiterAccountService(jupiterAPIService, applicationGravityAccountProperties, tableService, jupiterTransactionsService);

  const accountRegistration = new AccountRegistration(
    newUserGravityAccountProperties,
    applicationGravityAccountProperties,
    jupiterAPIService,
    jupiterFundingService,
    jupiterAccountService,
    tableService,
    gravity,
  );

  logger.debug('metisRegistration().accountRegistration().register()');
  return new Promise((resolve, reject) => {
    accountRegistration.register()
      .then((response) => {
        logger.verbose('---------------------------------------------------------------------------------------');
        logger.verbose(`--  metisRegistration().accountRegistration.register().then(response= ${!!response})`);
        logger.verbose('---------------------------------------------------------------------------------------');

        return resolve(response);
      })
      .catch((error) => {
        logger.error('********************');
        logger.error(`_  metisRegistration().accountRegistration.register().catch(error= ${!!error})`);
        logger.error('********************');
        logger.error(`error= ${JSON.stringify(error)}`);

        logger.error(`instance= ${Object.getPrototypeOf(error)}`);
        if (error instanceof FundingNotConfirmedError) {
          console.log('@ @ @');
          return reject('FUnding Problem!!!');
        }

        return reject(error);
      });
  });
};

/**
 * Signup to Metis
 * @param {*} passport
 */
const metisSignup = (passport) => {
  logger.verbose('#####################################################################################');
  logger.verbose('##  metisSignup(passport)');
  logger.verbose('#####################################################################################');

  passport.use('gravity-signup', new LocalStrategy({
    usernameField: 'account',
    passwordField: 'accounthash',
    passReqToCallback: true, // allows us to pass back the entire request to the callback
  },
  (request, account, accounthash, done) => {
    process.nextTick(() => {
      metisRegistration(account, request.body)
        .then((response) => {
          const payload = {};
          // const payload = {
          //     accessKey: request.session.jup_key,
          //     encryptionKey: gravity.encrypt(signUpUserInformation.encryption_password),
          //     id: user.data.id,
          // }

          return done(null, payload, 'Your account has been created and is being saved into the blockchain. Please wait a couple of minutes before logging in.');
        });
    });
  }));
};

/**
 *
 * @param passport
 * @param jobs
 * @param io
 */
const metisLogin = (passport, jobs, io) => {
  passport.use('gravity-login', new LocalStrategy({
    usernameField: 'account',
    passwordField: 'accounthash',
    passReqToCallback: 'true',
  },
  (req, account, accounthash, done) => {
  /**
   * @TODO  If a non-metis jupiter account owner logs in. We should let this person log in. The only problem is how do we
   * add the password? It seems there's need to be some sort of signup process to join metis. All we need is for the person
   * to provide their new password.  The current problem is that current when going through the signup process
   * we are creating a new jupiter account. This means we now need to ask during sign up if they arleady own a jupiter
   * account. This was we can register their current jup account with metis.
   */
    logger.verbose('#####################################################################################');
    logger.verbose('                                  metisLogin(passport, jobs, io)');
    logger.verbose('#####################################################################################');
    const {
      jupkey,
      public_key,
      jup_account_id,
      encryptionPassword,
    } = req.body;
    let user;
    let valid = true;


    const containedDatabase = {
      account,
      accounthash,
      encryptionPassword,
      passphrase: jupkey,
      publicKey: public_key,
      accountId: jup_account_id,
      originalTime: Date.now(),
    };


    logger.debug('--------------------------------');
    logger.sensitive(JSON.stringify(containedDatabase));

    logger.verbose('getUser(account, jupkey, containedDatabase)');
    gravity.getUser(account, jupkey, containedDatabase)
      .then(async (response) => {
        logger.debug('---------------------------------------------------------------------------------------');
        logger.debug('-- getUser(account, jupkey, containedDatabase).then(response)');
        logger.debug('---------------------------------------------------------------------------------------');
        logger.sensitive(`response=${JSON.stringify(response)}`);
        logger.sensitive(`response.userAccountTables=${JSON.stringify(response.userAccountTables)}`);
        logger.sensitive(`response.userRecord= ${JSON.stringify(response.userRecord)}`);

        if (!response.userRecord) {
          const doneResponse = {
            error: null,
            user: false,
            message: req.flash('loginMessage', 'Account is not registered or has not been confirmed in the blockchain.'),
          };
          return done(doneResponse.error, doneResponse.user, doneResponse.message);
        }

        const listOfAttachedTableNames = gravity.extractTableNamesFromTables(response.userAccountTables);
        logger.debug(`listOfAttachedTableNames= ${JSON.stringify(listOfAttachedTableNames)}`);


        logger.debug(`usersTable=${JSON.stringify(response.userAccountTables.usersTable)}`);
        logger.debug(`channelsTable=${JSON.stringify(response.userAccountTables.channelsTable)}`);


        const { userRecord } = response;
        userRecord.public_key = public_key;

        user = new User(userRecord);
        if (user.record.id === undefined) {
          valid = false;
          const doneResponse = {
            error: null,
            user: false,
            message: req.flash('loginMessage', 'Account is not registered'),
          };
          return done(doneResponse.error, doneResponse.user, doneResponse.message);
        }


        if (!user.validEncryptionPassword(containedDatabase.encryptionPassword)) {
          valid = false;

          const doneResponse = {
            error: null,
            user: false,
            message: req.send({ error: true, message: 'Wrong encryption password' }),
          };
          return done(doneResponse.error, doneResponse.user, doneResponse.message);
        }

        if (!user.validPassword(accounthash)) {
          valid = false;
          const doneResponse = {
            error: null,
            user: false,
            message: req.flash('loginMessage', 'Wrong hashphrase'),
          };
          return done(doneResponse.error, doneResponse.user, doneResponse.message);
        }

        if (valid) {
          const propertyInfo = { recipient: user.record.account };

          const hasFundingProperty = await gravity.hasFundingProperty(propertyInfo);

          if (!hasFundingProperty) {
            const fundingResponse = await gravity.setAcountProperty(propertyInfo);
            logger.info(fundingResponse);
          }

          // logger.sensitive(`setAlias(passphrase= ${req.body.jupkey})`);
          //   user.setAlias(req.body.jupkey)
          //   .then((aliasSetting) => {
          //       logger.debug(`setAlias(passphrase=${req.body.jupkey}).then(aliasSetting= ${JSON.stringify(aliasSetting)})`);
          //         if (!aliasSetting.success) {
          //           logger.info(aliasSetting);
          //         }
          //   })
          //   .catch(err => {
          //       logger.error(`error= ${JSON.stringify(err)}`)
          //   });
        }


        const userProperties = await gravity.getAccountProperties({ recipient: userRecord.account });
        const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));


        const userInfo = {
          userRecordFound: response.userRecordFound,
          noUserTables: response.noUserTables,
          userNeedsBackup: response.userNeedsBackup,
          accessKey: gravity.encrypt(jupkey),
          encryptionKey: gravity.encrypt(encryptionPassword),
          account: gravity.encrypt(account),
          database: response.database,
          accountData: gravity.encrypt(JSON.stringify(containedDatabase)),
          id: user.data.id,
          profilePictureURL: profilePicture && profilePicture.value
            ? profilePicture.value
            : '',
          userData: {
            alias: userRecord.alias,
            account: userRecord.account,
          },
        };
        logger.sensitive(`The userInfo = ${JSON.stringify(user)}`);
        gravityCLIReporter.addItem('The user Info', JSON.stringify(user));


        const doneResponse = {
          error: null,
          user: userInfo,
          message: 'Authentication validated!',
        };

        return done(doneResponse.error, doneResponse.user, doneResponse.message);
      })
      .catch((err) => {
        logger.error('-- getUser(account, jupkey, containedDatabase).error(err)');
        logger.error('Unable to query your user list. Please make sure you have a users table in your database.');
        logger.error(err);

        const doneResponse = {
          error: err,
          user: false,
          message: req.flash('loginMessage', 'Login Error'),
        };
        return done(doneResponse.error, doneResponse.user, doneResponse.message);
      });
  }));
};

module.exports = {
  serializeUser,
  deserializeUser,
  metisSignup,
  metisLogin,
};
