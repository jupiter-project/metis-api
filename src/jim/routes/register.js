const {storageService} = require(`../services/storageService`);
const {StatusCode} = require("../../../utils/statusCode");
const {BinaryAccountExistsError, MetisErrorSaveJobQueue} = require("../../../errors/metisError");
const {MetisErrorCode} = require("../../../utils/metisErrorCode");
const {binaryAccountJob} = require("../jobs/binaryAccountJob");
const logger = require('../../../utils/logger')(module);

module.exports = (app, jobs, websocket) => {
    app.post('/jim/v1/api/register', async (req, res) => {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== POST: /jim/v1/api/register');
        logger.info(`======================================================================================\n\n\n`);

        try{
            const userAccountProperties = req.user.gravityAccountProperties;
            const binaryAccountResponse = await binaryAccountJob.create(userAccountProperties);
            const job = binaryAccountResponse.job;
            websocket.of('/registration').to(`registration-${job.created_at}`).emit('registrationCreated', job.id);
            return res.status(StatusCode.SuccessAccepted).send({
                job: {
                    id: job.id,
                    createdAt: job.created_at,
                    href: `/v1/api/job/status?jobId=${job.id}`,
                }
            })
        }catch(error){
            if(error instanceof MetisErrorSaveJobQueue){
                logger.error(`****************************************************************`);
                logger.error(`** job.catch(error)`);
                logger.error(`****************************************************************`);
                logger.error(`${error}`);
                websocket.of('/registration').to(`registration-${error.job.created_at}`).emit('registrationFailed', error.job.created_at);
                return res.status(StatusCode.ServerErrorInternal).send({
                    message: 'Internal Error',
                    jobId: error.job.id,
                    code: MetisErrorCode.MetisError
                });
            }

            if(error instanceof BinaryAccountExistsError){
                return res.status(StatusCode.ClientErrorNotAcceptable).json({message: 'This account already has a binary account associated to it.', code:error.code})
            }

        }


        // const startTime = Date.now();
        // try {
        //     const userAccountProperties = req.user.gravityAccountProperties;
        //     const job = jobs.create('JimJobCreateBinaryAccount', {userAccountProperties})
        //         .priority('high')
        //         .removeOnComplete(false)
        //         .save(error => {
        //             logger.verbose(`---- JobQueue: JimJobCreateBinaryAccount.save()`);
        //             if (error) {
        //                 logger.error(`****************************************************************`);
        //                 logger.error(`** job.catch(error)`);
        //                 logger.error(`****************************************************************`);
        //                 logger.error(`${error}`);
        //                 websocket.of('/registration').to(`registration-${job.created_at}`).emit('registrationFailed', job.created_at);
        //                 return res.status(StatusCode.ServerErrorInternal).send({
        //                     message: 'Internal Error',
        //                     jobId: job.id,
        //                     code: MetisErrorCode.MetisError
        //                 });
        //             }
        //             logger.debug(`job.id= ${job.id}`);
        //             logger.debug(`job.created_at= ${job.created_at}`);
        //             websocket.of('/registration').to(`registration-${job.created_at}`).emit('registrationCreated', job.id);
        //             return res.status(StatusCode.SuccessAccepted).send({
        //                 job: {
        //                     id: job.id,
        //                     createdAt: job.created_at,
        //                     href: `/v1/api/job/status?jobId=${job.id}`,
        //                 }
        //             })
        //         });
        // } catch(error) {
        //     logger.error(`****************************************************************`);
        //     logger.error(`** /jim/v1/api/register -- .catch(error)`);
        //     logger.error(`****************************************************************`);
        //     console.log(error);
        //     if(error instanceof BinaryAccountExistsError){
        //         return res.status(StatusCode.ClientErrorNotAcceptable).json({message: 'This account already has a binary account associated to it.', code:error.code})
        //     }
        //     return res.status(StatusCode.ServerErrorInternal).json({message: 'internal error. please try again later.'})
        // }
    });

    app.get('/jim/v1/api/register', async (req, res) => {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== GET: /jim/v1/api/register');
        logger.info(`======================================================================================\n\n\n`);
        try {
            const userAccountProperties = req.user.gravityAccountProperties
            const binaryAccountProperties = await storageService.getBinaryAccountPropertiesOrNull(userAccountProperties);
            if(binaryAccountProperties === null){
                return res.status(StatusCode.ClientErrorNotFound).json({message: 'Binary Account Not Found', code: MetisErrorCode.MetisError })
            }
            return res.status(StatusCode.SuccessOK).json({ binaryAccount: {address: binaryAccountProperties.address} })
        }catch(error){
            logger.error(`****************************************************************`);
            logger.error(`** GET: /jim/v1/api/register -- .catch(error)`);
            logger.error(`****************************************************************`);
            console.log(error);
            if(error instanceof BinaryAccountExistsError){
                return res.status(StatusCode.ClientErrorNotAcceptable).json({message: 'This account already has a binary account associated to it.', code:error.code})
            }
            return res.status(StatusCode.ServerErrorInternal).json({message: 'internal error. please try again later.'})
        }
    });



};
