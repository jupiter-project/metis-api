import mError from "../../../errors/metisError";
// import PQueue from 'p-queue';
import {storageService} from "../services/storageService";
import {localFileCacheService} from "../services/localFileCacheService";
import {chanService} from "../../../services/chanService";
import {jupiterAPIService} from "../../../services/jupiterAPIService";
import {userConfig} from "../../../config/constants";
import {FeeManager, feeManagerSingleton} from "../../../services/FeeManager";
import {jupiterTransactionsService} from "../../../services/jupiterTransactionsService";
import {GravityCrypto} from "../../../services/gravityCrypto";
import {transactionTags} from "../config/transactionTags";
const gu = require('../../../utils/gravityUtils');
const busboy = require('busboy');
const fs = require('fs');
const {StatusCode} = require("../../../utils/statusCode");
const {MetisErrorCode} = require("../../../utils/metisErrorCode");
const {uploadJob} = require("../jobs/uploadJob");
const {jimConfig} = require("../config/jimConfig");
const logger = require('../../../utils/logger')(module);
const meter = require('stream-meter');
// const asyncHandler = require('express-async-handler');


function abort(request, busboy){
    logger.verbose(`#### abort()`);
    request.unpipe(busboy);
    if (!request.aborted) {
        request.set("Connection", "close");
        request.sendStatus(StatusCode.ClientErrorPayloadTooLarge);
    }
}
const uploadController = (req,res,next,app,jobs,websocket) => {
    console.log(`\n\n\n`);
    logger.info('======================================================================================');
    logger.info('== uploadController');
    logger.info(`======================================================================================\n\n\n`);

    const fileCategoryTypes = {
        publicProfile: 'public-profile',
        raw: 'raw',
        thumbnail: 'thumbnail'
    }

    const WEBSOCKET_NAMESPACE = '/upload';
    const fileUploadData = {};
    const fileUuid = localFileCacheService.generateUuid();
    const bufferDataFilePath = localFileCacheService.generateBufferDataPath(fileUuid);
    const userAccountProperties = req.user.gravityAccountProperties;
    fileUploadData.fileUuid = fileUuid;
    fileUploadData.filePath = bufferDataFilePath;
    fileUploadData.userAccountProperties = req.user.gravityAccountProperties;
    const bb = busboy({
        headers: req.headers,
        limits: {files: 1, fileSize: jimConfig.maxMbSize}
    });
    try{
        bb.on('limit', (data)=> {
            logger.verbose(`---- bb.on(limit)`);
            console.log(data);
            return res.status(StatusCode.ClientErrorNotAcceptable).send({
                message: `File size must be lower than ${jimConfig.maxMbSize} MB`,
                code: MetisErrorCode.MetisError
            });
            //     req.file.size <= ApiConfig.maxMbSize * 1024 * 1024,
        })
        bb.on('field', (fieldName, value)=>{
            logger.verbose(`---- bb.on(field)`);
            if(fieldName === 'attachToJupiterAddress'){
                if(!gu.isWellFormedJupiterAddress(value)){
                    return res.status(StatusCode.ClientErrorNotAcceptable).send({
                        message: `attachToJupiterAddress is not valid: ${value}`,
                        code: MetisErrorCode.MetisError
                    });
                }
                fileUploadData.attachToJupiterAddress = value;
                // fileUploadData.websocketRoom =  `upload-${fileUploadData.attachToJupiterAddress}`
            }
            if (fieldName === 'originalFileType'){
                fileUploadData.originalFileType = value;
            }
            if( fieldName === 'fileCategory'){
                fileUploadData.fileCategory = value;
            }
        })
        bb.on('file', (formDataKey,file,info) => {
            logger.sensitive(`---- bb.on(file)`);
            if(formDataKey !== 'file') {
                return res.status(StatusCode.ClientErrorNotAcceptable).send({
                    message: `file key needs to be (file) not: ${formDataKey}`,
                    code: MetisErrorCode.MetisError
                });
            }
            try {
                if(formDataKey === 'file') {
                    logger.verbose(`---- bb.on(file)`);
                    if (!gu.isNonEmptyString(info.filename)) {
                        return res.status(StatusCode.ClientErrorNotAcceptable).send({
                            message: `filename is not valid: ${info.filename}`,
                            code: MetisErrorCode.MetisError
                        });
                    }
                    if (!gu.isNonEmptyString(info.encoding)) {
                        return res.status(StatusCode.ClientErrorNotAcceptable).send({
                            message: `encoding is not valid: ${info.encoding}`,
                            code: MetisErrorCode.MetisError
                        });
                    }
                    if (!gu.isNonEmptyString(info.mimeType)) {
                        return res.status(StatusCode.ClientErrorNotAcceptable).send({
                            message: `mimeType is not valid: ${info.mimeType}`,
                            code: MetisErrorCode.MetisError
                        });
                    }
                    fileUploadData.fileName = info.filename;
                    fileUploadData.fileEncoding = info.encoding;
                    fileUploadData.fileMimeType = info.mimeType;
                    file.on('data', async (data) => {
                        console.log(`CHUNK got ${data.length} bytes`);
                    })
                    const fsStream = fs.createWriteStream(bufferDataFilePath);
                    fsStream.on( 'error', error => {
                        logger.error(`Error writing file ${error}`);
                        return res.status(StatusCode.ServerErrorInternal).send({
                            message: 'Internal server error',
                            code: MetisErrorCode.MetisError
                        });
                    });
                    const _meter = meter();
                    file.pipe(_meter).pipe(fsStream).on('finish', () => {
                        fileUploadData.fileSize = _meter.bytes;
                    })
                }
            } catch (error){
                console.log('\n')
                logger.error(`************************* ERROR ***************************************`);
                logger.error(`* ** bb.on(file).catch(error)`);
                logger.error(`************************* ERROR ***************************************\n`);
                logger.error(`error= ${error}`)
                return abort(req,bb);
            }
        })
        bb.on('close', async () => {
            logger.verbose(`---- bb.on(close)`);
            try {
                if(!fileUploadData.hasOwnProperty('fileCategory')) throw new mError.MetisError('no fileCategory specified');
                const fileCategory = fileUploadData.fileCategory;
                const fileSizeInBytes = fileUploadData.fileSize;
                const fileSizeInKiloBytes = fileSizeInBytes / 1000;
                const fileSizeInMegaBytes = fileSizeInKiloBytes / 1000;
                const WEBSOCKET_ROOM = (fileCategory === fileCategoryTypes.publicProfile) ?
                    `upload-${userAccountProperties.address}` :
                    `upload-${fileUploadData.attachToJupiterAddress}`
                const fileUrl = (fileCategory === fileCategoryTypes.publicProfile) ?
                    `/jim/v1/api/users/${userAccountProperties.address}/files/${fileUuid}` :
                    `/jim/v1/api/channels/${fileUploadData.attachToJupiterAddress}/files/${fileUuid}`

                if (fileSizeInBytes > jimConfig.maxMbSize) {
                    throw new mError.MetisError(`file is too large. Limit is ${jimConfig.maxMbSize} MB`)
                }
                if (fileUploadData.fileName === undefined) {
                    throw new mError.MetisError(`fileName is invalid: ${fileUploadData.fileName}`)
                }
                if (fileUploadData.fileEncoding === undefined) {
                    throw new mError.MetisError(`fileEncoding is invalid: ${fileUploadData.fileEncoding}`)
                }
                const params = (fileCategory === fileCategoryTypes.publicProfile)?
                    {}:
                    {attachToJupiterAddress:fileUploadData.attachToJupiterAddress }
                const job = await uploadJob.create(
                    fileUploadData.userAccountProperties,
                    fileUploadData.fileName,
                    fileUploadData.fileEncoding,
                    fileUploadData.fileMimeType,
                    fileUploadData.fileUuid,
                    fileCategory,
                    params
                );
                // const fileUrl = ( fileCategory === fileCategoryTypes.publicProfile)?
                //     `/jim/v1/api/channels/${fileUploadData.attachToJupiterAddress}/files/${fileUuid}`:
                //     `/jim/v1/api/channels/${fileUploadData.attachToJupiterAddress}/files/${fileUuid}`;
                job.save( error => {
                    logger.verbose(`---- JobQueue: job.save(error)`);
                    if(error){
                        logger.error(`${error}`);
                        return res.status(StatusCode.ServerErrorInternal).send({message:'Not able to upload the image', code: MetisErrorCode.MetisErrorSaveJobQueue} )
                    }
                    logger.verbose(`job.id= ${job.id}`);
                    res.status(StatusCode.SuccessAccepted).send({
                        job: {
                            id: job.id,
                            createdAt: job.created_at,
                            url: `/v1/api/jobs/${job.id}`
                        },
                        fileUuid: fileUuid,
                        fileUrl: fileUrl
                    })
                    next();
                })
                job.on('complete', (result)=>{
                    logger.verbose(`---- jon.on('complete)`);
                    const payload = {
                        jobId: job.id,
                        senderAddress: userAccountProperties.address,
                        url: fileUrl,
                        fileName: fileUploadData.fileName,
                        mimeType: fileUploadData.mimeType,
                        size: fileUploadData.fileSize,
                        originalFileType: fileUploadData.originalFileType
                    }
                    websocket.of(WEBSOCKET_NAMESPACE).to(WEBSOCKET_ROOM).emit('uploadCreated', payload);
                })

                job.on('failed attempt', (errorMessage, doneAttempts)=>{
                    console.log('\n')
                    logger.error(`************************* ERROR ***************************************`);
                    logger.error(`* ** job.on(failedAttempt)`);
                    logger.error(`************************* ERROR ***************************************\n`);
                    logger.error(`errorMessage= ${errorMessage}`)
                    logger.error(`doneAttempts= ${doneAttempts}`)
                    const payload = {
                        senderAddress: userAccountProperties.address,
                        jobId: job.id,
                        errorMessage: errorMessage,
                        errorCode: MetisErrorCode.MetisError
                    }
                    websocket.of(WEBSOCKET_NAMESPACE).to(WEBSOCKET_ROOM).emit('uploadFailed', payload);
                })

                job.on('failed', (errorMessage)=>{
                    console.log('\n')
                    logger.error(`************************* ERROR ***************************************`);
                    logger.error(`* ** job.on(failed)`);
                    logger.error(`************************* ERROR ***************************************\n`);
                    logger.error(`errorMessage= ${errorMessage}`)

                    const errorCode = errorMessage.includes('Not enough funds') ?
                        MetisErrorCode.MetisErrorNotEnoughFunds:
                        MetisErrorCode.MetisError
                    const payload = {
                        senderAddress: userAccountProperties.address,
                        jobId: job.id,
                        errorMessage: errorMessage,
                        errorCode: errorCode
                    }
                    websocket.of(WEBSOCKET_NAMESPACE).to(WEBSOCKET_ROOM).emit('uploadFailed', payload);
                })
            } catch(error) {
                logger.error(`****************************************************************`);
                logger.error(`** /jim/v1/api/file bb.on(Close)`);
                logger.error(`****************************************************************`);
                console.log(error);
                return res.status(StatusCode.ClientErrorBadRequest).send({message: error.message})
            }
        })
        req.on("aborted", ()=> abort(req,bb));
        bb.on("error", ()=> abort(req,bb));
        req.pipe(bb);
        return;
    } catch(error) {
        logger.error(`****************************************************************`);
        logger.error(`** job.catch(error)`);
        logger.error(`****************************************************************`);
        console.log(error);
        if(error instanceof mError.MetisErrorSaveJobQueue){
            return res.status(StatusCode.ServerErrorInternal).send({
                message: 'Internal Error',
                jobId: error.job.id,
                code: MetisErrorCode.MetisError
            });
        }
        return res.status(StatusCode.ServerErrorInternal).send({
            message: 'Internal Error',
            code: MetisErrorCode.MetisError
        });
    }
}


module.exports = (app, jobs, websocket) => {

    app.get('/jim/v1/api/users/:userAddress/files/public-profile/info', async (req, res) => {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== GET: /jim/v1/profile/:userAddress');
        logger.info(`======================================================================================\n\n\n`);

        try {
            const {userAddress} = req.params;
            const userAccountProperties =  req.user.gravityAccountProperties;
            const [messageContainers] = await jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(userAddress, transactionTags.jimServerTags.binaryFilePublicProfileSharedKey);
            const [fileUuid, transactionId, sharedKey] = messageContainers.attachment.message.split('.').slice(-3);

            const fileInfo = await storageService.fetchFileInfoBySharedKey(transactionId, sharedKey, fileUuid);
            res.setHeader('Content-Type', `${fileInfo.mimeType}`);
            res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);
            res.sendFile(fileInfo.bufferDataPath);
            // res.status(StatusCode.SuccessOK).send(messageContainers || null);
        } catch (error){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** /jim/v1/profile/:userAddress.catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            console.log(error);
            if(error instanceof mError.MetisErrorBadJupiterAddress) {
                return res.status(StatusCode.ClientErrorNotAcceptable).send({message: error.message, code: error.code});
            }
            return res.status(StatusCode.ServerErrorInternal).send({message: 'Server Error.', code: error.code});
        }
    });

    //
    app.get('/jim/v1/api/users/:userAddress/files/:fileUuid/raw', async (req, res) => {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== GET: /jim/v1/profile/:userAddress/files/:fileUuid');
        logger.info(`======================================================================================\n\n\n`);

        try{
            const userAccountProperties =  req.user.gravityAccountProperties;
            const {fileUuid, userAddress} = req.params;
            if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadJupiterAddress(`fileUuid is invalid: ${fileUuid}`);
            if(!gu.isWellFormedJupiterAddress(userAddress)) throw new mError.MetisErrorBadJupiterAddress(``, userAddress);

            const fileInfo = await storageService.fetchFileInfo(userAccountProperties, fileUuid);
            res.setHeader('Content-Type', `${fileInfo.mimeType}`);
            res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);
            res.sendFile(fileInfo.bufferDataPath);
        } catch(error){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** /jim/v1/profile/:userAddress/files/:fileUuid.catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            console.log(error);
            if(error instanceof mError.MetisErrorBadUuid) {
                return res.status(StatusCode.ClientErrorNotAcceptable).send({message: error.message, code: error.code});
            }
            if(error instanceof mError.MetisErrorBadJupiterAddress) {
                return res.status(StatusCode.ClientErrorNotAcceptable).send({message: error.message, code: error.code});
            }
            if( error instanceof mError.MetisErrorNoChannelAccountFound) {
                return res.status(StatusCode.ClientErrorNotAcceptable).send({message: error.message, code: error.code});
            }
            if(error instanceof mError.MetisErrorNoBinaryFileFound){
                return res.status(StatusCode.ClientErrorNotFound).send({message: 'File Not Found', code: error.code, fileUuid: error.fileUuid});
            }
            return res.status(StatusCode.ServerErrorInternal).send({message: 'Server Error.', code: error.code});
        }
    });

    app.get('/jim/v1/api/channels/:channelAddress/files/:fileUuid'  , async (req, res,next) => {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== GET: /jim/v1/api/channels/:channelAddress/files/:fileUuid');
        logger.info(`======================================================================================\n\n\n`);
        try{
            const userAccountProperties =  req.user.gravityAccountProperties;
            const {fileUuid, channelAddress} = req.params;
            if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadJupiterAddress(`fileUuid is invalid: ${fileUuid}`);
            if(!gu.isWellFormedJupiterAddress(channelAddress)) throw new mError.MetisErrorBadJupiterAddress(``, channelAddress);
            const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(userAccountProperties,channelAddress);
            if(channelAccountProperties === null) throw new mError.MetisErrorNoChannelAccountFound(``, userAccountProperties.address, channelAddress);
            const fileInfo = await storageService.fetchFileInfo(channelAccountProperties, fileUuid);
            res.setHeader('Content-Type', `${fileInfo.mimeType}`);
            res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);
            res.sendFile(fileInfo.bufferDataPath);
        } catch(error){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** /jim/v1/api/channels/:channelAddress/files/:fileUuid.catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            console.log(error);
            if(error instanceof mError.MetisErrorBadUuid) {
                return res.status(StatusCode.ClientErrorNotAcceptable).send({message: error.message, code: error.code});
            }
            if(error instanceof mError.MetisErrorBadJupiterAddress) {
                return res.status(StatusCode.ClientErrorNotAcceptable).send({message: error.message, code: error.code});
            }
            if( error instanceof mError.MetisErrorNoChannelAccountFound) {
                return res.status(StatusCode.ClientErrorNotAcceptable).send({message: error.message, code: error.code});
            }
            if(error instanceof mError.MetisErrorNoBinaryFileFound){
                return res.status(StatusCode.ClientErrorNotFound).send({message: 'File Not Found', code: error.code, fileUuid: error.fileUuid});
            }
            return res.status(StatusCode.ServerErrorInternal).send({message: 'Server Error.', code: error.code});
        }
    })

    app.get('/jim/v1/api/files', async (req, res,next) => {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== GET: /jim/v1/api/files');
        logger.info(`======================================================================================\n\n\n`);

        try {
            const userAccountProperties =  req.user.gravityAccountProperties;
            const {channelAddress} = req.query;
            // const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(userAccountProperties,channelAddress);
            // if(channelAccountProperties === null) throw new mError.MetisErrorNoChannelAccountFound(`${userAccountProperties.address} doesnt have a channel account`)
            // const binaryAccountProperties = await storageService.fetchBinaryAccountPropertiesOrNull(channelAccountProperties);
            // if(binaryAccountProperties === null) throw new mError.MetisErrorNoBinaryAccountFound(`${channelAccountProperties.address} doesnt have a binary account`);
            // if(!gu.isWellFormedJupiterAddress(channelAddress)) throw new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)

            const filesList = await storageService.fetchChannelFilesList(userAccountProperties, channelAddress);
            //async fetchChannelFilesList(userAccountProperties, channelAddress){
            const mappedFileList = filesList.map(file => {
                return {
                    fileUuid: file.fileUuid,
                    fileCategory: file.fileCat,
                    fileName: file.fileName,
                    mimeType: file.mimeType,
                    sizeInBytes: file.sizeInBytes,
                    url: file.url,
                    createdAt: file.createdAt,
                    createdBy: file.createdBy,
                    version: file.version
                }
            })
            res.status(StatusCode.SuccessOK).send({
                message: `${filesList.length} file(s) found for ${channelAddress}`,
                files: filesList
            });
        } catch(error) {
            logger.error(`********************** ERROR ******************************************`);
            logger.error(`** GET /jim/v1/api/files`);
            logger.error(`********************** ERROR ******************************************`);
            console.log(error);
            res.status(StatusCode.ClientErrorBadRequest).send({message: error.message})
        }

    })

    app.post('/jim/v1/api/files', async (req, res,next) => {
        uploadController(req,res,next,app,jobs,websocket);
    })
};
