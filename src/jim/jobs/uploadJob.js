
import mError from "../../../errors/metisError";
import {storageService} from "../services/storageService";
import {GravityAccountProperties} from "../../../gravity/gravityAccountProperties";
import {jobQueue} from "../../../config/configJobQueue";
import {chanService} from "../../../services/chanService";
const gu = require('../../../utils/gravityUtils');
const fs = require('fs');
const logger = require('../../../utils/logger')(module);
const WORKERS = 100;

class UploadJob {

    constructor(jobQueue,channelService, storageService) {
        this.jobName = 'JimJobUpload'
        this.jobQueue = jobQueue;
        this.channelService = channelService;
        this.storageService = storageService;
        this.initialize();
    }

    initialize(){
        logger.sensitive(`#### initialize()`);
        this.jobQueue.process(this.jobName, WORKERS, async (job,done) => {
            logger.info(`##### initialize().jobQueue.process(jobName=${this.jobName}, WORKERS, callBack(job,done)`);
            try {
                const {userAccountProperties: _userAccountProperties, attachToJupiterAddress, filePath, fileName,fileEncoding,fileMimeType, fileUuid} = job.data;
                if(!gu.isWellFormedJupiterAddress(attachToJupiterAddress)) return done(new mError.MetisErrorBadJupiterAddress('attachToJupiterAddress'));
                if(!fileUuid) throw new mError.MetisError('fileUuid is invalid');
                if(!filePath) throw new mError.MetisError('filePath is invalid');
                if(!fileName) throw new mError.MetisError('fileName is invalid');
                if(!fileEncoding) throw new mError.MetisError('fileEncoding is invalid');
                if(!fileMimeType) throw new mError.MetisError('fileMimeType is invalid');
                const userAccountProperties = await GravityAccountProperties.Clone(_userAccountProperties);
                const attachToAccountProperties = await this.channelService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(userAccountProperties,attachToJupiterAddress);
                if(attachToAccountProperties === null) throw new  mError.MetisError(`No channel address found`)
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                logger.info(`++ Channel Properties`);
                logger.info(`++ address: ${attachToAccountProperties.address}`)
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                const binaryAccountProperties = await this.storageService.fetchBinaryAccountPropertiesOrNull(attachToAccountProperties);
                if(binaryAccountProperties === null) throw new mError.MetisErrorNoBinaryAccountFound('attachToAccountProperties.address')
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                logger.info(`++ Binary Account Properties`);
                logger.info(`++ address: ${binaryAccountProperties.address}`)
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                fs.readFile(filePath, async (error, bufferData) => {
                    try {
                        await this.storageService.sendFileToBlockchain(
                            fileName,
                            fileMimeType,
                            fileUuid,
                            bufferData,
                            attachToAccountProperties,
                            userAccountProperties.address
                        )
                        console.log('done');
                        return done(null, 'done')
                    } catch (error) {
                        logger.error(`****************************************************************`);
                        logger.error(`** initialize.jobQueue.readFile.callback.catch(error)`);
                        logger.error(`****************************************************************`);
                        logger.error(`error= ${error}`)
                        return done(error);
                    }
                });
                // const fd = await open(filePath);
                // const fsStream = fs.createReadStream(filePath);
                // fsStream.on('error', function (error) {
                //     console.log(`error: ${error.message}`);
                // })
                //
                // fsStream.on('data', (chunk) => {
                //     console.log(chunk);
                // })


                // const stream = fd.createReadStream();
                // const bufferData = fsStream


            } catch(error) {
                logger.error(`****************************************************************`);
                logger.error(`** metisJobQueue.process(JimJobCreateBinaryAccount).catch(error)`);
                logger.error(`****************************************************************`);
                console.log(error);
                return done(error);
            }
        })
    }

    /**
     *
     * @param userAccountProperties
     * @return {Promise<unknown>}
     */
    create(userAccountProperties, attachToJupiterAddress, filePath, fileName,fileEncoding,fileMimeType, fileUuid){

        if(!(userAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties('userAccountProperties')
        if(!gu.isWellFormedJupiterAddress(attachToJupiterAddress)) throw new mError.MetisErrorBadJupiterAddress(`attachToJupiterAddress`)
        if(!gu.isNonEmptyString(filePath)) throw new mError.MetisError(`filePath is empty`)
        if(!gu.isNonEmptyString(fileName)) throw new mError.MetisError(`fileName is empty`)
        if(!gu.isNonEmptyString(fileEncoding)) throw new mError.MetisError(`fileEncoding is empty`)
        if(!gu.isNonEmptyString(fileMimeType)) throw new mError.MetisError(`fileMimeType is empty`)
        if(!gu.isNonEmptyString(fileUuid)) throw new mError.MetisError(`fileUuid is empty`)

        return new Promise((resolve, reject) => {
            const job = this.jobQueue.create(this.jobName, {userAccountProperties,attachToJupiterAddress,filePath, fileName, fileEncoding, fileMimeType, fileUuid})
                .priority('high')
                .removeOnComplete(false)
                .save(error => {
                    logger.verbose(`---- JobQueue: ${this.jobName}.save()`);
                    if (error) {
                        reject(new mError.MetisErrorSaveJobQueue(job));
                    }
                    logger.debug(`job.id= ${job.id}`);
                    logger.debug(`job.created_at= ${job.created_at}`);
                    resolve({job})
                });
        })
    }
}

module.exports = {
    UploadJob: UploadJob,
    uploadJob: new UploadJob(jobQueue, chanService, storageService)
};

