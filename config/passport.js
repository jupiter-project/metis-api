import { gravity } from './gravity';
import User from '../models/user';
import {accountRegistration} from "../services/accountRegistrationService";
import {metisGravityAccountProperties} from "../gravity/gravityAccountProperties";
import {jupiterAccountService} from "../services/jupiterAccountService";
import {instantiateGravityAccountProperties} from "../gravity/instantiateGravityAccountProperties";
// import mError from "../../../errors/metisError";
import mError from "../errors/metisError";
const moment = require('moment'); // require
const LocalStrategy = require('passport-local').Strategy;
const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');
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
 * @param address
 * @param requestBody
 * @return {Promise<string>}
 */
const metisRegistration = async (address, requestBody) => {
    logger.verbose(`###################################################################################`);
    logger.verbose(`## metisRegistration(address=${address}, requestBody)`);
    logger.verbose(`## `);

    const signUpUserInformation = getSignUpUserInformation(address, requestBody);

    const registration = accountRegistration.register2(
        signUpUserInformation.account,
        signUpUserInformation.alias,
        signUpUserInformation.passphrase,
        signUpUserInformation.encryption_password
    )

    // const registration = accountRegistration.register(
    //     signUpUserInformation.account,
    //     signUpUserInformation.alias,
    //     signUpUserInformation.passphrase,
    //     signUpUserInformation.encryption_password
    // )

    return registration;
};

/**
 * Signup to Metis
 * @param passport
 * @param jobsQueue
 * @param websocket
 */
const metisSignup = (passport, jobsQueue, websocket ) => {
    logger.info('======================================================================================');
    logger.info('== metisSignup(passport)');
    logger.info(`======================================================================================`);
    const startTime = Date.now();

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
            .save( error =>{
                logger.verbose(`---- JobQueue: user-registration.save()`);
                if(error){
                    logger.error(`There is a problem saving to redis`);
                    logger.error(`${error}`);
                    websocket.of('/sign-up').to(`sign-up-${account}`).emit('signUpFailed',account);
                    throw new Error('user-registration');
                }
                logger.verbose(`job.id= ${job.id}`);
                websocket.of('/sign-up').to(`sign-up-${account}`).emit('signUpJobCreated', job.id);
                return done(null, job.id);
            });
        job.on('complete', function(result){
            logger.verbose(`---- passport.job.on(complete(signUpSuccessful))`)
            logger.verbose(`account= ${account}`)
            logger.sensitive('Job completed with data ', result);
            const endTime = Date.now();
            const processingTime = `${moment.duration(endTime-startTime).minutes()}:${moment.duration(endTime-startTime).seconds()}`
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            logger.info(`++ SIGNUP`);
            logger.info(`++ Processing TIME`);
            logger.info(`++ ${processingTime}`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            const room = `sign-up-${account}`;
            websocket.in(room).allSockets().then((result) => {
                logger.info(`The number of users connected is: ${result.size}`);
            });
            websocket.of('/sign-up').to(room).emit('signUpSuccessful', account);
        });
        job.on('failed attempt', function(errorMessage, doneAttempts){
            logger.error(`***********************************************************************************`);
            logger.error(`** passport.job.on(failed_attempt())`);
            logger.error(`** `);
            logger.error(`account= ${account}`)
            logger.error(`errorMessage= ${errorMessage}`);
            logger.error(`doneAttempts= ${doneAttempts}`);
            websocket.of('/sign-up').to(`sign-up-${account}`).emit('signUpFailedAttempt',{message: `${errorMessage}`});
        });

        job.on('failed', function(errorMessage){
            logger.error(`***********************************************************************************`);
            logger.error(`** passport.job.on(failed())`);
            logger.error(`** `);
            logger.error(`account= ${account}`)
            logger.error(`errorMessage= ${errorMessage}`);
            websocket.of('/sign-up').to(`sign-up-${account}`).emit('signUpFailed', {message: `${errorMessage}`});
        });
    });
  }));
};

/**
 *
 * @param passport
 */
const metisLogin = (passport) => {
    logger.info('======================================================================================');
    logger.info('== metisLogin(passport)');
    logger.info(`======================================================================================`);

  passport.use('gravity-login', new LocalStrategy({
    usernameField: 'account', //jupiter address
    passwordField: 'accounthash', //?
    passReqToCallback: 'true',
  },
  async (req, account, accounthash, done) => {
  /**
   * @TODO  If a non-metis jupiter account owner logs in. We should let this person log in. The only problem is how do we
   * add the password? It seems there's need to be some sort of signup process to join metis. All we need is for the person
   * to provide their new password.  The current problem is that current when going through the signup process
   * we are creating a new jupiter account. This means we now need to ask during sign up if they arleady own a jupiter
   * account. This was we can register their current jup account with metis.
   */
    logger.verbose('#### metisLogin(passport)');
      const {
          jupkey,
          public_key,
          jup_account_id,
          encryptionPassword,
      } = req.body;
      let user;
      let valid = true;

      try {
          const userAccountProperties = await jupiterAccountService.getMemberAccountPropertiesFromPersistedUserRecordOrNull(jupkey, encryptionPassword);
          if(userAccountProperties === null){
              return done(new mError.MetisErrorFailedUserAuthentication());
          }
          const userInfo = {
              accessKey: gravity.encrypt(jupkey),
              encryptionKey: gravity.encrypt(encryptionPassword),
              account: gravity.encrypt(account),
              publicKey: public_key,
              profilePictureURL: '',
              userData: {
                  alias: userAccountProperties.getCurrentAliasNameOrNull(),
                  account: userAccountProperties.address
              },
          };

          return done(null, userInfo, 'Authentication validated!');

      } catch(error){
          console.log('\n')
          logger.error(`************************* ERROR ***************************************`);
          logger.error(`* ** metisLogin.catch(error)`);
          logger.error(`************************* ERROR ***************************************\n`);
          logger.error(`error= ${error}`)
          return done(error);
      }

    // // 2. Past this means its an older Account....
    // const accountStatement = await jupiterAccountService.fetchAccountStatement(
    //     metisGravityAccountProperties.passphrase,
    //     metisGravityAccountProperties.password,
    //     'metis-account',
    //     'app'
    // );
    //
    // const usersTableStatement =  await accountStatement.attachedTables.find( table => table.statementId === 'table-users');
    //
    // if (!usersTableStatement) {
    //   throw new Error('There is no application users table');
    // }
    //
    // const containedDatabase = {
    //   account,
    //   accounthash,
    //   encryptionPassword,
    //   passphrase: jupkey,
    //   publicKey: public_key,
    //   accountId: jup_account_id,
    //   originalTime: Date.now(),
    // };
    //
    // logger.verbose('metisLogin().gravity.getUser(account, jupkey, containedDatabase)');
    // gravity.getUser(account, jupkey, containedDatabase)
    //   .then(async (response) => {
    //     logger.debug('---------------------------------------------------------------------------------------');
    //     logger.debug('-- getUser(account, jupkey, containedDatabase).then(response)');
    //     logger.debug('--');
    //     logger.sensitive(`response.userAccountTables=${JSON.stringify(response.userAccountTables)}`);
    //     logger.sensitive(`response.userRecord= ${JSON.stringify(response.userRecord)}`);
    //
    //     if (!response.userRecord) {
    //       const doneResponse = {
    //         error: null,
    //         user: false,
    //         message: 'Account is not registered or has not been confirmed in the blockchain.',
    //       };
    //       return done(doneResponse.error, doneResponse.user, doneResponse.message);
    //     }
    //
    //     const listOfAttachedTableNames = gravity.extractTableNamesFromTables(response.userAccountTables);
    //     logger.debug(`listOfAttachedTableNames= ${JSON.stringify(listOfAttachedTableNames)}`);
    //
    //
    //     const { userRecord } = response;
    //     userRecord.public_key = public_key;
    //     logger.sensitive(`userRecord=${JSON.stringify(userRecord)}`);
    //
    //
    //     user = new User(userRecord);
    //       if (user.record.id === undefined) {
    //       valid = false;
    //       const doneResponse = {
    //         error: null,
    //         user: false,
    //         message: 'Account is not registered',
    //       };
    //       return done(doneResponse.error, doneResponse.user, doneResponse.message);
    //     }
    //
    //
    //     if (!user.validEncryptionPassword(containedDatabase.encryptionPassword)) {
    //       valid = false;
    //
    //       const doneResponse = {
    //         error: null,
    //         user: false,
    //         message: req.send({ error: true, message: 'Wrong encryption password' }),
    //       };
    //       return done(doneResponse.error, doneResponse.user, doneResponse.message);
    //     }
    //
    //     if (!user.validPassword(containedDatabase.encryptionPassword)) {
    //       valid = false;
    //       const doneResponse = {
    //         error: null,
    //         user: false,
    //         message: 'Wrong hashphrase',
    //       };
    //       return done(doneResponse.error, doneResponse.user, doneResponse.message);
    //     }
    //
    //     if (valid) {
    //       const propertyInfo = { recipient: user.record.account };
    //
    //       const hasFundingProperty = await gravity.hasFundingProperty(propertyInfo);
    //
    //       if (!hasFundingProperty) {
    //         const fundingResponse = await gravity.setAcountProperty(propertyInfo);
    //         logger.info(fundingResponse);
    //       }
    //     }
    //
    //
    //     const userProperties = await gravity.getAccountProperties({ recipient: userRecord.account });
    //     const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));
    //
    //
    //     const userInfo = {
    //       userRecordFound: response.userRecordFound,
    //       noUserTables: response.noUserTables,
    //       userNeedsBackup: response.userNeedsBackup,
    //       accessKey: gravity.encrypt(jupkey),
    //       encryptionKey: gravity.encrypt(encryptionPassword),
    //       account: gravity.encrypt(account),
    //       database: response.userAccountTables,
    //       accountData: gravity.encrypt(JSON.stringify(containedDatabase)),
    //       id: user.data.id,
    //       publicKey: public_key,
    //       profilePictureURL: profilePicture && profilePicture.value
    //         ? profilePicture.value
    //         : '',
    //       userData: {
    //         alias: userRecord.alias,
    //         account: userRecord.account,
    //       },
    //     };
    //     // logger.sensitive(`The userInfo = ${JSON.stringify(user)}`);
    //     // gravityCLIReporter.addItem('The user Info', JSON.stringify(user));
    //
    //     const doneResponse = {
    //       error: null,
    //       user: userInfo,
    //       message: 'Authentication validated!',
    //     };
    //
    //     return done(doneResponse.error, doneResponse.user, doneResponse.message);
    //   })
    //   .catch( err => {
    //       console.log('\n')
    //       logger.error(`************************* ERROR ***************************************`);
    //       logger.error(`* ** metisLogin().gravity.getUser().catch(error)`);
    //       logger.error(`************************* ERROR ***************************************\n`);
    //       logger.error(`error= ${err}`)
    //       const error = new mError.MetisErrorFailedUserAuthentication(`${err}`);
    //
    //       return done(error,null)
    //   });


  }));
};

module.exports = {
    serializeUser,
    deserializeUser,
    metisSignup,
    metisLogin,
    metisRegistration
};
