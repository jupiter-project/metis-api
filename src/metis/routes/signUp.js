import {StatusCode} from "../../../utils/statusCode";
import {MetisErrorCode} from "../../../utils/metisErrorCode";
import {accountRegistration} from "../../../services/accountRegistrationService";
const moment = require('moment'); // require
const logger = require('../../../utils/logger')(module);
const gu = require('../../../utils/gravityUtils');
const bcrypt = require("bcrypt-nodejs");
const mError = require("../../../errors/metisError");

module.exports = (app, jobs, websocket) => {
    /**
     * V2/SIGNUP
     */
    app.post('/metis/v2/api/signup', async (req, res) => {
        console.log(`\n\n`);
        logger.info('======================================================================================');
        logger.info('== SignUp');
        logger.info('== POST: /v2/api/signup ');
        logger.info(`======================================================================================\n\n`);
        const startTime = Date.now();
        const password = req.body.password;
        const alias = req.body.alias;
        if (!password) return res.status(StatusCode.ClientErrorBadRequest).send({message: 'provide a password'})
        if (!alias) return res.status(StatusCode.ClientErrorBadRequest).send({message: 'provide an alias'})
        if(!gu.isWellFormedJupiterAlias(alias)){
            const error =  new mError.MetisErrorBadJupiterAlias(alias);
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** /metis/v2/api/signup.catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            console.log(error)
            res.status(StatusCode.ClientErrorBadRequest).send({message: 'alias is invalid', code: error.code});
        }
        const newAccountProperties = await accountRegistration.createNewAccount(password);
        const job = jobs.create('MetisJobRegisterJupiterAccount', {userAccountProperties: newAccountProperties, userAlias: alias})
            .priority('high')
            .removeOnComplete(false)
            .save(error => {
                logger.verbose(`---- JobQueue: user-registration.save()`);
                if (error) {
                    logger.error(`****************************************************************`);
                    logger.error(`** job.catch(error)`);
                    logger.error(`****************************************************************`);
                    logger.error(`${error}`);
                    websocket.of('/sign-up').to(`sign-up-${job.created_at}`).emit('signUpFailed', job.created_at);
                    return res.status(StatusCode.ServerErrorInternal).send({
                        message: 'Internal Error',
                        jobId: job.id,
                        code: MetisErrorCode.MetisError
                    });
                }
                logger.debug(`job.id= ${job.id}`);
                logger.debug(`job.created_at= ${job.created_at}`);
                websocket.of('/sign-up').to(`sign-up-${job.created_at}`).emit('signUpJobCreated', job.id);
                return res.status(StatusCode.SuccessAccepted).send({
                    job: {
                        id: job.id,
                        createdAt: job.created_at,
                        href: `/v1/api/job/status?jobId=${job.id}`,
                    },
                    passphrase: newAccountProperties.passphrase,
                    address: newAccountProperties.address,
                    passwordHash: bcrypt.hashSync(password, bcrypt.genSaltSync(8), null)
                })
            });

        /**
         *
         */
        job.on('complete', function (jobData) {
            logger.verbose(`---- job.on(complete(result))`)
            logger.verbose(`alias= ${alias}`)
            const newAccountProperties = jobData.newAccountProperties;
            const endTime = Date.now();
            const processingTime = `${moment.duration(endTime - startTime).minutes()}:${moment.duration(endTime - startTime).seconds()}`

            console.log('');
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            logger.info(`++ SIGNUP COMPLETE. Sending Websocket Event`);
            logger.info(`++ Processing TIME`);
            logger.info(`++ ${processingTime}`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n\n\n');
            const room = `sign-up-${job.created_at}`;
            logger.debug(`room= ${room}`);
            websocket.in(room).allSockets().then((result) => {
                logger.info(`The number of users connected is: ${result.size}`);
            });
            websocket.of('/sign-up').to(room).emit('signUpSuccessful', job.created_at);
        });

        /**
         *
         */
        job.on('failed attempt', function (errorMessage, doneAttempts) {
            logger.error(`***********************************************************************************`);
            logger.error(`** job.on(failed_attempt())`);
            logger.error(`***********************************************************************************`);
            logger.error(`errorMessage= ${errorMessage}`);
            logger.error(`doneAttempts= ${doneAttempts}`);
            websocket.of('/sign-up').to(`sign-up-${job.created_at}`).emit('signUpFailedAttempt', {message: `${errorMessage}`});
        });

        /**
         *
         */
        job.on('failed', function (errorMessage) {
            logger.error(`***********************************************************************************`);
            logger.error(`** job.on(failed())`);
            logger.error(`***********************************************************************************`);
            logger.error(`errorMessage= ${errorMessage}`);
            websocket.of('/sign-up').to(`sign-up-${job.created_at}`).emit('signUpFailed', {message: `${errorMessage}`});
        });
    });
}
