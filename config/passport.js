import { gravity } from './gravity';
import User from '../models/user';
import {accountRegistration} from "../services/accountRegistrationService";
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
 */
const metisRegistration = async (account, requestBody) => {
    logger.verbose(`###################################################################################`);
    logger.verbose(`## metisRegistration(account, requestBody)`);
    logger.verbose(`## `);
    logger.sensitive(`account=${JSON.stringify(account)}`);
    logger.sensitive(`requestBody=${JSON.stringify(requestBody)}`);

    const signUpUserInformation = getSignUpUserInformation(account, requestBody);
        const registration = accountRegistration.register(
            signUpUserInformation.account,
            signUpUserInformation.alias,
            signUpUserInformation.passphrase,
            signUpUserInformation.encryption_password
        )

        return registration;
};

/**
 * Signup to Metis
 * @param {*} passport
 */
const metisSignup = (passport, jobsQueue, websocket ) => {
  logger.verbose('######################################################');
  logger.verbose('##  metisSignup(passport)');
  logger.verbose('##');
  passport.use('gravity-signup', new LocalStrategy({
    usernameField: 'account',
    passwordField: 'accounthash',
    passReqToCallback: true, // allows us to pass back the entire request to the callback
  },
  (request, account, accounthash, done) => {
    process.nextTick(() => {

        const encryptedRequestBody = gravity.encrypt( JSON.stringify(request.body));

        const jobData = {
            account,
            data:  encryptedRequestBody
        }

        const job = jobsQueue.create('user-registration', jobData)
            .priority('high')
            .removeOnComplete(false)
            .save( (err) =>{
                if(err){
                    logger.error(`there is a problem saving to redis`);
                    logger.error(JSON.stringify(err));
                    websocket.of('/sign-up').to(`sign-up-${account}`).emit('signUpFailed',account);
                }
                logger.verbose(`jobQueue.save() id= ${job.id}`);
                logger.verbose(`account= ${account}`);
                setTimeout(()=>{
                  websocket.of('/sign-up').to(`sign-up-${account}`).emit('signUpJobCreated', job.id);
                }, 1000);
                done(null, null, job.id);
            });

        // logger.debug(`job id= ${job.id} for account=${account}`);

        job.on('complete', function(result){
            logger.verbose(`######################################`)
            logger.verbose(`## passport.job.on(complete(signUpSuccessful))`)
            logger.verbose(`account=${account}`)
            logger.sensitive('Job completed with data ', result);
            websocket.of('/sign-up').to(`sign-up-${account}`).emit('signUpSuccessful', account);
        });

        job.on('failed attempt', function(errorMessage, doneAttempts){
            logger.verbose(`######################################`)
            logger.verbose(`## passport.job.on(failed_attempt(signUpFailedAttempt))`)
            logger.verbose(`account=${account}`)
            logger.sensitive('errorMessage=', errorMessage);
            logger.sensitive('doneAttempts=', doneAttempts);
            websocket.of('/sign-up').to(`sign-up-${account}`).emit('signUpFailedAttempt',account);
        });

        job.on('failed', function(errorMessage){
            logger.verbose(`######################################`)
            logger.verbose(`## passport.job.on(failed(errorMessage))`)
            logger.verbose(`account=${account}`)
            logger.sensitive('errorMessage=', errorMessage);
            websocket.of('/sign-up').to(`sign-up-${account}`).emit('signUpFailed', account);
        });
    });
  }));
};

/**
 *
 * @param passport
 */
const metisLogin = (passport) => {
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
    logger.verbose('                                  metisLogin(passport)');
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
          database: response.userAccountTables,
          accountData: gravity.encrypt(JSON.stringify(containedDatabase)),
          id: user.data.id,
          publicKey: public_key,
          profilePictureURL: profilePicture && profilePicture.value
            ? profilePicture.value
            : '',
          userData: {
            alias: userRecord.alias,
            account: userRecord.account,
          },
        };
        logger.sensitive(`The userInfo = ${JSON.stringify(user)}`);
        // gravityCLIReporter.addItem('The user Info', JSON.stringify(user));


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
    metisRegistration
};
