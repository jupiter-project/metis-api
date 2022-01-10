
import mError from "../../../errors/metisError";
import {storageService} from "../services/storageService";
import {fileCacheService} from "../services/fileCacheService";
import {GravityAccountProperties} from "../../../gravity/gravityAccountProperties";
import {jobQueue} from "../../../config/configJobQueue";
import {chanService} from "../../../services/chanService";

const gu = require('../../../utils/gravityUtils');
const fs = require('fs');
const logger = require('../../../utils/logger')(module);
const WORKERS = 100;

class UploadJob {

    constructor(jobQueue,channelService, storageService, fileCacheService) {
        this.jobName = 'JimJobUpload'
        this.jobQueue = jobQueue;
        this.channelService = channelService;
        this.storageService = storageService;
        this.fileCacheService = fileCacheService;
        this.initialize();
    }

    initialize(){
        logger.sensitive(`#### initialize()`);
        this.jobQueue.process(this.jobName, WORKERS, async (job,done) => {
            logger.info(`##### initialize().jobQueue.process(jobName=${this.jobName}, WORKERS, callBack(job,done)`);
            try {
                const {userAccountProperties: _userAccountProperties, attachToJupiterAddress, fileName,fileEncoding,fileMimeType, fileUuid} = job.data;
                if(!gu.isWellFormedJupiterAddress(attachToJupiterAddress)) return done(new mError.MetisErrorBadJupiterAddress('attachToJupiterAddress'));
                if(!fileUuid) throw new mError.MetisError('fileUuid is invalid');
                if(!fileName) throw new mError.MetisError('fileName is invalid');
                if(!fileEncoding) throw new mError.MetisError('fileEncoding is invalid');
                if(!fileMimeType) throw new mError.MetisError('fileMimeType is invalid');
                if(!this.fileCacheService.bufferDataExists(fileUuid)) throw new mError.MetisError(`The file is not found`);
                const fileBufferDataPath = fileCacheService.generateBufferDataPath(fileUuid);
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
                fs.readFile(fileBufferDataPath, async (error, bufferData) => {
                    try {
                        const sendFileToBlockChainResponse = await  this.storageService.sendFileToBlockchain(
                            fileName,
                            fileMimeType,
                            fileUuid,
                            bufferData,
                            attachToAccountProperties,
                            userAccountProperties.address
                        )
                        const results = {}
                        return done(null, sendFileToBlockChainResponse);
                    } catch (error) {
                        logger.error(`****************************************************************`);
                        logger.error(`** JOB initialize.fs.readFile.callback.sendFileToBloclChain.catch(error)`);
                        logger.error(`****************************************************************`);
                        console.log(error);
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
     * @param attachToJupiterAddress
     * @param fileName
     * @param fileEncoding
     * @param fileMimeType
     * @param fileUuid
     * @return {Promise<unknown>}
     */
    create(userAccountProperties, attachToJupiterAddress, fileName,fileEncoding,fileMimeType, fileUuid){
        logger.sensitive(`#### (userAccountProperties, attachToJupiterAddress, fileName,fileEncoding,fileMimeType, fileUuid`);

        if(!(userAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties('userAccountProperties')
        if(!gu.isWellFormedJupiterAddress(attachToJupiterAddress)) throw new mError.MetisErrorBadJupiterAddress(`attachToJupiterAddress`)
        if(!gu.isNonEmptyString(fileName)) throw new mError.MetisError(`fileName is empty`)
        if(!gu.isNonEmptyString(fileEncoding)) throw new mError.MetisError(`fileEncoding is empty`)
        if(!gu.isNonEmptyString(fileMimeType)) throw new mError.MetisError(`fileMimeType is empty`)
        if(!gu.isNonEmptyString(fileUuid)) throw new mError.MetisError(`fileUuid is empty`)

        const job = this.jobQueue.create(this.jobName, {userAccountProperties,attachToJupiterAddress, fileName, fileEncoding, fileMimeType, fileUuid})
            .priority('high')
            .removeOnComplete(false)
            .save(error => {
                logger.verbose(`---- JOB.SAVE: ${this.jobName}.save()`);
                if (error) {
                    console.log('\n')
                    logger.error(`************************* ERROR ***************************************`);
                    logger.error(`* ** JOB.SAVE: ${this.jobName}.save().catch(error)`);
                    logger.error(`There is a problem saving to redis`);
                    logger.error(`************************* ERROR ***************************************\n`);
                    logger.error(`error= ${error}`)
                    throw new mError.MetisErrorSaveJobQueue(error.message, job);
                }
                logger.debug(`job.id= ${job.id}`);
                logger.debug(`job.created_at= ${job.created_at}`);
                return job;
            });
        return job;
    }
}

module.exports = {
    UploadJob: UploadJob,
    uploadJob: new UploadJob(jobQueue, chanService, storageService, fileCacheService)
};

