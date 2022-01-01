import {MetisError, MetisErrorSaveJobQueue} from "../../../errors/metisError";
// import {metisJobQueue} from "../../../server";
import {storageService} from "../services/storageService";
import {GravityAccountProperties} from "../../../gravity/gravityAccountProperties";
import {jobQueue} from "../../../config/configJobQueue";
const logger = require('../../../utils/logger')(module);
const WORKERS = 100;

class BinaryAccountJob{

    constructor(jobQueue) {
        this.jobName = 'JimJobCreateBinaryAccount'
        this.jobQueue = jobQueue;
        this.initialize();
    }

    initialize(){
        this.jobQueue.process(this.jobName, WORKERS, async (job,done) => {
            logger.info('##### metisJobQueue.process(JimJobCreateBinaryAccount)');
            if(!job.data.hasOwnProperty('userAccountProperties')){
                throw new  MetisError(`userAccountProperties is empty`);
            }
            try {
                const _userAccountProperties = job.data.userAccountProperties;
                const userAccountProperties = await GravityAccountProperties.Clone(_userAccountProperties);
                const newBinaryAccountProperties = await storageService.createBinaryAccount(userAccountProperties);

                console.log('done');
                return done(null, newBinaryAccountProperties)
            } catch(error) {
                logger.error(`****************************************************************`);
                logger.error(`** metisJobQueue.process(JimJobCreateBinaryAccount).catch(error)`);
                logger.error(`****************************************************************`);
                console.log(error);
                return done(error);
            }
        })
    }

    create(userAccountProperties){
        return new Promise((resolve, reject) => {
            const job = this.jobQueue.create(this.jobName, {userAccountProperties})
                .priority('high')
                .removeOnComplete(false)
                .save(error => {
                    logger.verbose(`---- JobQueue: JimJobCreateBinaryAccount.save()`);
                    if (error) {
                        reject(new MetisErrorSaveJobQueue(job));
                    }
                    logger.debug(`job.id= ${job.id}`);
                    logger.debug(`job.created_at= ${job.created_at}`);
                    resolve({job})
                });
        })
    }
}

module.exports = {
    BinaryAccountJob: BinaryAccountJob,
    binaryAccountJob: new BinaryAccountJob(jobQueue)
};

