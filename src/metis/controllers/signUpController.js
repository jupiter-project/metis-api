import {StatusCode} from "../../../utils/statusCode";
import {MetisErrorCode} from "../../../utils/metisErrorCode";
import {accountRegistration} from "../../../services/accountRegistrationService";
import {instantiateGravityAccountProperties} from "../../../gravity/instantiateGravityAccountProperties";
import ipLoggerRepeatedIpAddress from "../../../utils/gravityUtils";
import {metisConf} from "../../../config/metisConf";
const moment = require('moment'); // require
const logger = require('../../../utils/logger')(module);
const gu = require('../../../utils/gravityUtils');
const bcrypt = require("bcrypt-nodejs");
const mError = require("../../../errors/metisError");
let counter = 1;

const createJob = (jobs,newAccountProperties,newAccountAlias,res,websocket, subscriberId, next = ()=>{}) => {
    const startTime = Date.now();
    const namespace = '/sign-up';
    const room = `sign-up-${newAccountProperties.address}`;
    const job = jobs.create('MetisJobRegisterJupiterAccount', {userAccountProperties: newAccountProperties, userAlias: newAccountAlias})
        .priority('high')
        .removeOnComplete(false)
        .save(error => {
            logger.verbose(`---- JobQueue: user-registration.save()`);
            if (error) {
                logger.error(`****************************************************************`);
                logger.error(`** job.catch(error)`);
                logger.error(`****************************************************************`);
                logger.error(`${error}`);
                websocket.of('/sign-up').to(`sign-up-${newAccountProperties.address}`).emit('signUpFailed', job.created_at);
                res.status(StatusCode.ServerErrorInternal).send({
                    message: 'Internal Error',
                    jobId: job.id,
                    code: MetisErrorCode.MetisError
                });
                return next();
            }
            logger.debug(`job.id= ${job.id}`);
            logger.debug(`job.created_at= ${job.created_at}`);
            websocket.of('/sign-up').to(`sign-up-${newAccountProperties.address}`).emit('signUpJobCreated', job.id);
            res.status(StatusCode.SuccessAccepted).send({
                job: {
                    id: job.id,
                    createdAt: job.created_at,
                    href: `/v1/api/job/status?jobId=${job.id}`,
                },
                passphrase: newAccountProperties.passphrase,
                address: newAccountProperties.address,
                passwordHash: bcrypt.hashSync(newAccountProperties.crypto.encryptionPassword, bcrypt.genSaltSync(8), null)
            })
            return next();
        });

    /**
     *
     */
    job.on('complete', function (jobData) {
        logger.verbose(`---- job.on(complete(result))`)
        logger.verbose(`alias= ${newAccountAlias}`)
        const newAccountProperties = jobData.newAccountProperties;
        const endTime = Date.now();
        const processingTime = `${moment.duration(endTime - startTime).minutes()}:${moment.duration(endTime - startTime).seconds()}`
        console.log('');
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        logger.info(`++ SIGNUP COMPLETE. Sending Websocket Event`);
        logger.info(`++ Processing TIME`);
        logger.info(`++ ${processingTime}`);
        logger.info(`++ Counter:`);
        logger.info(`++ ${counter})`);
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n\n\n');
        counter = counter + 1;

        // websocket.in(room).allSockets().then((result) => {
        //     logger.info(`The number of users connected is: ${result.size}`);
        // });
        websocket.of(namespace).to(room).emit('signUpSuccessful', job.created_at);
    });
    job.on('failed attempt', function (errorMessage, doneAttempts) {
        logger.error(`***********************************************************************************`);
        logger.error(`** job.on(failed_attempt())`);
        logger.error(`***********************************************************************************`);
        logger.error(`errorMessage= ${errorMessage}`);
        logger.error(`doneAttempts= ${doneAttempts}`);
        websocket.of(namespace).to(room).emit('signUpFailedAttempt', {message: `${errorMessage}`});
    });
    job.on('failed', function (errorMessage) {
        logger.error(`***********************************************************************************`);
        logger.error(`** job.on(failed())`);
        logger.error(`***********************************************************************************`);
        logger.error(`errorMessage= ${errorMessage}`);
        websocket.of(namespace).to(room).emit('signUpFailed', {message: `${errorMessage}`});
    });
}

module.exports = (app, jobs, websocket) => {
    return {
        /**
         * SIGNUP V1
         */
        v1SignUpPost: async (req, res, next) => {
            console.log(`\n\n`);
            logger.info('======================================================================================');
            logger.info('== Signup');
            logger.info('== POST: /v1/api/signup ');
            logger.info(`======================================================================================\n\n`);
            // const ipLogger = function (jupAddress, alias, req) {
            const {account, alias, accounthash, public_key, key, jup_account_id, encryption_password} = req.body;
            const newAccountProperties = await instantiateGravityAccountProperties(key, encryption_password);
            const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            gu.ipLogger(newAccountProperties.address, alias, ipAddress);
            createJob(jobs, newAccountProperties, alias, res, websocket, next);
        },

        ipLoggerInfo: async (req, res) => {
            const {password} = req.body;

            if(password !== metisConf.ipEndpointPassword){
                res.send({});
            }

            gu.ipLoggerRepeatedIpAddress()
                .then(data => res.send(data))
                .catch(error => res.status(StatusCode.ServerErrorInternal).send(error))
        },

        /**
         * V2/SIGNUP
         */
        v2SignUpPost: async (req, res, next) => {
            console.log(`\n\n`);
            logger.info('======================================================================================');
            logger.info('== SignUp');
            logger.info('== POST: /v2/api/signup ');
            logger.info(`======================================================================================\n\n`);
            const password = req.body.password;
            const alias = req.body.alias;
            if (!password) return res.status(StatusCode.ClientErrorBadRequest).send({message: 'provide a password'})
            if (!alias) return res.status(StatusCode.ClientErrorBadRequest).send({message: 'provide an alias'})
            if (!gu.isWellFormedJupiterAlias(alias)) {

                const error = new mError.MetisErrorBadJupiterAlias(alias);
                console.log('\n')
                logger.error(`************************* ERROR ***************************************`);
                logger.error(`* ** /metis/v2/api/signup.catch(error)`);
                logger.error(`************************* ERROR ***************************************\n`);
                console.log(error)
                res.status(StatusCode.ClientErrorBadRequest).send({message: 'alias is invalid', code: error.code});
                return next();
            }
            const newAccountProperties = await accountRegistration.createNewAccount(password);
            createJob(jobs, newAccountProperties, alias, res, websocket, next);
        }
    }
}
