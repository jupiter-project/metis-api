import events from 'events';
import { gravity } from './gravity';
import User from '../models/user';
import RegistrationWorker from '../workers/registration';
import { gravityCLIReporter } from '../gravity/gravityCLIReporter';

import {ApplicationAccountProperties} from "../gravity/applicationAccountProperties";
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";
import {JupiterFundingService} from "../services/jupiterFundingService";


const { JupiterAPIService } =  require('../services/jupiterAPIService');
const { AccountRegistration } = require('./accountRegistration');
// Loads up passport code
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


const getSignUpUserInformation = (account, request) => {
    return {
        account,
        email: request.body.email,
        alias: request.body.alias,
        firstname: request.body.firstname,
        lastname: request.body.lastname,
        secret_key: null,
        twofa_enabled: false,
        twofa_completed: false,
        public_key: request.body.public_key,
        encryption_password: request.body.encryption_password,
        passphrase: request.body.key,
        jup_key: gravity.encrypt(request.body.key), // passphrase
        jup_account_id: request.body.jup_account_id
    }
}


/**
 * Signup to Metis
 * @param {*} passport
 */
const metisSignup = (passport) => {

    logger.verbose('#####################################################################################')
    logger.verbose(`##  metisSignup(passport)`);
    logger.verbose('#####################################################################################')

    passport.use('gravity-signup', new LocalStrategy({
            usernameField: 'account',
            passwordField: 'accounthash',
            passReqToCallback: true, // allows us to pass back the entire request to the callback
        },
        (request, account, accounthash, done) => {
            process.nextTick(() => {
                logger.verbose(`metisSignUp().nextTick()`);
                logger.sensitive(`request.body = ${JSON.stringify(request.body)}`);
                logger.info('Saving new account data in Jupiter...');

                const applicationGravityAccountProperties = new GravityAccountProperties(
                    process.env.APP_ACCOUNT_ADDRESS,
                    process.env.APP_ACCOUNT_ID,
                    process.env.APP_PUBLIC_KEY,
                    process.env.APP_ACCOUNT,
                    '',
                    process.env.ENCRYPT_PASSWORD,
                    process.env.ENCRYPT_ALGORITHM,
                    process.env.APP_EMAIL,
                    process.env.APP_NAME,
                    ''
                )

                const TRANSFER_FEE = 100
                const ACCOUNT_CREATION_FEE = 750;
                const STANDARD_FEE = 500;
                const MINIMUM_TABLE_BALANCE = 50000
                const MINIMUM_APP_BALANCE = 100000
                const MONEY_DECIMALS = 8;
                const DEADLINE = 60;

                const appAccountProperties = new ApplicationAccountProperties(
                    DEADLINE, STANDARD_FEE, ACCOUNT_CREATION_FEE, TRANSFER_FEE, MINIMUM_TABLE_BALANCE, MINIMUM_APP_BALANCE, MONEY_DECIMALS
                );

                applicationGravityAccountProperties.addApplicationAccountProperties(appAccountProperties);


                const signUpUserInformation = getSignUpUserInformation(account, request);
                logger.sensitive(`signUpUserInformation = ${JSON.stringify(signUpUserInformation)}`);

                const newUserGravityAccountProperties = new GravityAccountProperties(
                    signUpUserInformation.account, //address
                    signUpUserInformation.jup_account_id, // account Id
                    signUpUserInformation.public_key, // public key
                    signUpUserInformation.passphrase, // passphrase
                    signUpUserInformation.hash, //password hash
                    signUpUserInformation.encryption_password, //password
                    process.env.ENCRYPT_ALGORITHM, // algorithm
                    signUpUserInformation.email, //email
                    signUpUserInformation.firstName, //firstname
                    signUpUserInformation.lastName // lastname
                )

                logger.sensitive(`newUserGravityAccountProperties= ${JSON.stringify(newUserGravityAccountProperties)}`);

                newUserGravityAccountProperties.addAlias(signUpUserInformation.alias);

                const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, applicationGravityAccountProperties);
                const jupiterFundingService = new JupiterFundingService(jupiterAPIService, applicationGravityAccountProperties )

                const accountRegistration = new AccountRegistration(newUserGravityAccountProperties, applicationGravityAccountProperties, jupiterAPIService, jupiterFundingService, gravity);



                logger.debug(`accountRegistration().register()`);
                accountRegistration.register()
                    .then(response => {
                        logger.verbose('---------------------------------------------------------------------------------------');
                        logger.verbose(`--  metisSignUp().accountRegistration.register().then(response= ${!!response})`);
                        logger.verbose('---------------------------------------------------------------------------------------');
                        const payload = {}
                        // const payload = {
                        //     accessKey: request.session.jup_key,
                        //     encryptionKey: gravity.encrypt(signUpUserInformation.encryption_password),
                        //     id: user.data.id,
                        // }

                        return done(null, payload, 'Your account has been created and is being saved into the blockchain. Please wait a couple of minutes before logging in.');
                    })
                    .catch(error => {
                        logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                        logger.error(`xx  metisSignUp().accountRegistration.register().catch(error= ${!!error})`);
                        logger.error(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
                        logger.error(`error= ${JSON.stringify(error)}`);
                    })
            });
        }))
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
    logger.verbose('#####################################################################################');
    logger.verbose('                                  metisLogin(passport, jobs, io)');
    logger.verbose('#####################################################################################');
    let user;
    let valid = true;


    const containedDatabase = {
      account,
      accounthash,
      encryptionPassword: req.body.encryptionPassword,
      passphrase: req.body.jupkey,
      publicKey: req.body.public_key,
      accountId: req.body.jup_account_id,
    };


      /**
       * @TODO  If a non-metis jupiter account owner logs in. We should let this person log in. The only problem is how do we
       * add the password? It seems there's need to be some sort of signup process to join metis. All we need is for the person
       * to provide their new password.  The current problem is that current when going through the signup process
       * we are creating a new jupiter account. This means we now need to ask during sign up if they arleady own a jupiter
       * account. This was we can register their current jup account with metis.
       */


    logger.debug('--------------------------------');
    logger.sensitive(JSON.stringify(containedDatabase));

    containedDatabase.originalTime = Date.now();
    const worker = new RegistrationWorker(jobs, io);
    const workerData = {
      accountData: gravity.encrypt(JSON.stringify(containedDatabase)),
      originalTime: Date.now(),
    };

    logger.verbose('getUser(account, jupkey, containedDatabase)');
    gravity.getUser(account, req.body.jupkey, containedDatabase)
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


        const accountRegistration = new AccountRegistration(containedDatabase, 'fromAccount');
        const tablesToAttach = [];
        logger.debug(`usersTable=${JSON.stringify(response.userAccountTables.usersTable)}`);
        logger.debug(`channelsTable=${JSON.stringify(response.userAccountTables.channelsTable)}`);

        // if (!response.userAccountTables.usersTable) {
        //     tablesToAttach.push(accountRegistration.attachTable('users'));
        // }

        if (!listOfAttachedTableNames.includes('channels')) {
          tablesToAttach.push(accountRegistration.attachTable('channels'));
        }

        // if (!response.userAccountTables.invitesTable) {
        //     tablesToAttach.push(accountRegistration.attachTable('invites'));
        // }
        //
        // if (!response.userAccountTables.storageTable) {
        //     tablesToAttach.push(accountRegistration.attachTable('storage'));
        // }
        //


        Promise.all(tablesToAttach).then(async (values) => {
          logger.debug(`values= ${values.length}`);
          const { userRecord } = response;
          userRecord.public_key = req.body.public_key;

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
            req.session.public_key = req.body.public_key;
            req.session.twofa_pass = false;
            req.session.jup_key = gravity.encrypt(req.body.jupkey);
            req.session.accessData = gravity.encrypt(JSON.stringify(containedDatabase));

            const hasFundingProperty = await gravity.hasFundingProperty({
              recipient: user.record.account,
            });

            if (!hasFundingProperty) {
              const fundingResponse = await gravity.setAcountProperty({
                recipient: user.record.account,
              });
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
            accessKey: gravity.encrypt(req.body.jupkey),
            encryptionKey: gravity.encrypt(req.body.encryptionPassword),
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
          .catch((error) => {
            // @TODO should we throw the error?
            throw error;
          });
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
