const {StatusCode} = require("../../../utils/statusCode");
const {jupiterAPIService} = require("../../../services/jupiterAPIService");
const mError = require("../../../errors/metisError");
const jwt = require("jsonwebtoken");
const {metisConf} = require("../../../config/metisConf");
const {GravityCrypto} = require("../../../services/gravityCrypto");
const {instantiateGravityAccountProperties} = require("../../../gravity/instantiateGravityAccountProperties");
const gu = require("../../../utils/gravityUtils");
const {MetisErrorCode} = require("../../../utils/metisErrorCode");
const bcrypt = require("bcrypt-nodejs");
const moment = require("moment");
const logger = require('../../../utils/logger')(module);
let counter = 1;

const createJob = (jobs,newAccountProperties,newAccountAlias,res,websocket, subscriberId, next = ()=>{}) => {
    const startTime = Date.now();
    const namespace = '/sign-up';
    const room = `sign-up-${newAccountAlias}`;
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
                websocket.of('/sign-up').to(room).emit('signUpFailed', job.created_at);
                res.status(StatusCode.ServerErrorInternal).send({
                    message: 'Internal Error',
                    jobId: job.id,
                    code: MetisErrorCode.MetisError
                });
                return next();
            }
            logger.debug(`job.id= ${job.id}`);
            logger.debug(`job.created_at= ${job.created_at}`);
            const jobInfo = {
                id: job.id,
                createdAt: job.created_at,
                href: `/v1/api/job/status?jobId=${job.id}`,
            };

            websocket.of('/sign-up').to(room).emit('signUpJobCreated', jobInfo);
            res.status(StatusCode.SuccessAccepted).send({
                job: jobInfo,
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
        loadAccount: async (req, res, next) => {
            const {blockchainAccountAddress} = req.params;

            if (!blockchainAccountAddress) {
                return res.status(StatusCode.ClientErrorBadRequest).send({
                    message: 'missing blockchainAccountAddress',
                    code: error.code
                });
            }


            jupiterAPIService.getAlias(blockchainAccountAddress)
                .then(response => res.status(StatusCode.SuccessOK).send(response.data))
                .catch( async (error) => {
                    if(error instanceof mError.MetisErrorUnknownAlias){
                        res.status(StatusCode.SuccessOK).send({message: 'No available alias'})
                    }
                    return res.status(StatusCode.ServerErrorInternal).send({
                        message: `Theres a problem getting the alias`,
                        code: MetisErrorCode.MetisErrorFailedUserAuthentication
                    });
                });
        },
        createAccount: async (req, res, next) => {
            const {passphrase, password, blockchainAccountAddress} = req.body;

            console.log('Passphrase', passphrase);
            console.log('Password', password);

            if(!blockchainAccountAddress){
                return res.status(StatusCode.ClientErrorBadRequest).send({
                    message: 'Missing Blockchain account',
                    code: error.code
                });
            }

            if(!passphrase || !password){
                return res.status(StatusCode.ClientErrorBadRequest).send({
                    message: 'Missing parameters',
                    code: error.code
                });
            }


            const newAccountProperties = await instantiateGravityAccountProperties(passphrase, password);
            const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            gu.ipLogger(newAccountProperties.address, blockchainAccountAddress, ipAddress);
            createJob(jobs, newAccountProperties, blockchainAccountAddress, res, websocket, next);
        }
    }
}
