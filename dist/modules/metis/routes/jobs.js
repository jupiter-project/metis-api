"use strict";
const { jobScheduleService  } = require('../../../services/jobScheduleService');
const { StatusCode  } = require('../../../utils/statusCode');
const logger = require('../../../utils/logger').default(module);
module.exports = (app, jobs, websocket)=>{
    /**
   *
   */ app.get('/v1/api/jobs/:jobId', (req, res, next)=>{
        console.log('');
        logger.info('======================================================================================');
        logger.info('==');
        logger.info('== Job Status');
        logger.info('== GET: /v1/api/jobs ');
        logger.info('==');
        logger.info('======================================================================================');
        console.log('');
        const { jobId  } = req.params;
        jobScheduleService.checkJobStatus(jobId, (error, job)=>{
            if (!error) {
                return res.status(StatusCode.SuccessOK).send({
                    message: '',
                    state: job.state()
                });
            }
            console.log(error);
            return res.status(StatusCode.ServerErrorInternal).send({
                message: `Theres a problem with ${jobId}`
            });
        });
    });
};
