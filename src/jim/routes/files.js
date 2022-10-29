const mError = require('../../../errors/metisError')
const { storageService } = require('../services/storageService')
const { localFileCacheService } = require('../services/localFileCacheService')
const { chanService } = require('../../../services/chanService')
const { metisConfig } = require('../../../config/constants')
const { jupiterTransactionsService } = require('../../../services/jupiterTransactionsService')
const { transactionTags } = require('../config/transactionTags')
const gu = require('../../../utils/gravityUtils')
const busboy = require('busboy')
const fs = require('fs')
const { StatusCode } = require('../../../utils/statusCode')
const { MetisErrorCode } = require('../../../utils/metisErrorCode')
const { uploadJob } = require('../jobs/uploadJob')
const { jimConfig } = require('../config/jimConfig')
const logger = require('../../../utils/logger')(module)
const meter = require('stream-meter')
const { uploadControllerMulter } = require('../controllers/uploadControllerMulter')
const multer = require('multer')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './file_cache')
  },
  filename: function (req, file, cb) {
    const fileUuid = localFileCacheService.generateUuid()
    cb(null, `jim-${fileUuid}.data`)
  }
})

const upload = multer({ storage })

function abort(request, response, busboy, statusCode = StatusCode.ServerErrorInternal, metisError) {
  logger.error('#### abort()')
  logger.error(`statusCode= ${statusCode}`)
  logger.error(`metisError.code= ${metisError.code}`)
  logger.error(`metisError.message= ${metisError.message}`)
  request.unpipe(busboy)
  if (!response.aborted) {
    response.set('Connection', 'close')
    response.status(statusCode).send({ message: metisError.message, code: metisError.code })
  }

  // return res.status(StatusCode.ClientErrorNotAcceptable).send({
  //     message: `File size must be lower than ${jimConfig.maxMbSize} MB`,
  //     code: MetisErrorCode.MetisErrorFileTooLarge
  // });
}
const uploadController = (req, res, next, app, jobs, websocket) => {
  console.log('\n\n\n')
  logger.info('======================================================================================')
  logger.info('== uploadController')
  logger.info('======================================================================================\n\n\n')

  const fileCategoryTypes = {
    publicProfile: 'public-profile',
    channelProfile: 'channel-profile',
    raw: 'raw',
    thumbnail: 'thumbnail'
  }

  const WEBSOCKET_NAMESPACE = '/upload'
  const fileUploadData = {}
  const fileUuid = localFileCacheService.generateUuid()
  const bufferDataFilePath = localFileCacheService.generateBufferDataPath(fileUuid)
  const userAccountProperties = req.user.gravityAccountProperties
  fileUploadData.fileUuid = fileUuid
  fileUploadData.filePath = bufferDataFilePath
  fileUploadData.userAccountProperties = req.user.gravityAccountProperties

  const bb = busboy({
    headers: req.headers,
    limits: { files: 1, fileSize: jimConfig.maxBytesSize }
  })
  try {
    bb.on('field', (fieldName, value) => {
      logger.verbose('---- bb.on(field)')
      if (fieldName === 'attachToJupiterAddress') {
        if (!gu.isWellFormedJupiterAddress(value)) {
          return res.status(StatusCode.ClientErrorNotAcceptable).send({
            message: `attachToJupiterAddress is not valid: ${value}`,
            code: MetisErrorCode.MetisError
          })
        }
        fileUploadData.attachToJupiterAddress = value
        // fileUploadData.websocketRoom =  `upload-${fileUploadData.attachToJupiterAddress}`
      }
      if (fieldName === 'originalFileType') {
        fileUploadData.originalFileType = value
      }
      if (fieldName === 'fileCategory') {
        fileUploadData.fileCategory = value
      }
    })
    bb.on('file', (formDataKey, file, info) => {
      logger.sensitive('---- bb.on(file)')
      file.on('limit', () => {
        logger.sensitive('---- file.on(limit)')
        // console.log(data);
        const metisError = new mError.MetisErrorFileTooLarge()
        return abort(req, res, bb, StatusCode.ClientErrorNotAcceptable, metisError)
      })
      if (formDataKey !== 'file') {
        return abort(
          req,
          res,
          bb,
          StatusCode.ClientErrorNotAcceptable,
          new mError.MetisErrorBadRequestParams(`file key needs to be (file) not: ${formDataKey}`)
        )
        // return res.status(StatusCode.ClientErrorNotAcceptable).send({
        //     message: `file key needs to be (file) not: ${formDataKey}`,
        //     code: MetisErrorCode.MetisError
        // });
      }
      try {
        if (formDataKey === 'file') {
          logger.verbose('---- bb.on(file)')
          if (!gu.isNonEmptyString(info.filename)) {
            return abort(
              req,
              res,
              bb,
              StatusCode.ClientErrorNotAcceptable,
              new mError.MetisError(`filename is not valid: ${info.filename}`)
            )
            // return res.status(StatusCode.ClientErrorNotAcceptable).send({
            //     message: `filename is not valid: ${info.filename}`,
            //     code: MetisErrorCode.MetisError
            // });
          }
          if (!gu.isNonEmptyString(info.encoding)) {
            return abort(
              req,
              res,
              bb,
              StatusCode.ClientErrorNotAcceptable,
              new mError.MetisError(`encoding is not valid: ${info.encoding}`)
            )
            // return res.status(StatusCode.ClientErrorNotAcceptable).send({
            //     message: `encoding is not valid: ${info.encoding}`,
            //     code: MetisErrorCode.MetisError
            // });
          }
          if (!gu.isNonEmptyString(info.mimeType)) {
            return abort(
              req,
              res,
              bb,
              StatusCode.ClientErrorNotAcceptable,
              new mError.MetisError(`mimeType is not valid: ${info.mimeType}`)
            )
            // return res.status(StatusCode.ClientErrorNotAcceptable).send({
            //     message: `mimeType is not valid: ${info.mimeType}`,
            //     code: MetisErrorCode.MetisError
            // });
          }
          fileUploadData.fileName = info.filename
          fileUploadData.fileEncoding = info.encoding
          fileUploadData.fileMimeType = info.mimeType
          file.on('data', async (data) => {
            console.log(`CHUNK got ${data.length} bytes`)
          })
          const fsStream = fs.createWriteStream(bufferDataFilePath)
          fsStream.on('error', (error) => {
            logger.error(`Error writing file ${error}`)
            return abort(
              req,
              res,
              bb,
              StatusCode.ServerErrorInternal,
              new mError.MetisError(`Error writing file ${error}`)
            )
            // return res.status(StatusCode.ServerErrorInternal).send({
            //     message: 'Internal server error',
            //     code: MetisErrorCode.MetisError
            // });
          })
          const _meter = meter()
          file
            .pipe(_meter)
            .pipe(fsStream)
            .on('finish', () => {
              fileUploadData.fileSize = _meter.bytes
            })
        }
      } catch (error) {
        console.log('\n')
        logger.error('************************* ERROR ***************************************')
        logger.error('* ** bb.on(file).catch(error)')
        logger.error('************************* ERROR ***************************************\n')
        logger.error(`error= ${error}`)
        return abort(req, res, bb, StatusCode.ServerErrorInternal, error)
      }
    })
    bb.on('close', async () => {
      logger.verbose('---- bb.on(close)')
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
        if (fileUploadData.fileName === undefined) {
          throw new mError.MetisError(`fileName is invalid: ${fileUploadData.fileName}`)
        }
        if (fileUploadData.fileEncoding === undefined) {
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
          logger.verbose("---- jon.on('complete)")
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
        return abort(req, res, bb, StatusCode.ClientErrorBadRequest, error)
        // return res.status(StatusCode.ClientErrorBadRequest).send({message: error.message})
      }
    })
    req.on('aborted', () => abort(req, res, bb, StatusCode.ServerErrorInternal, new mError.MetisError('aborted')))
    bb.on('error', () => abort(req, res, bb, StatusCode.ServerErrorInternal, new mError.MetisError('error')))
    req.pipe(bb)
    return
  } catch (error) {
    logger.error('****************************************************************')
    logger.error('** job.catch(error)')
    logger.error('****************************************************************')
    console.log(error)
    if (error instanceof mError.MetisErrorSaveJobQueue) {
      return res.status(StatusCode.ServerErrorInternal).send({
        message: 'Internal Error',
        jobId: error.job.id,
        code: MetisErrorCode.MetisError
      })
    }
    return res.status(StatusCode.ServerErrorInternal).send({
      message: 'Internal Error',
      code: MetisErrorCode.MetisError
    })
  }
}

module.exports = (app, jobs, websocket) => {
  app.get('/jim/v1/api/users/:userAddress/files/public-profile', async (req, res) => {
    console.log('\n\n\n')
    logger.info('======================================================================================')
    logger.info('== GET: /jim/v1/profile/:userAddress')
    logger.info('======================================================================================\n\n\n')

    try {
      const { userAddress } = req.params
      if (!gu.isWellFormedJupiterAddress(userAddress)) throw new mError.MetisErrorBadJupiterAddress('', userAddress)

      const [messageContainers] =
        await jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(
          userAddress,
          transactionTags.jimServerTags.binaryFilePublicProfileSharedKey
        )

      if (!messageContainers) {
        return res.status(StatusCode.ClientErrorNotFound).send({ message: 'No image found' })
      }
      const messageContainerTag = messageContainers.attachment.message
      let fileUuid = ''
      let transactionId = ''
      let sharedKey = ''
      let tag = ''
      if (messageContainerTag.includes(`.${metisConfig.evm}`)) {
        ;[fileUuid, transactionId, sharedKey, tag] = messageContainers.attachment.message.split('.').slice(-4)
      } else {
        ;[fileUuid, transactionId, sharedKey] = messageContainers.attachment.message.split('.').slice(-3)
      }

      const fileInfo = await storageService.fetchFileInfoBySharedKey(
        transactionId,
        sharedKey,
        fileUuid,
        messageContainerTag
      )
      res.setHeader('Content-Type', `${fileInfo.mimeType}`)
      res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`)
      res.sendFile(fileInfo.bufferDataPath)
    } catch (error) {
      console.log('\n')
      logger.error('************************* ERROR ***************************************')
      logger.error('* ** /jim/v1/profile/:userAddress.catch(error)')
      logger.error('************************* ERROR ***************************************\n')
      console.log(error)
      if (error instanceof mError.MetisErrorBadJupiterAddress) {
        return res.status(StatusCode.ClientErrorNotAcceptable).send({ message: error.message, code: error.code })
      }
      return res.status(StatusCode.ServerErrorInternal).send({ message: 'Server Error.', code: error.code })
    }
  })

  //
  app.get('/jim/v1/api/users/:userAddress/files/:fileUuid/raw', async (req, res) => {
    console.log('\n\n\n')
    logger.info('======================================================================================')
    logger.info('== GET: /jim/v1/profile/:userAddress/files/:fileUuid')
    logger.info('======================================================================================\n\n\n')

    try {
      const userAccountProperties = req.user.gravityAccountProperties
      const { fileUuid, userAddress } = req.params
      if (!gu.isWellFormedUuid(fileUuid)) {
        throw new mError.MetisErrorBadJupiterAddress(`fileUuid is invalid: ${fileUuid}`)
      }
      if (!gu.isWellFormedJupiterAddress(userAddress)) throw new mError.MetisErrorBadJupiterAddress('', userAddress)

      const [messageContainers] =
        await jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(
          userAddress,
          transactionTags.jimServerTags.binaryFilePublicProfileSharedKey
        )
      if (!messageContainers) {
        return res.status(StatusCode.ClientErrorNotFound).send({ message: 'No image found' })
      }

      const messageContainerTag = messageContainers.attachment.message
      const fileInfo = await storageService.fetchFileInfo(userAccountProperties, fileUuid, messageContainerTag)
      res.setHeader('Content-Type', `${fileInfo.mimeType}`)
      res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`)
      res.sendFile(fileInfo.bufferDataPath)
    } catch (error) {
      console.log('\n')
      logger.error('************************* ERROR ***************************************')
      logger.error('* ** /jim/v1/profile/:userAddress/files/:fileUuid.catch(error)')
      logger.error('************************* ERROR ***************************************\n')
      console.log(error)
      if (error instanceof mError.MetisErrorBadUuid) {
        return res.status(StatusCode.ClientErrorNotAcceptable).send({ message: error.message, code: error.code })
      }
      if (error instanceof mError.MetisErrorBadJupiterAddress) {
        return res.status(StatusCode.ClientErrorNotAcceptable).send({ message: error.message, code: error.code })
      }
      if (error instanceof mError.MetisErrorNoChannelAccountFound) {
        return res.status(StatusCode.ClientErrorNotAcceptable).send({ message: error.message, code: error.code })
      }
      if (error instanceof mError.MetisErrorNoBinaryFileFound) {
        return res
          .status(StatusCode.ClientErrorNotFound)
          .send({ message: 'File Not Found', code: error.code, fileUuid: error.fileUuid })
      }
      return res.status(StatusCode.ServerErrorInternal).send({ message: 'Server Error.', code: error.code })
    }
  })

  app.get('/jim/v1/api/channels/:channelAddress/files/:fileUuid', async (req, res, next) => {
    console.log('\n\n\n')
    logger.info('======================================================================================')
    logger.info('== GET: /jim/v1/api/channels/:channelAddress/files/:fileUuid')
    logger.info('======================================================================================\n\n\n')
    try {
      const userAccountProperties = req.user.gravityAccountProperties
      const { fileUuid, channelAddress } = req.params
      if (!gu.isWellFormedUuid(fileUuid)) {
        throw new mError.MetisErrorBadJupiterAddress(`fileUuid is invalid: ${fileUuid}`)
      }
      if (!gu.isWellFormedJupiterAddress(channelAddress)) {
        throw new mError.MetisErrorBadJupiterAddress('', channelAddress)
      }
      const channelAccountProperties =
        await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(
          userAccountProperties,
          channelAddress
        )
      if (channelAccountProperties === null) {
        throw new mError.MetisErrorNoChannelAccountFound('', userAccountProperties.address, channelAddress)
      }
      const fileInfo = await storageService.fetchFileInfo(channelAccountProperties, fileUuid)
      const a = fileInfo

      res.setHeader('Content-Type', `${fileInfo.mimeType}`)
      res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`)
      res.sendFile(fileInfo.bufferDataPath)
    } catch (error) {
      console.log('\n')
      logger.error('************************* ERROR ***************************************')
      logger.error('* ** /jim/v1/api/channels/:channelAddress/files/:fileUuid.catch(error)')
      logger.error('************************* ERROR ***************************************\n')
      console.log(error)
      if (error instanceof mError.MetisErrorBadUuid) {
        return res.status(StatusCode.ClientErrorNotAcceptable).send({ message: error.message, code: error.code })
      }
      if (error instanceof mError.MetisErrorBadJupiterAddress) {
        return res.status(StatusCode.ClientErrorNotAcceptable).send({ message: error.message, code: error.code })
      }
      if (error instanceof mError.MetisErrorNoChannelAccountFound) {
        return res.status(StatusCode.ClientErrorNotAcceptable).send({ message: error.message, code: error.code })
      }
      if (error instanceof mError.MetisErrorNoBinaryFileFound) {
        return res
          .status(StatusCode.ClientErrorNotFound)
          .send({ message: 'File Not Found', code: error.code, fileUuid: error.fileUuid })
      }
      return res.status(StatusCode.ServerErrorInternal).send({ message: 'Server Error.', code: error.code })
    }
  })

  app.get('/jim/v1/api/files', async (req, res, next) => {
    console.log('\n\n\n')
    logger.info('======================================================================================')
    logger.info('== GET: /jim/v1/api/files')
    logger.info('======================================================================================\n\n\n')

    try {
      const userAccountProperties = req.user.gravityAccountProperties
      const { channelAddress } = req.query
      // const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(userAccountProperties,channelAddress);
      // if(channelAccountProperties === null) throw new mError.MetisErrorNoChannelAccountFound(`${userAccountProperties.address} doesnt have a channel account`)
      // const binaryAccountProperties = await storageService.fetchBinaryAccountPropertiesOrNull(channelAccountProperties);
      // if(binaryAccountProperties === null) throw new mError.MetisErrorNoBinaryAccountFound(`${channelAccountProperties.address} doesnt have a binary account`);
      // if(!gu.isWellFormedJupiterAddress(channelAddress)) throw new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)

      const filesList = await storageService.fetchChannelFilesList(userAccountProperties, channelAddress)
      // async fetchChannelFilesList(userAccountProperties, channelAddress){
      // const mappedFileList = filesList.map((file) => {
      //   return {
      //     fileUuid: file.fileUuid,
      //     fileCategory: file.fileCat,
      //     fileName: file.fileName,
      //     mimeType: file.mimeType,
      //     sizeInBytes: file.sizeInBytes,
      //     url: file.url,
      //     createdAt: file.createdAt,
      //     createdBy: file.createdBy,
      //     version: file.version
      //   }
      // })
      res.status(StatusCode.SuccessOK).send({
        message: `${filesList.length} file(s) found for ${channelAddress}`,
        files: filesList
      })
    } catch (error) {
      logger.error('********************** ERROR ******************************************')
      logger.error('** GET /jim/v1/api/files')
      logger.error('********************** ERROR ******************************************')
      console.log(error)
      res.status(StatusCode.ClientErrorBadRequest).send({ message: error.message })
    }
    res.end()
  })

  app.post('/jim/v1/api/files', async (req, res, next) => {
    uploadController(req, res, next, app, jobs, websocket)
  })

  app.post('/jim/v2/api/files', upload.single('file'), async (req, res, next) => {
    uploadControllerMulter(req, res, next, app, jobs, websocket)
  })
}
