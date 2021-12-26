const logger = require('../../../utils/logger')(module);
const gu = require('../../../utils/gravityUtils');
const {GravityAccountProperties} = require("../../../gravity/gravityAccountProperties");

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
        transactionUtils
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
            const binaryAccountProperties = await this.getBinaryAccountPropertiesOrNull(ownerAccountProperties);
            if (binaryAccountProperties) {
                logger.warn('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                logger.warn(`++ this account already has an associated binary account`);
                logger.warn('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
                throw new BinaryAccountExistsError();
            }
            // Second: Generate a new Jupiter account
            const newPassphrase = gu.generatePassphrase();
            const newPassword = gu.generateRandomPassword();
            const newBinaryAccountProperties = await instantiateGravityAccountProperties(newPassphrase, newPassword);
            // Third: Provide initial funding.
            const provideInitialFundingResponse = await this.provideInitialFunding(ownerAccountProperties,newBinaryAccountProperties);
            const transactionIdForFunding = provideInitialFundingResponse.data.transaction;
            await this.jupiterFundingService.waitForTransactionConfirmation(transactionIdForFunding);
            //Fourth: Associate the new jupiter account with the owner account.
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
     * @param ownerAccountProperties
     * @return {Promise<boolean>}
     */
    async binaryAccountExists(ownerAccountProperties){
        logger.sensitive(`#### binaryAccountExists()`);
        if(!(ownerAccountProperties instanceof GravityAccountProperties)){throw new Error(`ownerAccountProperties is invalid`)}
        const binaryRecord = await this.fetchBinaryRecordAssociatedToUserAccountPropertiesOrNull(ownerAccountProperties);
        if(binaryRecord === null){
            return false;
        }
        return true;
    }

    /**
     *
     * @param userAccountProperties
     * @return {Promise<null|*>}
     */
    async fetchBinaryRecordAssociatedToUserAccountPropertiesOrNull(userAccountProperties){
        logger.sensitive(`#### fetchBinaryRecordAssociatedToUserAccountPropertiesOrNull(userAccountProperties)`);
        if(!(userAccountProperties instanceof GravityAccountProperties)){throw new Error(`userAccountProperties is invalid`)}
        const tag = transactionTags.jimServerTags.binaryRecord;
        const binaryRecordContainers = await this.jupiterTransactionsService.getReadableTaggedMessageContainers(
            userAccountProperties,
            tag,
            true,
            null,
            null,
            tns => tns.senderRS === userAccountProperties.address

        );
        const firstBinaryAccountContainer = gu.arrayShiftOrNull(binaryRecordContainers);
        if(!firstBinaryAccountContainer) {
            return null
        }

        return firstBinaryAccountContainer.message;
    }

    /**
     *
     * @param ownerAccountProperties
     * @return {Promise<GravityAccountProperties>}
     */
    async getBinaryAccountPropertiesOrNull(ownerAccountProperties){
        logger.sensitive(`#### getBinaryAccountPropertiesOrNull(ownerAccountProperties)`);
        const binaryRecord = await this.fetchBinaryRecordAssociatedToUserAccountPropertiesOrNull(ownerAccountProperties);
        if(binaryRecord === null){
            return null;
        }

        return instantiateGravityAccountProperties(binaryRecord.passphrase, binaryRecord.password);
    }

    /**
     *
     * @param {GravityAccountProperties} ownerAccountProperties
     * @param {GravityAccountProperties} binaryAccountProperties
     * @return {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async addBinaryRecordToAccount(ownerAccountProperties, binaryAccountProperties) {
        logger.verbose(`#### addBinaryRecordToAccountIfDoesntExist(ownerAccountProperties, binaryAccountProperties)`);
        if(!(ownerAccountProperties instanceof GravityAccountProperties)){throw new Error('invalid ownerAccountProperties')}
        if(!(binaryAccountProperties instanceof GravityAccountProperties)){throw new Error('invalid binaryAccountProperties')}
        try {
            const binaryAccountExistsPromise = await this.binaryAccountExists(ownerAccountProperties);
            const binaryRecordPayloadPromise = await this.generateBinaryRecordJson(binaryAccountProperties);
            const [binaryAccountExists, binaryRecordPayload] = await Promise.all([binaryAccountExistsPromise, binaryRecordPayloadPromise]);
            if (binaryAccountExists) {
                throw new Error('binary account already exists!');
            }
            const encryptedChannelRecordPayload = ownerAccountProperties.crypto.encryptJson(binaryRecordPayload);
            const feeType = FeeManager.feeTypes.metisMessage;
            const recordTag = `${transactionTags.jimServerTags.binaryRecord}.${binaryAccountProperties.address}`;
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

    createFile(fileName, dataBuffer, ownerAccountProperties ) {
    }

    /**
     *
     * @param {GravityAccountProperties} binaryAccountProperties
     * @param {string|null} [transactionIdOfPreviousVersion=null]
     * @return {Promise<{accountId: string, password, address: string, recordType: string, transactionIdOfPreviousVersion: string, passphrase: string, publicKey: string, version: number, status: string}>}
     */
    async generateBinaryRecordJson(binaryAccountProperties, transactionIdOfPreviousVersion = null) {
        if (!( transactionIdOfPreviousVersion===null || gu.isWellFormedJupiterTransactionId(transactionIdOfPreviousVersion))) {
            throw new Error('invalid transactionIdOfPreviousVersion')
        }
        if (!(binaryAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('binaryAccountProperties is invalid')
        }
        if (binaryAccountProperties.isMinimumProperties) {
            await refreshGravityAccountProperties(binaryAccountProperties);
        }

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
// const JupiterAPIService = require("../../../services/jupiterAPIService");
const {jupiterFundingService, JupiterFundingService} = require("../../../services/jupiterFundingService");
// const {jupiterTransactionsService} = require("../../../services/jupiterTransactionsService");
const {jupiterAccountService, JupiterAccountService} = require("../../../services/jupiterAccountService");
const {transactionTags} = require("../config/transactionTags");
const {instantiateMinimumGravityAccountProperties, refreshGravityAccountProperties, instantiateGravityAccountProperties} = require("../../../gravity/instantiateGravityAccountProperties");
const {BadJupiterAddressError, BinaryAccountExistsError} = require("../../../errors/metisError");
const {FeeManager, feeManagerSingleton} = require("../../../services/FeeManager");
// const {} = require("../../../services/FeeManager");
const {jupiterTransactionsService, JupiterTransactionsService} = require("../../../services/jupiterTransactionsService");
const {generate_passphrase} = require("../../../config/_methods");
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
    transactionUtils
)
