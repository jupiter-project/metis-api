import mError from "../../../errors/metisError";
const logger = require('../../../utils/logger')(module);
const gu = require('../../../utils/gravityUtils');
const {GravityAccountProperties} = require("../../../gravity/gravityAccountProperties");
const zlib = require('zlib');
import {chanService} from "../../../services/chanService";
import {localFileCacheService} from "./localFileCacheService";

/**
 *
 */
class StorageService {
    /**
     *
     * @param jupiterAPIService
     * @param jupiterTransactionsService
     * @param jupiterFundingService
     * @param jupiterAccountService
     */
    constructor(
        jupiterAPIService,
        jupiterTransactionsService,
        jupiterFundingService,
        jupiterAccountService,
        jimConfig,
        transactionUtils,
        chanService,
        fileCacheService
        ) {
        if(!(jupiterAPIService instanceof JupiterAPIService)){throw new Error('missing jupiterAPIService')}
        if(!(jupiterTransactionsService instanceof JupiterTransactionsService)){throw new Error('missing jupiterTransactionsService')}
        if(!(jupiterFundingService instanceof JupiterFundingService)){throw new Error('missing jupiterFundingService')}
        if(!(jupiterAccountService instanceof JupiterAccountService)){throw new Error('missing jupiterAccountService')}
        this.jupiterAPIService = jupiterAPIService;
        this.jupiterTransactionsService = jupiterTransactionsService;
        this.jupiterFundingService = jupiterFundingService;
        this.jupiterAccountService = jupiterAccountService;
        this.jimConfig = jimConfig;
        this.transactionUtils = transactionUtils;
        this.chanService = chanService;
        this.fileCacheService = fileCacheService;
    }

    /**
     * @description Fetch jupiter account info from the block-chain for a new random passphrase AND create a new transaction
     * associating this new account with the owner.
     * @param {GravityAccountProperties} ownerAccountProperties
     * @return {Promise<GravityAccountProperties>}
     */
    async createBinaryAccount(ownerAccountProperties){
        logger.sensitive(`#### createBinaryAccount(ownerAccountProperties)`);
        if(!(ownerAccountProperties instanceof GravityAccountProperties)){throw new Error('ownerAccountProperties is invalid')}
        try {
            //First: Make sure the owner account is not already associated with a binary account.
            logger.info(`¡ First: Make sure the owner account is not already associated with a binary account.`);
            // const binaryAccountExistsPromise = this.binaryAccountExists(ownerAccountProperties);
            const binaryAccountProperties = await this.fetchBinaryAccountPropertiesOrNull(ownerAccountProperties);
            if (binaryAccountProperties) {
                logger.warn('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                logger.warn(`++ this account already has an associated binary account`);
                logger.warn('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                throw new mError.MetisErrorBinaryAccountExistsError();
            }
            // Second: Generate a new Jupiter account
            logger.info(`¡ Second: Generate a new Jupiter account`);
            const newPassphrase = gu.generatePassphrase();
            const newPassword = gu.generateRandomPassword();
            const newBinaryAccountProperties = await instantiateGravityAccountProperties(newPassphrase, newPassword);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            logger.info(`++ NEW BINARY ACCOUNT`);
            logger.info(`++ Belongs to: ${ownerAccountProperties.address}`);
            logger.info(`++ address: ${newBinaryAccountProperties.address}`);
            logger.info(`++ publicKey: ${newBinaryAccountProperties.publicKey}`);
            logger.sensitive(`++ passphrase: ${newBinaryAccountProperties.passphrase}`);
            logger.sensitive(`++ password: ${newBinaryAccountProperties.password}`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            // Third: Provide initial funding.
            logger.info(`¡ Third: Provide initial funding`);;
            const provideInitialFundingResponse = await this.provideInitialFunding(ownerAccountProperties,newBinaryAccountProperties);
            const transactionIdForFunding = provideInitialFundingResponse.data.transaction;
            await this.jupiterFundingService.waitForTransactionConfirmation(transactionIdForFunding);
            //Fourth: Associate the new jupiter account with the owner account.
            logger.info(`¡ Fourth: Associate the new jupiter account with the owner account.`);
            const addBinaryRecordToAccountIfDoesntExistResponse = await this.addBinaryRecordToAccount(ownerAccountProperties, newBinaryAccountProperties)
            const binaryRecordTransactionId = this.transactionUtils.extractTransactionIdFromTransactionResponse(addBinaryRecordToAccountIfDoesntExistResponse);
            await this.jupiterFundingService.waitForTransactionConfirmation(binaryRecordTransactionId);


            return newBinaryAccountProperties;
        } catch(error){
            logger.error(`****************************************************************`);
            logger.error(`** createBinaryAccount(ownerAccountProperties).catch(error)`);
            logger.error(`****************************************************************`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }


    /**
     * Binary Account should have a minimum amount. It should be able to store a few files.
     *
     * @param funderAccountProperties
     * @param recipientProperties
     * @return {Promise<*>}
     */
    async provideInitialFunding(funderAccountProperties, recipientProperties){
        logger.sensitive(`#### provideInitialFunding(funderAccountProperties, recipientProperties`);
        if(!(recipientProperties instanceof GravityAccountProperties)){throw new MetisError('recipientProperties is invalid')}
        if(!(funderAccountProperties instanceof GravityAccountProperties)){throw new MetisError('funderAccountProperties is invalid')}
        const minimumBalanceAmount = this.jimConfig.binaryAccountMinimumBalance;
        logger.debug(`minimumBalanceAmount= ${minimumBalanceAmount}`)
        let transferAmount = 0;
        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
        const currentRecipientBalance = await this.jupiterFundingService.getBalance(recipientProperties.address);
        logger.debug(`currentRecipientBalance= ${currentRecipientBalance}`)
        if(currentRecipientBalance < minimumBalanceAmount){
            transferAmount = minimumBalanceAmount - currentRecipientBalance;
        }
        logger.debug(`transferAmount= ${transferAmount}`)
        return this.jupiterFundingService.transfer(funderAccountProperties, recipientProperties, transferAmount, fee);
    }



    /**
     *
     * @param gravityAccountProperties
     * @return {Promise<null|*>}
     */
    async fetchBinaryRecordAssociatedToAccountOrNull(gravityAccountProperties){
        logger.sensitive(`#### fetchBinaryRecordAssociatedToUserAccountPropertiesOrNull(userAccountProperties)`);
        if(!(gravityAccountProperties instanceof GravityAccountProperties)){throw new Error(`userAccountProperties is invalid`)}
        try{
            const tag = transactionTags.jimServerTags.binaryAccountRecord;
            const binaryRecordContainers = await this.jupiterTransactionsService.getReadableTaggedMessageContainers(
                gravityAccountProperties,
                tag,
                true,
                null,
                null,
                tns => tns.senderRS === gravityAccountProperties.address

            );
            if(binaryRecordContainers.length > 1){
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                logger.info(`++ There are more than 1 binaryRecords: ${binaryRecordContainers.length}`);
                logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            }
            const firstBinaryAccountContainer = gu.arrayShiftOrNull(binaryRecordContainers);
            if(!firstBinaryAccountContainer) {
                logger.debug(`Null binary found: ${gravityAccountProperties.address}`);
                return null
            }

            return firstBinaryAccountContainer.message;
        } catch (error){
            logger.error(`Error-> [fetchBinaryRecordAssociatedToAccountOrNull]: ${gravityAccountProperties.address}`);
            console.log(error);
            throw error;
        }
    }

    /**
     *
     * @param ownerAccountProperties
     * @return {Promise<GravityAccountProperties>}
     */
    async fetchBinaryAccountPropertiesOrNull(ownerAccountProperties){
        logger.sensitive(`#### fetchBinaryAccountPropertiesOrNull(ownerAccountProperties)`);
        const binaryRecord = await this.fetchBinaryRecordAssociatedToAccountOrNull(ownerAccountProperties);
        if(binaryRecord === null){
            return null;
        }

        return instantiateGravityAccountProperties(binaryRecord.passphrase, binaryRecord.password);
    }


    /**
     *
     * @param ownerAccountProperties
     * @return {Promise<boolean>}
     */
    async binaryAccountExists(ownerAccountProperties){
        logger.sensitive(`#### binaryAccountExists()`);
        if(!(ownerAccountProperties instanceof GravityAccountProperties)){throw new Error(`ownerAccountProperties is invalid`)}
        const binaryRecord = await this.fetchBinaryRecordAssociatedToAccountOrNull(ownerAccountProperties);
        if(binaryRecord === null){
            return false;
        }
        return true;
    }

    /**
     *
     * @param {GravityAccountProperties} ownerAccountProperties
     * @param {GravityAccountProperties} binaryAccountProperties
     * @return {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async addBinaryRecordToAccount(ownerAccountProperties, binaryAccountProperties) {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('==  addBinaryRecordToAccountIfDoesntExist(ownerAccountProperties, binaryAccountProperties)');
        logger.info(`======================================================================================\n\n\n`);
        if(!(ownerAccountProperties instanceof GravityAccountProperties)){throw new Error('invalid ownerAccountProperties')}
        if(!(binaryAccountProperties instanceof GravityAccountProperties)){throw new Error('invalid binaryAccountProperties')}
        try {
            const binaryAccountExists = await this.binaryAccountExists(ownerAccountProperties);
            if (binaryAccountExists) {
                throw new Error('binary account already exists!');
            }
            const binaryRecordPayload = this.generateBinaryAccountRecordJson(binaryAccountProperties);
            console.log(`\n`);
            logger.sensitive('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            logger.sensitive(`++ binaryRecordPayload: ${JSON.stringify(binaryRecordPayload)}`);
            logger.sensitive('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n');
            const encryptedChannelRecordPayload = ownerAccountProperties.crypto.encryptJson(binaryRecordPayload);
            const feeType = FeeManager.feeTypes.metisMessage;
            const recordTag = `${transactionTags.jimServerTags.binaryAccountRecord}.${binaryAccountProperties.address}`;
            return this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
                ownerAccountProperties.passphrase,
                ownerAccountProperties.address,
                encryptedChannelRecordPayload,
                recordTag,
                feeType,
                ownerAccountProperties.publicKey
            )
        } catch(error) {
            logger.error(`****************************************************************`);
            logger.error(`** addBinaryRecordToAccountIfDoesntExist(ownerAccountProperties, binaryAccountProperties).catch(error)`);
            logger.error(`****************************************************************`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }

    /**
     *
     * @param userAccountProperties
     * @param channelAddress
     * @return {Promise<*[]>}
     */
    async fetchChannelFilesList(userAccountProperties, channelAddress){
        logger.debug(`#### fetchChannelFilesList(userAccountProperties, channelAddress)`);
        logger.info(`- Getting ready to get the files for ${channelAddress}`);
        const channelAccountProperties = await this.chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(userAccountProperties,channelAddress);
        if(channelAccountProperties === null) throw new mError.MetisErrorNoChannelAccountFound(`User ${userAccountProperties.address} doesnt have ${channelAddress} channel account`)
        logger.info(`- Confirmed user has permission to access this channel`);
        const binaryAccountProperties = await this.fetchBinaryAccountPropertiesOrNull(channelAccountProperties);
        if(binaryAccountProperties === null) throw new mError.MetisErrorNoBinaryAccountFound(`${channelAccountProperties.address} doesnt have a binary account`);
        if(!gu.isWellFormedJupiterAddress(channelAddress)) throw new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)
        const blackListTag =  `${transactionTags.jimServerTags.binaryFileBlackList}`;
        const blackList = await this.jupiterTransactionsService.fetchLatestReferenceList(binaryAccountProperties,blackListTag);
        const fileTag = `${transactionTags.jimServerTags.binaryFileRecord}`;
        const allFileRecordTransactions = await this.jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(
            binaryAccountProperties.address,
            fileTag
        )

        logger.info(`- Queried binary account for files. Found a total of ${allFileRecordTransactions.length}`);
        if(allFileRecordTransactions.length === 0){
            return []
        }
        const filteredFileRecordTransactions = this.transactionUtils.filterTransactionsByTransactionIds(
            allFileRecordTransactions,
            blackList
        )
        logger.info(`- Applied the blacklist resulting in  ${filteredFileRecordTransactions.length}`);
        if(filteredFileRecordTransactions.length === 0){
            return []
        }

        // @info The message was mEncrypted using the owner(ie channel) password.
        const messageContainers = await this.jupiterTransactionsService.messageService.getReadableMessageContainersFromTransactions(
            filteredFileRecordTransactions,
            binaryAccountProperties
        )

        const channelFilesList = messageContainers.map(containers => containers.message);

        return channelFilesList;
    }

    /**
     *
     * @param {GravityAccountProperties} ownerAccountProperties
     * @return {Promise<[{fileUuid: string}]>}
     */
    async fetchFilesList(ownerAccountProperties){
        logger.sensitive(`#### fetchFilesList(ownerAccountProperties,fileOwnerAddress)`);
        const binaryAccountProperties = await this.fetchBinaryAccountPropertiesOrNull(ownerAccountProperties);
        if (binaryAccountProperties === null) {
            throw new mError.MetisError(`No Binary Account Found for ${ownerAccountProperties.address} `);
        }
        return [{
            uuid: '123',
            filename: '',
            fileOwnerAddress: fileOwnerAddress,
            href: `/jim/v1/api/files/123`,
        }]
    }


    /**
     *
     * @param ownerAccountProperties
     * @param fileUuid
     * @return {Promise<{bufferDataPath: string, fileName: *, fileCategory: ("raw"|"thumbnail"), fileSizeInBytes, mimeType: *, originalSenderAddress}>}
     */
    async fetchFileInfo(ownerAccountProperties, fileUuid){
        logger.sensitive(`#### fetchFile(ownerAccountProperties, fileUuid)`);
        if(!(ownerAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`ownerAccountProperties`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid: ${fileUuid}`);
        let bufferData = null;
        let fileRecord = null;
        try {
            const binaryAccountProperties = await this.fetchBinaryAccountPropertiesOrNull(ownerAccountProperties);
            if (binaryAccountProperties === null) {
                throw new mError.MetisError(`No Binary Account Found for ${ownerAccountProperties.address} `);
            }
            if(this.fileCacheService.cachedFileExists(fileUuid)){
                const encryptedFileRecord = this.fileCacheService.getFileRecord(fileUuid);
                fileRecord = binaryAccountProperties.crypto.decryptAndParse(encryptedFileRecord);
            } else {
                const fetchFileFromBlockChainResponse = await this.fetchFileFromBlockChain(ownerAccountProperties,fileUuid);
                bufferData = fetchFileFromBlockChainResponse.bufferData;
                fileRecord = fetchFileFromBlockChainResponse.fileRecord;
                const encryptedFileRecord = binaryAccountProperties.encryptJson(fileRecord);
                this.fileCacheService.sendBufferDataToCache(fileUuid,bufferData);
                this.fileCacheService.sendFileRecordToCache(fileUuid,encryptedFileRecord);
            }
            const bufferDataPath = this.fileCacheService.generateBufferDataPath(fileUuid);
            return {
                bufferDataPath: bufferDataPath,
                mimeType: fileRecord.mimeType,
                fileName: fileRecord.fileName,
                fileCategory: fileRecord.fileCat,
                createdBy: fileRecord.createdBy,
                sizeInBytes: fileRecord.sizeInBytes
            }

        } catch(error) {
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** fetchFile(ownerAccountProperties, fileUuid).catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }

    async fetchFileFromBlockChain(ownerAccountProperties, fileUuid){
        logger.sensitive(`#### fetchFileFromBlockChain()`);
        if(!(ownerAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`ownerAccountProperties`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid: ${fileUuid}`);
        try {
            const binaryAccountProperties = await this.fetchBinaryAccountPropertiesOrNull(ownerAccountProperties);
            if(!(binaryAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`binaryAccountProperties`);
            const fileRecordTag = `${transactionTags.jimServerTags.binaryFileRecord}.${fileUuid}`;
            const fileRecordMessageContainers = await this.jupiterTransactionsService.getReadableTaggedMessageContainers(
                binaryAccountProperties,
                fileRecordTag
            )
            if (fileRecordMessageContainers.length === 0) {
                throw new mError.MetisErrorNoBinaryFileFound(``, fileUuid);
            }
            // GET THE FIRST ONE.
            const fileRecordMessageContainer = fileRecordMessageContainers[0]
            const fileRecord = fileRecordMessageContainer.message;
            const chunkTransactionIds = fileRecordMessageContainer.message.chunkTransactionIds;
            const chunkContainers = await this.jupiterTransactionsService.messageService.getReadableMessageContainersFromMessageTransactionIds(chunkTransactionIds, binaryAccountProperties.passphrase)
            if(chunkContainers.length === 0){
                throw new mError.MetisErrorNoBinaryFileFound(`No Chunks found`, fileUuid);
            }
            const compressedFile = chunkContainers.reduce((reduced, chunkContainer) => {
                reduced += chunkContainer.message;
                return reduced;
            }, '')
            const bufferData = zlib.inflateSync(Buffer.from(compressedFile, 'base64')); //@TODO compressing might be worthless since the files are encrypted. Usually encryted files cant be compressed much.
            return {
                bufferData: bufferData,
                fileRecord: fileRecord
            }
        }catch(error){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** fetchFileFromBlockChain(ownerAccountProperties, fileUuid).catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }


    /**
     * Push a file into the Jupiter blockchain
     * The file is splitted into chunks of CHUNK_SIZE_PATTERN
     * and pushed by the binary client
     *
     * @param fileName
     * @param bufferData
     * @param ownerAccountProperties - this is usually the channel Account
     * @return {Promise<{[p: number]: boolean, fileName, fileSize: number, id: *, txns: *}>}
     */
    async sendFileToBlockchain(
        fileName,
        mimeType,
        fileUuid,
        bufferData,
        ownerAccountProperties,
        originalSenderAddress = null,
    ) {
        console.log(`\n\n\n`);
        logger.info('======================================================================================');
        logger.info('== sendFileToBlockchain(fileName,mimeType,bufferData,ownerAccountProperties,originalSenderAddress)');
        logger.info(`======================================================================================\n\n\n`);
        if(!gu.isNonEmptyString(fileName)) throw new mError.MetisError(`fileName`)
        if(!gu.isNonEmptyString(mimeType)) throw new mError.MetisError(`mimeType`)
        if(!gu.isNonEmptyString(fileUuid)) throw new mError.MetisError(`fileUuid`)
        if(!bufferData) throw new mError.MetisError(`bufferData is invalid`)
        if(!(ownerAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`ownerAccountProperties`)
        try {
            if (originalSenderAddress === null) {
                originalSenderAddress = ownerAccountProperties.address;
            }
            const CHUNK_SIZE_PATTERN = /.{1,40000}/g;
            const fileSizeInBytes = bufferData.length;
            const fileSizeInKiloBytes = fileSizeInBytes / 1000;
            const fileSizeInMegaBytes = fileSizeInKiloBytes / 1000;
            if (fileSizeInMegaBytes > jimConfig.maxMbSize) {
                throw new Error(`File size too large ( ${fileSizeInMegaBytes} MBytes) limit is: ${jimConfig.maxMbSize} MBytes`)
            }
            const binaryAccountProperties = await this.fetchBinaryAccountPropertiesOrNull(ownerAccountProperties);
            if (binaryAccountProperties === null) {
                throw new mError.MetisError(`No Binary Account Found for ${ownerAccountProperties.address} `);
            }
            // compress the binary data before to convert to base64
            const encodedFileData = zlib.deflateSync(Buffer.from(bufferData)).toString('base64')
            const chunks = encodedFileData.match(CHUNK_SIZE_PATTERN)
            logger.sensitive(`chunks.length=${JSON.stringify(chunks.length)}`);
            // const fee = this.jupiterFundingService.getTotalDataFee(chunks);
            //Send Each Chunk as a transaction.
            const sendMessageResponsePromises = chunks.map(chunk => {
                const encryptedChunk = ownerAccountProperties.crypto.encrypt(chunk)
                logger.info(`sending chunk (${chunk.length})....`)
                return this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
                    ownerAccountProperties.passphrase,
                    binaryAccountProperties.address,
                    chunk,
                    `${transactionTags.jimServerTags.binaryFileChunk}.${fileUuid}`,
                    FeeManager.feeTypes.metisMessage,
                    binaryAccountProperties.publicKey
                )
            })
            const sendMessageResponses = await Promise.all(sendMessageResponsePromises);
            logger.sensitive(`sendMessageResponses.length=${JSON.stringify(sendMessageResponses.length)}`);
            const allChunkTransactionIds = this.transactionUtils.extractTransactionIdsFromTransactionResponses(sendMessageResponses)

            console.log(`\n`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            logger.info(`++ allChunkTransactionIds: ${JSON.stringify(allChunkTransactionIds)}`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n');
            const fileCat = 'raw';
            const linkedFileRecords = null
            const fileRecord = this.generateFileRecordJson(
                fileUuid,
                fileCat,
                fileName,
                mimeType,
                fileSizeInBytes,
                allChunkTransactionIds,
                originalSenderAddress,
                linkedFileRecords
            )


            const encryptedFileRecord = binaryAccountProperties.crypto.encryptJson(fileRecord);

            if(!this.fileCacheService.bufferDataExists(fileUuid)){
                this.fileCacheService.sendBufferDataToCache(fileUuid,bufferData);
            }
            this.fileCacheService.sendFileRecordToCache(fileUuid, encryptedFileRecord);

            const sendMessageResponseBinaryFile = await this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
                ownerAccountProperties.passphrase,
                binaryAccountProperties.address,
                encryptedFileRecord,
                `${transactionTags.jimServerTags.binaryFileRecord}.${fileUuid}`,
                FeeManager.feeTypes.metisMessage,
                binaryAccountProperties.publicKey
            )

            return {
                fileRecord: fileRecord,
            }
        } catch(error) {
            logger.error(`****************************************************************`);
            logger.error(`** sendFileToBlockchain.catch(error)`);
            logger.error(`****************************************************************`);
            logger.error(`error= ${error}`)
            throw error;
        }
}


    /**
     * @param {string} fileUuid
     * @param {('raw'|'thumbnail')} fileCat
     * @param {string} fileName
     * @param {string} mimeType
     * @param {number} sizeInBytes
     * @param chunkTransactionIds
     * @param {string} createdByAddress
     * @param {null|object[]} linkedFileRecords
     * @return {{fileName, fileCat, recordType: string, chunkTransactionIds, mimeType, sizeInKb, originalSenderAddress, linkedFileRecord, version: number, fileUuid, url: string, status: string}}
     */
    generateFileRecordJson(
        fileUuid,
        fileCat,
        fileName,
        mimeType,
        sizeInBytes,
        chunkTransactionIds,
        createdByAddress,
        linkedFileRecords
    ){
        logger.sensitive(`#### generateFileRecordJson()`);
        if(!gu.isNonEmptyString(fileUuid)) throw new mError.MetisError(`empty fileUuid`)
        if(!gu.isNonEmptyString(fileName)) throw new mError.MetisError(`empty fileName`)
        if(!gu.isNonEmptyString(mimeType)) throw new mError.MetisError(`empty mimeType`)
        if(!gu.isNumberGreaterThanZero(sizeInBytes)) throw new mError.MetisError(`size is invalid: ${sizeInBytes}`)
        if(!gu.isNonEmptyArray(chunkTransactionIds)) throw new mError.MetisError(`chunkTransactionIds is not valid.`);
        if(!gu.isWellFormedJupiterAddress(createdByAddress)) throw new mError.MetisErrorBadJupiterAddress(`originalSenderAddress`)
        // const _transactionIdOfPreviousVersion = (transactionIdOfPreviousVersion===null)?'':transactionIdOfPreviousVersion;
        return {
            fileUuid: fileUuid,
            recordType: 'fileRecord',
            status: 'active',
            fileCat: fileCat,
            fileName: fileName,
            mimeType: mimeType,
            sizeInBytes: sizeInBytes,
            url: `v1/jim/files/${fileUuid}`,
            createdAt: Date.now(),
            createdBy: createdByAddress,
            linkedFileRecords: linkedFileRecords,
            chunkTransactionIds: chunkTransactionIds,
            version: 1
        }
    }

    /**
     *
     * @param {GravityAccountProperties} binaryAccountProperties
     * @param {string|null} [transactionIdOfPreviousVersion=null]
     * @return {Promise<{accountId: string, password, address: string, recordType: string, transactionIdOfPreviousVersion: string, passphrase: string, publicKey: string, version: number, status: string}>}
     */
     generateBinaryAccountRecordJson(binaryAccountProperties, transactionIdOfPreviousVersion = null) {
        logger.sensitive(`#### generateBinaryRecordJson()`);
        if (!( transactionIdOfPreviousVersion===null || gu.isWellFormedJupiterTransactionId(transactionIdOfPreviousVersion))) {
            throw new Error('invalid transactionIdOfPreviousVersion')
        }
        if (!(binaryAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('binaryAccountProperties is invalid')
        }
        // if (binaryAccountProperties.isMinimumProperties) {
        //     await refreshGravityAccountProperties(binaryAccountProperties);
        // }
        const _transactionIdOfPreviousVersion = (transactionIdOfPreviousVersion===null)?'':transactionIdOfPreviousVersion;
        return {
            recordType: 'binaryRecord',
            address: binaryAccountProperties.address,
            passphrase: binaryAccountProperties.passphrase,
            password: binaryAccountProperties.password,
            publicKey: binaryAccountProperties.publicKey,
            accountId: binaryAccountProperties.accountId,
            status: 'active',
            transactionIdOfPreviousVersion: _transactionIdOfPreviousVersion,
            version: 1
        }
    }
}

const {jupiterAPIService, JupiterAPIService} = require("../../../services/jupiterAPIService");
const {jupiterFundingService, JupiterFundingService} = require("../../../services/jupiterFundingService");
const {jupiterAccountService, JupiterAccountService} = require("../../../services/jupiterAccountService");
const {transactionTags} = require("../config/transactionTags");
const {refreshGravityAccountProperties, instantiateGravityAccountProperties} = require("../../../gravity/instantiateGravityAccountProperties");
const {MetisErrorBinaryAccountExistsError} = require("../../../errors/metisError");
const {FeeManager, feeManagerSingleton} = require("../../../services/FeeManager");
const {jupiterTransactionsService, JupiterTransactionsService} = require("../../../services/jupiterTransactionsService");
const {MetisError} = require("../../../errors/metisError");
const {jimConfig} = require("../config/jimConfig");
const {transactionUtils} = require("../../../gravity/transactionUtils");

module.exports.StorageService = StorageService;
module.exports.storageService = new StorageService(
    jupiterAPIService,
    jupiterTransactionsService,
    jupiterFundingService,
    jupiterAccountService,
    jimConfig,
    transactionUtils,
    chanService,
    localFileCacheService
)
