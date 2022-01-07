import mError from "../../../errors/metisError";
import PQueue from 'p-queue';
import {storageService} from "../services/storageService";
import {chanService} from "../../../services/chanService";
import { Readable } from 'stream';
const gu = require('../../../utils/gravityUtils');
const busboy = require('busboy');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {StatusCode} = require("../../../utils/statusCode");
const {MetisErrorCode} = require("../../../utils/metisErrorCode");
const {uploadJob} = require("../jobs/uploadJob");
const {jimConfig} = require("../config/jimConfig");
const logger = require('../../../utils/logger')(module);
const uuidv1 = require('uuidv1');
const meter = require('stream-meter');
const asyncHandler = require('express-async-handler');

module.exports = (app, jobs, websocket) => {

    // app.get('/v1/api/jupiter/alias/:aliasName', async (req, res) => {
    //     const aliasCheckup = await gravity.getAlias(req.params.aliasName);

    app.get('/jim/v1/api/channels/:channelAddress/files/:fileUuid'  , async (req, res,next) => {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== GET: /jim/v1/api/files/:fileUuid');
        logger.info(`======================================================================================\n\n\n`);

        const userAccountProperties =  req.user.gravityAccountProperties;
        const {fileUuid, channelAddress} = req.params;
        if(!gu.isWellFormedUuid(fileUuid)) {
            const message = `fileUuid is invalid: ${fileUuid}`;
            const error = new mError.MetisErrorBadJupiterAddress(message);
            console.log(error);
            return res.status(StatusCode.ClientErrorNotAcceptable).send({message: message, code: error.code});
        }
        if(!gu.isWellFormedJupiterAddress(channelAddress)) {
            const message = `channelAddress is invalid: ${channelAddress}`
            const error =  new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`);
            console.log(error);
            return res.status(StatusCode.ClientErrorNotAcceptable).send({message: message, code: error.code});
        }
        const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(userAccountProperties,channelAddress);
        if(channelAccountProperties === null) {
            const error = new mError.MetisErrorNoChannelAccountFound(`User ${userAccountProperties.address} doesnt have ${channelAddress} channel account`)
            console.log(error);
            return res.status(StatusCode.ClientErrorNotAcceptable).send({message: `User ${userAccountProperties.address} doesnt have ${channelAddress} channel account`, code: error.code});
        }
        try {
            const fileInfo = await storageService.fetchFile(channelAccountProperties, fileUuid);
            res.setHeader('Content-Type', `${fileInfo.mimeType}`);
            res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);
            const readable = Readable.from(fileInfo.bufferData.toString());
            readable.pipe(res);
        } catch(error){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** /jim/v1/api/channels/:channelAddress/files/:fileUuid.catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            console.log(error);
            if(error instanceof mError.MetisErrorNoBinaryFileFound){
                return res.status(StatusCode.ClientErrorNotFound).send({message: 'File Not Found', code: error.code, fileUuid: error.fileUuid});
            }
            res.status(StatusCode.ServerErrorInternal).send({message: 'Server Error.', code: error.code});
        }
    })

    app.get('/jim/v1/api/files'  , async (req, res,next) => {
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
            })
        } catch(error) {
            logger.error(`********************** ERROR ******************************************`);
            logger.error(`** GET /jim/v1/api/files`);
            logger.error(`********************** ERROR ******************************************`);
            console.log(error);
            res.status(StatusCode.ClientErrorBadRequest).send({message: error.message})
        }

    })

    app.post('/jim/v1/api/files'  , asyncHandler(async (req, res,next) => {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== POST: /jim/v1/api/files');
        logger.info(`======================================================================================\n\n\n`);

        const fileUploadData = new Map();
        const fileUuid = uuidv1();
        fileUploadData.set('fileUuid', fileUuid)
        fileUploadData.set('userAccountProperties', req.user.gravityAccountProperties)
        const filePath = path.join(os.tmpdir(), `jim-${fileUuid}`);
        fileUploadData.set('filePath', filePath)
        const workQueue = new PQueue({ concurrency: 1 });

        const bb = busboy({
            headers: req.headers,
            limits: {files: 1, fileSize: jimConfig.maxMbSize}
        });

        const abort = () => {
            logger.sensitive(`#### abort()`);
            req.unpipe(bb);
            workQueue.pause();
            if (!req.aborted) {
                res.set("Connection", "close");
                res.sendStatus(StatusCode.ClientErrorPayloadTooLarge);
            }
        }

        const abortOnError = async (fn) => {
            logger.sensitive(`#### abortOnError()`);
            workQueue.add( async () => {
                try {
                    await fn();
                } catch (e) {
                    abort();
                }
            });
        }

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
                    fileUploadData.set('attachToJupiterAddress', value);
                }
                logger.debug('DONE--on.field()')
            })

            bb.on('file', (formDataKey,file,info) => {
                logger.sensitive(`---- bb.on(file)`);
                if(formDataKey !== 'file') {
                    return res.status(StatusCode.ClientErrorNotAcceptable).send({
                        message: `file key needs to be (file) not: ${formDataKey}`,
                        code: MetisErrorCode.MetisError
                    });
                }
                abortOnError( ()=> {
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
                        fileUploadData.set('fileName', info.filename);
                        fileUploadData.set('fileEncoding', info.encoding);
                        fileUploadData.set('fileMimeType', info.mimeType);
                        file.on('data', async (data) => {
                            console.log(`CHUNK got ${data.length} bytes`);
                        })
                        const fsStream = fs.createWriteStream(filePath);
                        const m = meter();
                        file.pipe(m).pipe(fsStream).on('finish', () => {
                            fileUploadData.set('fileSize', m.bytes)
                        })
                        // fsStream.on('close', async ()=>{})
                    }
                })
            })
            bb.on('close', async () => {
                logger.verbose(`---- bb.on(close)`);
                try {
                    const fileSizeInBytes = fileUploadData.get('fileSize');
                    const fileSizeInKiloBytes = fileSizeInBytes / 1000;
                    const fileSizeInMegaBytes = fileSizeInKiloBytes / 1000;
                    if (fileSizeInBytes > jimConfig.maxMbSize) {
                        throw new mError.MetisError(`file is too large. Limit is ${jimConfig.maxMbSize} MB`)
                        // res.status(StatusCode.ClientErrorBadRequest).send({message: `file is too large. Limit is ${jimConfig.maxMbSize} MB`})
                    }
                    // res.status(StatusCode.ClientErrorBadRequest).send({message:`file is too large. Limit is ${jimConfig.maxMbSize} MB` })


                    //@TODO not needed. confirm before removing.
                    if (!gu.isWellFormedJupiterAddress(fileUploadData.get('attachToJupiterAddress'))) {
                        throw new mError.MetisError(`attachToJupiterAddress is invalid: ${fileUploadData.get('attachToJupiterAddress')}`)
                    }
                    if (fileUploadData.get('fileName') === undefined) {
                        throw new mError.MetisError(`fileName is invalid: ${fileUploadData.get('fileName')}`)
                        // res.status(StatusCode.ClientErrorBadRequest).send({message: `fileName is invalid: ${fileUploadData.get('fileName')}`})
                    }
                    if (fileUploadData.get('fileEncoding') === undefined) {
                        throw new mError.MetisError(`fileEncoding is invalid: ${fileUploadData.get('fileEncoding')}`)
                        // res.status(StatusCode.ClientErrorBadRequest).send({message: `fileEncoding is invalid: ${fileUploadData.get('fileEncoding')}`})
                    }
                    const uploadJobResponse = await uploadJob.create(
                        fileUploadData.get('userAccountProperties'),
                        fileUploadData.get('attachToJupiterAddress'),
                        fileUploadData.get('filePath'),
                        fileUploadData.get('fileName'),
                        fileUploadData.get('fileEncoding'),
                        fileUploadData.get('fileMimeType'),
                        fileUploadData.get('fileUuid')
                    );
                    const job = uploadJobResponse.job;
                    websocket.of('/upload').to(`upload-${job.created_at}`).emit('uploadCreated', job.id);
                    res.status(StatusCode.SuccessAccepted).send({
                        job: {
                            id: job.id,
                            createdAt: job.created_at,
                            url: `/v1/api/job/status?jobId=${job.id}`,
                        },
                        fileUuid: fileUuid,
                        fileUrl: `/v1/api/files/${fileUuid}`
                    })
                } catch(error) {
                    logger.error(`****************************************************************`);
                    logger.error(`** /jim/v1/api/file bb.on(Close)`);
                    logger.error(`****************************************************************`);
                    logger.error(`error= ${error}`)
                    res.status(StatusCode.ClientErrorBadRequest).send({message: error.message})
                }
            })
            req.on("aborted", abort);
            bb.on("error", abort);

            req.pipe(bb);
            return;
        } catch(error) {
            if(error instanceof mError.MetisErrorSaveJobQueue){
                logger.error(`****************************************************************`);
                logger.error(`** job.catch(error)`);
                logger.error(`****************************************************************`);
                logger.error(`${error}`);
                websocket.of('/upload').to(`upload-${error.job.created_at}`).emit('uploadFailed', error.job.created_at);
                return res.status(StatusCode.ServerErrorInternal).send({
                    message: 'Internal Error',
                    jobId: error.job.id,
                    code: MetisErrorCode.MetisError
                });
            }
            console.log(error);
            // websocket.of('/upload').to(`upload-${error.job.created_at}`).emit('uploadFailed', error.job.created_at);
            return res.status(StatusCode.ServerErrorInternal).send({
                message: 'Internal Error',
                code: MetisErrorCode.MetisError
            });
        }
    }))
};
