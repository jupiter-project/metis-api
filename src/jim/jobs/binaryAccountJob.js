import {MetisError, MetisErrorSaveJobQueue} from "../../../errors/metisError";
// import {metisJobQueue} from "../../../server";
import {storageService} from "../services/storageService";
import {jobQueue} from "../../../config/configJobQueue";
// const {GravityAccountProperties} = require("../../../gravity/gravityAccountProperties");
import {GravityAccountProperties} from "../../../gravity/gravityAccountProperties";
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
            if(!job.data.hasOwnProperty('ownerAccountProperties')){
                throw new  MetisError(`ownerAccountProperties is empty`);
            }
            try {
                const _ownerAccountProperties = job.data.ownerAccountProperties;
                const ownerAccountProperties = await GravityAccountProperties.Clone(_ownerAccountProperties);
                const newBinaryAccountProperties = await storageService.createBinaryAccount(ownerAccountProperties);

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

    create(ownerAccountProperties){
        return new Promise((resolve, reject) => {
            const job = this.jobQueue.create(this.jobName, {ownerAccountProperties: ownerAccountProperties})
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

