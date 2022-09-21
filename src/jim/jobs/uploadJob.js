const mError = require('../../../errors/metisError')
const { storageService } = require('../services/storageService')
const { localFileCacheService } = require('../services/localFileCacheService')
const { GravityAccountProperties } = require('../../../gravity/gravityAccountProperties')
const { jobQueue } = require('../../../config/configJobQueue')
const { chanService } = require('../../../services/chanService')
const { FeeManager, feeManagerSingleton } = require('../../../services/FeeManager')
const { jupiterAPIService } = require('../../../services/jupiterAPIService')
const { userConfig } = require('../../../config/constants')
const { GravityCrypto } = require('../../../services/gravityCrypto')

const gu = require('../../../utils/gravityUtils')
const fs = require('fs')
const logger = require('../../../utils/logger')(module)
const WORKERS = 100

// class UploadProfileJob {
//     /**
//      *
//      * @param jobQueue
//      * @param storageService
//      * @param fileCacheService
//      */
//     constructor(jobQueue, storageService, fileCacheService) {
//         this.jobName = 'JimJobUpload'
//         this.jobQueue = jobQueue;
//         this.storageService = storageService;
//         this.fileCacheService = fileCacheService;
//         this.initialize();
//     }
//
//     initialize(){
//         this.jobQueue.process(this.jobName, WORKERS, async (job,done) => {
//             try {
//                 const {userAccountProperties: _userAccountProperties, fileName, fileMimeType, fileUuid, fileCat} = job.data;
//                 const fileBufferDataPath = localFileCacheService.generateBufferDataPath(fileUuid);
//                 const userAccountProperties = await GravityAccountProperties.Clone(_userAccountProperties);
//                 if (!localFileCacheService.bufferDataExists(fileUuid)){
//                     throw new mError.MetisError('Something went wrong');
//                 }
//
//
//                 fs.readFile(fileBufferDataPath, async (error, bufferData) => {
//                     try {
//
//                         const sendFileToBlockChainResponse = await this.storageService.sendFileToBlockchain(
//                             fileName,
//                             fileMimeType,
//                             fileUuid,
//                             bufferData,
//                             userAccountProperties,
//                             userAccountProperties,
//                             fileCat  //'public-profile'
//                         );
//
//                         return done(null, sendFileToBlockChainResponse);
//                     } catch (error) {
//                         logger.error(`****************************************************************`);
//                         logger.error(`** [initializeUserData]: JOB initialize.fs.readFile.callback.sendFileToBloclChain.catch(error)`);
//                         logger.error(`****************************************************************`);
//                         console.log(error);
//                         return done(error);
//                     }
//                 });
//             } catch (error) {
//                 logger.error(`****************************************************************`);
//                 logger.error(`** [initializeUserData]: metisJobQueue.process(JimJobCreateBinaryAccount).catch(error)`);
//                 logger.error(`****************************************************************`);
//                 console.log(error);
//                 return done(error);
//             }
//         });
//     }
//
//     /**
//      *
//      * @param userAccountProperties
//      * @param attachToJupiterAddress
//      * @param fileName
//      * @param fileEncoding
//      * @param fileMimeType
//      * @param fileUuid
//      * @return {Promise<unknown>}
//      */
//     create(userAccountProperties, attachToJupiterAddress, fileName,fileEncoding,fileMimeType, fileUuid){
//         logger.verbose(`#### (, attachToJupiterAddress, fileName,fileEncoding,fileMimeType, fileUuid`);
//
//         if(!gu.isWellFormedJupiterAddress(attachToJupiterAddress)) throw new mError.MetisErrorBadJupiterAddress(`attachToJupiterAddress`)
//         if(!gu.isNonEmptyString(fileName)) throw new mError.MetisError(`fileName is empty`)
//         if(!gu.isNonEmptyString(fileEncoding)) throw new mError.MetisError(`fileEncoding is empty`)
//         if(!gu.isNonEmptyString(fileMimeType)) throw new mError.MetisError(`fileMimeType is empty`)
//         if(!gu.isNonEmptyString(fileUuid)) throw new mError.MetisError(`fileUuid is empty`)
//
//         const job = this.jobQueue.create(this.jobName, {userAccountProperties, attachToJupiterAddress, fileName, fileEncoding, fileMimeType, fileUuid})
//             .priority('high')
//             .removeOnComplete(false)
//             .save(error => {
//                 logger.verbose(`---- JOB.SAVE: ${this.jobName}.save()`);
//                 if (error) {
//                     console.log('\n')
//                     logger.error(`************************* ERROR ***************************************`);
//                     logger.error(`* ** JOB.SAVE: ${this.jobName}.save().catch(error)`);
//                     logger.error(`There is a problem saving to redis`);
//                     logger.error(`************************* ERROR ***************************************\n`);
//                     logger.error(`error= ${error}`)
//                     throw new mError.MetisErrorSaveJobQueue(error.message, job);
//                 }
//                 logger.debug(`job.id= ${job.id}`);
//                 logger.debug(`job.created_at= ${job.created_at}`);
//                 return job;
//             });
//         return job;
//     }
// }

const FILE_CATEGORY_TYPES = {
  PUBLIC_PROFILE: 'public-profile',
  CHANNEL_PROFILE: 'channel-profile',
  RAW: 'raw',
  THUMBNAIL: 'thumbnail'
}

class UploadJob {
  /**
   *
   * @param jobQueue
   * @param channelService
   * @param storageService
   * @param fileCacheService
   */
  constructor(jobQueue, channelService, storageService, fileCacheService) {
    logger.verbose(`#### constructor(jobQueue,channelService, storageService, fileCacheService)`)
    this.jobName = 'JimJobUpload'
    this.jobQueue = jobQueue
    this.channelService = channelService
    this.storageService = storageService
    this.fileCacheService = fileCacheService
    this.initialize()
  }

  /**
   *
   */
  initialize() {
    logger.verbose(`#### initialize()`)
    this.jobQueue.process(this.jobName, WORKERS, async (job, done) => {
      logger.info(`##### initialize().jobQueue.process(jobName=${this.jobName}, WORKERS, callBack(job,done)`)
      try {
        const {
          fileCategory,
          userAccountProperties: _userAccountProperties,
          fileName,
          fileEncoding,
          fileMimeType,
          fileUuid
        } = job.data
        if (!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid`, fileUuid)
        if (!fileName) throw new mError.MetisError('fileName is invalid')
        if (!fileEncoding) throw new mError.MetisError('fileEncoding is invalid')
        if (!fileMimeType) throw new mError.MetisError('fileMimeType is invalid')
        if (!fileCategory) throw new mError.MetisError('fileCategory is invalid')

        if (!this.fileCacheService.bufferDataExists(fileUuid)) throw new mError.MetisError(`The file is not found`)
        const fileBufferDataPath = localFileCacheService.generateBufferDataPath(fileUuid)
        const fromAccountProperties = await GravityAccountProperties.Clone(_userAccountProperties)
        let toAccountProperties = fromAccountProperties
        if (fileCategory === FILE_CATEGORY_TYPES.PUBLIC_PROFILE) {
          //
        } else {
          if (!job.data.hasOwnProperty('attachToJupiterAddress'))
            return done(new mError.MetisError('attachToJupiterAddress is missing'))
          const attachToJupiterAddress = job.data.attachToJupiterAddress
          if (!gu.isWellFormedJupiterAddress(job.data.attachToJupiterAddress))
            return done(
              new mError.MetisErrorBadJupiterAddress('attachToJupiterAddress', job.data.attachToJupiterAddress)
            )
          const attachToAccountProperties =
            await this.channelService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(
              fromAccountProperties,
              attachToJupiterAddress
            )
          if (attachToAccountProperties === null) throw new mError.MetisError(`No channel address found`)
          toAccountProperties = attachToAccountProperties
        }

        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
        logger.info(`++ To Properties`)
        logger.info(`++ address: ${toAccountProperties.address}`)
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
        fs.readFile(fileBufferDataPath, async (error, bufferData) => {
          try {
            const sendFileToBlockChainResponse = await this.storageService.sendFileToBlockchain(
              fileName,
              fileMimeType,
              fileUuid,
              bufferData,
              fromAccountProperties,
              toAccountProperties,
              fileCategory
            )
            return done(null, sendFileToBlockChainResponse)
          } catch (error) {
            logger.error(`****************************************************************`)
            logger.error(`** [initialize]: JOB initialize.fs.readFile.callback.sendFileToBloclChain.catch(error)`)
            logger.error(`****************************************************************`)
            console.log(error)
            return done(error)
          }
        })
      } catch (error) {
        logger.error(`****************************************************************`)
        logger.error(`** [initialize]: metisJobQueue.process(JimJobCreateBinaryAccount).catch(error)`)
        logger.error(`****************************************************************`)
        console.log(error)
        return done(error)
      }
    })
  }

  /**
   *
   * @param ownerAccountProperties
   * @param fileName
   * @param fileEncoding
   * @param fileMimeType
   * @param fileUuid
   * @param fileCategory
   * @param params
   * @return {*|void|Promise<any>}
   */
  create(ownerAccountProperties, fileName, fileEncoding, fileMimeType, fileUuid, fileCategory, params = {}) {
    logger.verbose(`#### (userAccountProperties, attachToJupiterAddress, fileName,fileEncoding,fileMimeType, fileUuid`)
    if (!(ownerAccountProperties instanceof GravityAccountProperties))
      throw new mError.MetisErrorBadGravityAccountProperties('userAccountProperties')
    if (!gu.isNonEmptyString(fileName)) throw new mError.MetisError(`fileName is empty`)
    if (!gu.isNonEmptyString(fileEncoding)) throw new mError.MetisError(`fileEncoding is empty`)
    if (!gu.isNonEmptyString(fileMimeType)) throw new mError.MetisError(`fileMimeType is empty`)
    if (!gu.isNonEmptyString(fileUuid)) throw new mError.MetisError(`fileUuid is empty`)
    if (fileCategory === FILE_CATEGORY_TYPES.PUBLIC_PROFILE) {
    } else {
      if (!params.hasOwnProperty('attachToJupiterAddress'))
        throw new mError.MetisError('attachToJupiterAddress is missing')
      if (!gu.isWellFormedJupiterAddress(params.attachToJupiterAddress))
        throw new mError.MetisErrorBadJupiterAddress(`attachToJupiterAddress`)
    }

    const jobData = {
      userAccountProperties: ownerAccountProperties,
      fileName,
      fileEncoding,
      fileMimeType,
      fileUuid,
      fileCategory,
      ...params
    }
    const job = this.jobQueue
      .create(this.jobName, jobData)
      .priority('high')
      .removeOnComplete(false)
      .save((error) => {
        logger.verbose(`---- JOB.SAVE: ${this.jobName}.save()`)
        if (error) {
          console.log('\n')
          logger.error(`************************* ERROR ***************************************`)
          logger.error(`* ** JOB.SAVE: ${this.jobName}.save().catch(error)`)
          logger.error(`There is a problem saving to redis`)
          logger.error(`************************* ERROR ***************************************\n`)
          logger.error(`error= ${error}`)
          throw new mError.MetisErrorSaveJobQueue(error.message, job)
        }
        logger.debug(`job.id= ${job.id}`)
        logger.debug(`job.created_at= ${job.created_at}`)
        return job
      })
    return job
  }
}

module.exports = {
  UploadJob: UploadJob,
  uploadJob: new UploadJob(jobQueue, chanService, storageService, localFileCacheService)
}
