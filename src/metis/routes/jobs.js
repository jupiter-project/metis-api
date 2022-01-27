// import mError from "../../../errors/metisError";
// import {chanService} from "../../../services/chanService";
// import {jupiterAccountService} from "../../../services/jupiterAccountService";
// import {jobScheduleService} from "../../../services/jobScheduleService";
import {kue} from "../../../services/queueService";
// import {kue} from "../../../config/configJobQueue";
// const gu = require('../../../utils/gravityUtils');
const {StatusCode} = require("../../../utils/statusCode");
const logger = require('../../../utils/logger')(module);
module.exports = (app, jobs, websocket) => {
    app.get('/v1/api/jobs/:jobId', (req, res, next) => {
        const {jobId} = req.params;
        kue.Job.get(jobId, (error,job)=>{
            if(error){
                console.log('\n')
                logger.error(`************************* ERROR ***************************************`);
                logger.error(`* ** '/v1/api/jobs/:jobId.catch(error)`);
                logger.error(`************************* ERROR ***************************************\n`);
                logger.error(`error= ${error}, jobId=${jobId}`);
                console.log(error);
                return res.status(StatusCode.ServerErrorInternal).send({ message: `Theres a problem with ${jobId}`});
            }
            res.status(StatusCode.SuccessOK).send({ message:'', state: job.state() });
        })
    });
};
