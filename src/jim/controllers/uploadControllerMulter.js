const { localFileCacheService } = require('../services/localFileCacheService')
const gu = require('../../../utils/gravityUtils')
const { StatusCode } = require('../../../utils/statusCode')
const { MetisErrorCode } = require('../../../utils/metisErrorCode')
const logger = require('../../../utils/logger')(module)
const mError = require('../../../errors/metisError')
const fs = require('fs')
const { uploadJob } = require('../jobs/uploadJob')
const { jimConfig } = require('../config/jimConfig')

// TODO: VALIDATE FILE SIZE
const uploadControllerMulter = async (req, res, next, app, jobs, websocket) => {
  console.log(req.file)
  console.log(req.body)
  const { attachToJupiterAddress, originalFileType, fileCategory } = req.body
  const { filename, encoding, mimetype, size, path } = req.file

  const fileCategoryTypes = {
    publicProfile: 'public-profile',
    channelProfile: 'channel-profile',
    raw: 'raw',
    thumbnail: 'thumbnail'
  }

  const WEBSOCKET_NAMESPACE = '/upload'
  const fileUploadData = {}
  // TODO: Create function to get UUID from filename
  const fileUuid = String(filename).replace('jim-', '').replace('.data', '')
  const userAccountProperties = req.user.gravityAccountProperties
  fileUploadData.fileUuid = fileUuid
  fileUploadData.filePath = path
  fileUploadData.userAccountProperties = userAccountProperties
  fileUploadData.originalFileType = originalFileType
  fileUploadData.fileCategory = fileCategory
  fileUploadData.fileName = filename
  fileUploadData.fileEncoding = encoding
  fileUploadData.fileMimeType = mimetype
  fileUploadData.fileSize = size

  console.log(fileUploadData)
  // {
  //   fieldname: 'file',
  //   originalname: 'iamge.jpg',
  //   encoding: '7bit',
  //   mimetype: 'image/jpeg',
  //   destination: 'tmp/',
  //   filename: 'd965a11517f5e816b257e9c2e7e4fab1',
  //   path: 'tmp\\d965a11517f5e816b257e9c2e7e4fab1',
  //   size: 10298
  // }

  if (attachToJupiterAddress) {
    if (!gu.isWellFormedJupiterAddress(attachToJupiterAddress)) {
      return res.status(StatusCode.ClientErrorNotAcceptable).send({
        message: `attachToJupiterAddress is not valid: ${attachToJupiterAddress}`,
        code: MetisErrorCode.MetisError
      })
    }
    fileUploadData.attachToJupiterAddress = attachToJupiterAddress
  }

  try {
    if (!fileUploadData.hasOwnProperty('fileCategory')) throw new mError.MetisError('no fileCategory specified')
    const fileCategory = fileUploadData.fileCategory
    const fileSizeInBytes = fileUploadData.fileSize
    const fileSizeInKiloBytes = fileSizeInBytes / 1000
    const fileSizeInMegaBytes = fileSizeInKiloBytes / 1000
    const WEBSOCKET_ROOM =
      fileCategory === fileCategoryTypes.publicProfile
        ? `upload-${userAccountProperties.address}`
        : `upload-${fileUploadData.attachToJupiterAddress}`
    const fileUrl =
      fileCategory === fileCategoryTypes.publicProfile || fileCategory === fileCategoryTypes.channelProfile
        ? `/jim/v1/api/users/${fileUploadData.attachToJupiterAddress}/files/public-profile`
        : `/jim/v1/api/channels/${fileUploadData.attachToJupiterAddress}/files/${fileUuid}`

    if (fileSizeInMegaBytes > jimConfig.maxMbSize) {
      throw new mError.MetisError(`file is too large. Limit is ${jimConfig.maxMbSize} MB`)
    }
    if (!fileUploadData.fileName) {
      throw new mError.MetisError(`fileName is invalid: ${fileUploadData.fileName}`)
    }
    if (!fileUploadData.fileEncoding) {
      throw new mError.MetisError(`fileEncoding is invalid: ${fileUploadData.fileEncoding}`)
    }
    const params =
      fileCategory === fileCategoryTypes.publicProfile
        ? {}
        : { attachToJupiterAddress: fileUploadData.attachToJupiterAddress }

    const job = await uploadJob.create(
      fileUploadData.userAccountProperties,
      fileUploadData.fileName,
      fileUploadData.fileEncoding,
      fileUploadData.fileMimeType,
      fileUploadData.fileUuid,
      fileCategory,
      params
    )

    job.save((error) => {
      logger.verbose('---- JobQueue: job.save(error)')
      if (error) {
        logger.error(`${error}`)
        return res
          .status(StatusCode.ServerErrorInternal)
          .send({ message: 'Not able to upload the image', code: MetisErrorCode.MetisErrorSaveJobQueue })
      }
      logger.verbose(`job.id= ${job.id}`)
      res.status(StatusCode.SuccessAccepted).send({
        job: {
          id: job.id,
          createdAt: job.created_at,
          url: `/v1/api/jobs/${job.id}`
        },
        fileUuid: fileUuid,
        fileUrl: fileUrl
      })
      next()
    })
    job.on('complete', (result) => {
      console.log(result)
      logger.verbose("---- jon.on('complete)")
      console.log(fileUploadData.attachToJupiterAddress)
      const payload = {
        jobId: job.id,
        senderAddress: userAccountProperties.address,
        url: fileUrl,
        fileName: fileUploadData.fileName,
        mimeType: fileUploadData.mimeType,
        size: fileUploadData.fileSize,
        originalFileType: fileUploadData.originalFileType
      }
      websocket.of(WEBSOCKET_NAMESPACE).to(WEBSOCKET_ROOM).emit('uploadCreated', payload)
    })

    job.on('failed attempt', (errorMessage, doneAttempts) => {
      console.log('\n')
      logger.error('************************* ERROR ***************************************')
      logger.error('* ** job.on(failedAttempt)')
      logger.error('************************* ERROR ***************************************\n')
      logger.error(`errorMessage= ${errorMessage}`)
      logger.error(`doneAttempts= ${doneAttempts}`)
      const payload = {
        senderAddress: userAccountProperties.address,
        jobId: job.id,
        errorMessage: errorMessage,
        errorCode: MetisErrorCode.MetisError
      }
      websocket.of(WEBSOCKET_NAMESPACE).to(WEBSOCKET_ROOM).emit('uploadFailed', payload)
    })

    job.on('failed', (errorMessage) => {
      console.log('\n')
      logger.error('************************* ERROR ***************************************')
      logger.error('* ** job.on(failed)')
      logger.error('************************* ERROR ***************************************\n')
      logger.error(`errorMessage= ${errorMessage}`)
      /// 'File size too large ( 15.488063 MBytes) limit is: 1.6 MBytes'
      let errorCode = MetisErrorCode.MetisError
      if (errorMessage.includes('Not enough funds')) {
        errorCode = MetisErrorCode.MetisErrorNotEnoughFunds
      } else if (errorMessage.includes('File size too large')) {
        errorCode = MetisErrorCode.MetisErrorFileTooLarge
      }
      const payload = {
        senderAddress: userAccountProperties.address,
        jobId: job.id,
        errorMessage: errorMessage,
        errorCode: errorCode
      }
      websocket.of(WEBSOCKET_NAMESPACE).to(WEBSOCKET_ROOM).emit('uploadFailed', payload)
    })
  } catch (error) {
    logger.error('****************************************************************')
    logger.error('** /jim/v1/api/file bb.on(Close)')
    logger.error('****************************************************************')
    console.log(error)
    return res.status(StatusCode.ClientErrorBadRequest).send({ message: error.message })
  }
}

module.exports = { uploadControllerMulter }
