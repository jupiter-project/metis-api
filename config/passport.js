import events from 'events';
import { gravity } from './gravity';
import User from '../models/user';
import RegistrationWorker from '../workers/registration';
import { gravityCLIReporter } from '../gravity/gravityCLIReporter';

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


const getSignUpUserInformation = (account, request) => ({
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
  jup_key: gravity.encrypt(request.body.key),
  jup_account_id: request.body.jup_account_id,
});

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
      logger.verbose('metisSignUp().nextTick()');
      logger.debug(`request.body = ${JSON.stringify(request.body)}`);


      const reportSection = 'New user account info';
      gravityCLIReporter.setTitle('Metis Sign Up');
      gravityCLIReporter.addItem('Account', account, reportSection);
      gravityCLIReporter.addItem('Account Hash', accounthash, reportSection);
      gravityCLIReporter.addItem('Alias', request.body.alias, reportSection);
      gravityCLIReporter.addItem('Public Key', request.body.public_key, reportSection);
      gravityCLIReporter.addItem('Jup Account Id', request.body.jup_account_id, reportSection);
      gravityCLIReporter.addItem('password', request.body.encryption_password, reportSection);

      // const eventEmitter = new events.EventEmitter();
      // const requestBody = request.body;
      logger.info('Saving new account data in Jupiter...');
      const signUpUserInformation = getSignUpUserInformation(account, request);
      logger.debug('Instantiating User() With the following data...');
      logger.sensitive(`data = ${JSON.stringify(signUpUserInformation)}`);
      const user = new User(signUpUserInformation);

      logger.verbose('metisSignup().userCreate()');
      user.create()
        .then(async () => {
          logger.verbose('---------------------------------------------------------------------------------------');
          logger.verbose('--  metisSignup().userCreate().then()');
          logger.verbose('---------------------------------------------------------------------------------------');

          // request.session.public_key = request.body.public_key;
          // request.session.jup_key = gravity.encrypt(request.body.key);

          let moneyTransfer;
          try {
            moneyTransfer = await gravity.sendMoney(
              signUpUserInformation.jup_account_id,
              parseInt(0.05 * 100000000, 10),
            );
          } catch (e) {
            logger.error(e);
            moneyTransfer = e;
          }
          logger.verbose(`Sent money to ${signUpUserInformation.jup_account_id}`);
          if (!moneyTransfer.success) {
            logger.info('SendMoney was not completed');
          }

          const payload = {
            accessKey: request.session.jup_key,
            encryptionKey: gravity.encrypt(signUpUserInformation.encryption_password),
            id: user.data.id,
          };

          logger.verbose(`User is created: ${JSON.stringify(payload)}`);
          gravityCLIReporter.addItemsInJson('The user is created', { ...payload, ...requestBody }, 'IN CONCLUSION');
          // gravityCLIReporter.sendReportAndReset();
          return done(null, payload, 'Your account has been created and is being saved into the blockchain. Please wait a couple of minutes before logging in.');
        })
        .catch((err) => {
          logger.error('USER CREATION FAILED', JSON.stringify(err));
          gravityCLIReporter.addItemsInJson('Failed to create the user account', err, 'IN CONCLUSION');
          // gravityCLIReporter.sendReportAndReset();
          let errorMessage;
          if (err.verification_error !== undefined && err.verification_error === true) {
            err.errors.forEach((x) => {
              request.flash('signupMessage', err.errors[x]);
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
