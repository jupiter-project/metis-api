import events from 'events';
import { gravity } from './gravity';
import User from '../models/user';
import RegistrationWorker from '../workers/registration';
import {gravityCLIReporter} from "../gravity/gravityCLIReporter";

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

/**
 * Signup to Metis
 * @param {*} passport
 */
const metisSignup = (passport) => {
    logger.verbose(`metisSignup()`);

  passport.use('gravity-signup', new LocalStrategy({
    usernameField: 'account',
    passwordField: 'accounthash',
    passReqToCallback: true, // allows us to pass back the entire request to the callback
  },
  (req, account, accounthash, done) => {
    process.nextTick(() => {
        logger.verbose(`metisSignUp().nextTick()`);

        logger.debug(`request.body = ${JSON.stringify(req.body)}`);

        const reportSection = 'New user account info';
        gravityCLIReporter.setTitle('Metis Sign Up')
        gravityCLIReporter.addItem('Account', account, reportSection)
        gravityCLIReporter.addItem('Account Hash', accounthash, reportSection)
        gravityCLIReporter.addItem('Alias', req.body.alias, reportSection)
        gravityCLIReporter.addItem('Public Key', req.body.public_key, reportSection)
        gravityCLIReporter.addItem('Jup Account Id', req.body.jup_account_id, reportSection)
        gravityCLIReporter.addItem('password', req.body.encryption_password, reportSection)

        logger.sensitive(`metisSignUp().nextTick()`);
      const eventEmitter = new events.EventEmitter();
      const params = req.body;
      // logger.sensitive(`request body: ${JSON.stringify(params)}`);
      let user;

      // eventEmitter.on('sent_jupiter_to_new_account', () => {
        logger.info('Saving new account data in Jupiter...');
        const data = {
          account,
          email: params.email,
          alias: params.alias,
          firstname: params.firstname,
          lastname: params.lastname,
          secret_key: null,
          twofa_enabled: (params.twofa_enabled === 'true'),
          twofa_completed: false,
          public_key: params.public_key,
          encryption_password: params.encryption_password,
        };

          logger.debug('Instantiating User()');
          logger.sensitive('With the following data');
          logger.sensitive( `data = ${JSON.stringify(data)}`);
        user = new User(data);

        logger.verbose(`metisSignup().userCreate()`);
        user.create()
          .then(async () => {
              logger.verbose(`metisSignup().userCreate().then()`);
            req.session.twofa_pass = false;
            req.session.public_key = req.body.public_key;
            req.session.jup_key = gravity.encrypt(req.body.key);
            let moneyTransfer;
            try {
              moneyTransfer = await gravity.sendMoney(
                req.body.jup_account_id,
                parseInt(0.05 * 100000000, 10),
              );
            } catch (e) {
              logger.error(e);
              moneyTransfer = e;
            }
            logger.verbose(`Sent money to ${req.body.jup_account_id}`);
            if (!moneyTransfer.success) {
              logger.info('SendMoney was not completed');
            }

            const payload = {
                accessKey: req.session.jup_key,
                encryptionKey: gravity.encrypt(params.encryption_password),
                id: user.data.id,
            }

            logger.verbose(`User is created: ${JSON.stringify(payload)}`);
            gravityCLIReporter.addItemsInJson('The user is created', {...payload,...params}, 'IN CONCLUSION');
            gravityCLIReporter.sendReportAndReset();
            return done(null, payload, 'Your account has been created and is being saved into the blockchain. Please wait a couple of minutes before logging in.');
          })
          .catch((err) => {
            logger.error('USER CREATION FAILED', JSON.stringify(err));
              gravityCLIReporter.addItemsInJson('Failed to create the user account', err, 'IN CONCLUSION');
              gravityCLIReporter.sendReportAndReset();
            let errorMessage;
            if (err.verification_error !== undefined && err.verification_error === true) {
              err.errors.forEach((x) => {
                req.flash('signupMessage', err.errors[x]);
              });
              errorMessage = 'There were validation errors';
            } else {
              errorMessage = err.errors;
            }
            return done(true, false, errorMessage);
          });
      // });

      // eventEmitter.emit('sent_jupiter_to_new_account');
    });
  }));
}

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
      logger.verbose(`metisLogin()`);
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

    logger.debug('--------------------------------')
    logger.sensitive(JSON.stringify(containedDatabase));

    containedDatabase.originalTime = Date.now();
    const worker = new RegistrationWorker(jobs, io);
    const workerData = {
      accountData: gravity.encrypt(JSON.stringify(containedDatabase)),
      originalTime: Date.now(),
    };
    gravity.getUser(account, req.body.jupkey, containedDatabase)
      .then(async (response) => {
        if (response.error) {
            const doneResponse = {
                error: null,
                user: false,
                message:  req.flash('loginMessage', 'Account is not registered or has not been confirmed in the blockchain.')
            }

          return done(doneResponse.error, doneResponse.user, doneResponse.message);
        }

        if (response.noUserTables || response.userNeedsSave) {
          worker.addToQueue('completeRegistration', workerData);
        }
        // console.log(response);
        const data = JSON.parse(response.user);
        data.public_key = req.body.public_key;
        user = new User(data);

        if (user.record.id === undefined) {
            valid = false;

            const doneResponse = {
                error: null,
                user: false,
                message: req.flash('loginMessage', 'Account is not registered')
            }
            return done(doneResponse.error, doneResponse.user, doneResponse.message);
        }

        if (!user.validEncryptionPassword(containedDatabase.encryptionPassword)) {
          valid = false;

            const doneResponse = {
                error: null,
                user: false,
                message: req.send({ error: true, message: 'Wrong encryption password' })
            }
            return done(doneResponse.error, doneResponse.user, doneResponse.message);
        }

        if (!user.validPassword(accounthash)) {
          valid = false;

            const doneResponse = {
                error: null,
                user: false,
                message: req.flash('loginMessage', 'Wrong hashphrase')
            }
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

            user.setAlias(req.body.jupkey)
            .then((aliasSetting) => {
              if (!aliasSetting.success) {
                logger.info(aliasSetting);
              }
            })
            .catch(err => err);
        }
        const userProperties = await gravity.getAccountProperties({ recipient: data.account });
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
                alias: data.alias,
                account: data.account,
            },
        }
        logger.sensitive(`The userInfo = ${JSON.stringify(user)}`);
        gravityCLIReporter.addItem('The user Info', JSON.stringify(user));



          const doneResponse = {
              error: null,
              user: userInfo,
              message: 'Authentication validated!'
          }

          return done(doneResponse.error, doneResponse.user, doneResponse.message);
      })

      .catch((err) => {

        logger.error('Unable to query your user list. Please make sure you have a users table in your database.');
        logger.error(err);

          const doneResponse = {
              error: err,
              user: false,
              message: req.flash('loginMessage', 'Login Error')
          }
          return done(doneResponse.error, doneResponse.user, doneResponse.message);
      });
  }));
};

module.exports = {
  serializeUser,
  deserializeUser,
  metisSignup,
  metisLogin
};
