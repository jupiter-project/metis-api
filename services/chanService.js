const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');
const {metisGravityAccountProperties, GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {jupiterAccountService} = require("./jupiterAccountService");
const {gravityService} = require("./gravityService");
const {tableService} = require("./tableService");
const {FeeManager, feeManagerSingleton} = require("./FeeManager");
const mError = require("../errors/metisError");
const {jupiterAPIService} = require("./jupiterAPIService");
const {gravity} = require('../config/gravity');
const {jupiterFundingService} = require("./jupiterFundingService");
const {jupiterTransactionsService} = require("./jupiterTransactionsService");
const {channelConfig, tableConfig, userConfig} = require("../config/constants");
const metis = require("../config/metis");
const {instantiateGravityAccountProperties} = require("../gravity/instantiateGravityAccountProperties");
const {transactionUtils} = require("../gravity/transactionUtils");
const {BadGravityAccountPropertiesError, ChannelRecordValidatorError, InviteRecordValidatorError} = require("../errors/metisError");
const {validator} = require("../services/validator");
const {GravityCrypto} = require("./gravityCrypto");
// const {axiosDefault} = require("../config/axiosConf");

class ChanService {
    /**
     *
     * @param appAccountProperties
     * @param jupApi
     * @param jupiterTransactionsService
     * @param jupiterFundingService
     * @param jupiterAccountService
     * @param tableService
     * @param gravity
     * @param gravityService
     * @param transactionUtils
     * @param {Validator} validator
     */
    constructor(
        appAccountProperties,
        jupApi,
        jupiterTransactionsService,
        jupiterFundingService,
        jupiterAccountService,
        tableService,
        gravity,
        gravityService,
        transactionUtils,
        validator
    ) {
        if(!appAccountProperties){throw new Error('missing applicationGravityAccountProperties')}
        if(!jupApi){throw new Error('missing jupiterAPIService')}
        if(!jupiterTransactionsService){throw new Error('missing jupiterTransactionsService')}
        if(!jupiterFundingService){throw new Error('missing jupiterFundingService')}
        if(!jupiterAccountService){throw new Error('missing jupiterAccountService')}
        if(!tableService){throw new Error('missing tableService')}
        if(!gravity){throw new Error('missing gravity')}
        this.appAccountProperties = appAccountProperties;
        this.jupiterTransactionsService = jupiterTransactionsService;
        this.messageService = jupiterTransactionsService.messageService;
        this.jupiterAccountService = jupiterAccountService;
        this.tableService = tableService;
        this.gravity = gravity;
        this.gravityService = gravityService;
        this.transactionUtils = transactionUtils;
        this.validator = validator;
    }


    /**
     *
     * @param {GravityAccountProperties} memberAccountProperties
     * @param {string} channelAddress
     * @returns {Promise<{recordType, inviteeAddress, inviterAddress,createdAt, version,
     *                    channelRecord: {recordType, channelName, address, passphrase, password, publicKey, accountId, sender, createdBy, status, createdAt, updatedAt, version},
     *                    transactionId: string
     *              }>}
     */
    async getChannelInvite(memberAccountProperties, channelAddress) {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getChannelInvite(memberAccountProperties, channelAddress)`);
        logger.verbose(`## `);
        if(!gu.isWellFormedJupiterAddress(channelAddress)) throw new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)
        // if (!gu.isWellFormedJupiterAddress(channelAddress)) {
        //     throw new BadJupiterAddressError(channelAddress)
        //     // throw new Error('channelAddress not well formed')
        // }
        logger.sensitive(`channelAddress=${JSON.stringify(channelAddress)}`);
        if (!(memberAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('memberAccountProperties incorrect')
        }
        const tag = `${channelConfig.channelInviteRecord}.${channelAddress}`;
        const transactions = await jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(
            memberAccountProperties.address,
            tag
        )

        if (!gu.isNonEmptyArray(transactions)) {
            throw new Error('Invite doesnt exist')
        }
        const transaction = transactions[0];
        const transactionId = this.transactionUtils.extractTransactionId(transaction);

        const messageContainer = await this.messageService.getReadableMessageContainerFromMessageTransactionId(
            transactionId,
            memberAccountProperties.passphrase
        )

        if (messageContainer.message.recordType !== 'channelInvite') {
            throw new Error('invalid invitation')
        }

        return messageContainer.message;
    }


//     async hasSentInvitationToUserForChannel(fromMemberAccountProperties, forChannelAddress){
//         try{
//             // First: Get all Invitations from sender
//             const invitationContainers = await this.getChannelInvitationContainersSentToAccount(fromMemberAccountProperties);
//
// sdf
//
//         }catch(error){
//             logger.error(`****************************************************************`);
//             logger.error(`** hasSentInvitationForChannel().catch(error)`);
//             logger.error(`** - error= ${error}`)
//
//             throw error;
//         }
//     }

    /**
     *
     * @param {GravityAccountProperties} sentToMemberAccountProperties
     * @param {string} forChannelAddress
     * @returns {Promise<object>}
     */
    async hasRecievedInvitationForChannel(sentToMemberAccountProperties, forChannelAddress) {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## hasRecievedInvitationForChannel(sentToMemberAccountProperties, forChannelAddress)`);
        logger.verbose(`## `);
        if(!gu.isWellFormedJupiterAddress(forChannelAddress)) throw new mError.MetisErrorBadJupiterAddress(`forChannelAddress: ${forChannelAddress}`)
        // if (!gu.isWellFormedJupiterAddress(forChannelAddress)) {
        //     throw new BadJupiterAddressError(forChannelAddress)
        //     // throw new Error('forChannelAddress not well formed')
        // }
        if (!(sentToMemberAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('sentToMemberAccountProperties incorrect')
        }
        logger.sensitive(`forChannelAddress=${forChannelAddress}`);
        logger.sensitive(`sentToMemberAccountProperties.address=${sentToMemberAccountProperties.address}`);

        try {
            // First: Get all Invitations
            const invitationContainers = await this.getChannelInvitationContainersSentToAccount(sentToMemberAccountProperties);
            const invitationChannelAddresses = invitationContainers.map(messageContainer => messageContainer.message.channelRecord.address)
            if(invitationChannelAddresses.length === 0){return false}

            return invitationChannelAddresses.some(invitationAddress => invitationAddress === forChannelAddress);

            // const tag = `${channelConfig.channelInviteRecord}.${channelAddress}`;
            // const transactions = await jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(
            //     memberAccountProperties.address,
            //     tag
            // )
            //
            // if (!gu.isNonEmptyArray(transactions)) {
            //     return false;
            // }
            //
            // return true;
        } catch(error){
            logger.error(`****************************************************************`);
            logger.error(`** hasInvitation(memberAccountProperties, channelAddress).catch(error)`);
            logger.error(`** - error= ${error}`)

            throw error;
        }
    }


    // async getChannelInvitationContainersSentFromAccountToAddress(sentFromMemberAccountProperties, toAddress) {
    //     const recordTag = channelConfig.channelInviteRecord;
    //     const invitationContainers = await this.jupiterTransactionsService.getReadableTaggedMessageContainers(
    //         sentFromMemberAccountProperties,
    //         recordTag,
    //         false)
    //     // Second: Only get invitations sent to the member. Not invitations the member sent to others.
    //     const invitationContainersFilteredByFrom = invitationContainers.filter( invitationContainer => invitationContainer.message.inviterAddress === toAddress);
    // }

    /**
     *
     * @CASE what if the user is invited; the user declines; the user is invited again?
     * @param {GravityAccountProperties} sentToMemberAccountProperties
     * @returns {Promise<[{ message:{
     *                          recordType, inviteeAddress, inviterAddress,createdAt, version,
     *                          channelRecord: {recordType, channelName, address, passphrase, password, publicKey, accountId, sender, createdBy, status, createdAt, updatedAt, version},
     *                      transactionId: string
     *                   }
     *              }]>}
     */
    async getChannelInvitationContainersSentToAccount(sentToMemberAccountProperties) {
        logger.verbose(`#### getChannelInvitationContainersSentToAccount(sentToMemberAccountProperties)`);
        if(!(sentToMemberAccountProperties instanceof GravityAccountProperties)) {throw new Error('sentToMemberAccountProperties is not well formed')};
        try {
            // First: Get All Invitations. @TODO later we'll only get invitations for the past X days.
            const recordTag = channelConfig.channelInviteRecord;
            const invitationContainers = await this.jupiterTransactionsService.getReadableTaggedMessageContainers(
                sentToMemberAccountProperties,
                recordTag,
                false)
            // Second: Only get invitations sent to the member. Not invitations the member sent to others.
            const invitationContainersFilteredByTo = invitationContainers.filter( invitationContainer => invitationContainer.message.inviteeAddress === sentToMemberAccountProperties.address);
            // Third: Get All channels the user is a member of
            const memberChannels = await this.getMemberChannels(sentToMemberAccountProperties);
            // Fourth: Get the difference
            const invitationContainersNotInExistingChannels = invitationContainersFilteredByTo.filter(invitationContainer =>
                !memberChannels.some(channel=> channel.address === invitationContainer.message.channelRecord.address))
            // Fifth: Get the declined Invitations
            const declinedTagList = channelConfig.channelInvitationDeclinedList;
            const declinedTag = channelConfig.channelInvitationDeclinedRecord;
            const declinedInvitationContainers = await this.gravityService.getAllMessageContainersReferencedByList(sentToMemberAccountProperties, declinedTag, declinedTagList)
            // Sixth: Remove declined Invitations from invitation list
            const filteredInvitationContainers = invitationContainersNotInExistingChannels.filter( invitationContainer =>
                ! declinedInvitationContainers.some(declinedInvitationContainer => declinedInvitationContainer.transactionId === invitationContainer.transactionId)
            )
            // Seventh: De-dup
            const dedupedInvitationContainers = filteredInvitationContainers.reduce((reduced, invitationContainer) => {
                if( reduced.some( ic => ic.message.channelRecord.address ===  invitationContainer.message.channelRecord.address)){
                    return reduced;
                }
                reduced.push(invitationContainer);
                return reduced;
            },[]);


            // Eighth: Filter out bad channelRecords.
            const validInvitationContainers = dedupedInvitationContainers.filter( invitationContainer => {
                if(!( invitationContainer.hasOwnProperty('message'))) {
                    return false;
                }
                const inviteRecord = invitationContainer.message;
                const valid = validator.validateInviteRecord(inviteRecord);
                if (!valid.isValid) {
                    logger.error(`Problem with invitationContainer: ${valid.message}`);
                    console.log(`\n\n\n`);
                    console.log('REMOVEME=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
                    console.log(`invitationContainer:`);
                    console.log(invitationContainer)
                    console.log('valid.errors')
                    console.log(valid.errors)
                    console.log(`REMOVEME=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n\n\n`)
                    return false;
                }
                return true;
            })






            // // Eighth: Filter out bad channelRecords.
            // const validInvitationContainers = dedupedInvitationContainers.filter( invitationContainer => {
            //     if(!( invitationContainer.hasOwnProperty('message') &&
            //         invitationContainer.message.hasOwnProperty('channelRecord'))) {
            //         return false;
            //         // throw new mError.ChannelRecordValidatorError(`${JSON.stringify(invitationContainer.message.channelRecord)}`)
            //     }
            //     const valid = validator.validateChannelRecord(invitationContainer.message.channelRecord);
            //     console.log(`\n\n`);
            //     console.log('=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
            //     console.log(`valid:`);
            //     console.log(valid);
            //     console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n\n`)
            //
            //     if (!valid.isValid) {
            //         logger.error(`Problem with invitationContainer: ${valid.message}`);
            //         console.log(`\n\n\n`);
            //         console.log('REMOVEME=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
            //         console.log(`invitationContainer:`);
            //         console.log(invitationContainer)
            //         console.log('valid.errors')
            //         console.log(valid.errors)
            //         console.log(`REMOVEME=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n\n\n`)
            //         // throw new mError.ChannelRecordValidatorError(`${JSON.stringify(invitationContainer.message.channelRecord)}`)
            //         return false;
            //     }
            //     return true;
            // })


            // dedupedInvitationContainers.forEach( invitationContainer => {
            //     if(!( invitationContainer.hasOwnProperty('message') &&
            //         invitationContainer.message.hasOwnProperty('channelRecord'))) {
            //         throw new mError.ChannelRecordValidatorError(`${JSON.stringify(invitationContainer.message.channelRecord)}`)
            //     }
            //     const valid = validator.validateChannelRecord(invitationContainer.message.channelRecord);
            //
            //
            //     console.log(`\n\n`);
            //     console.log('=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
            //     console.log(`valid:`);
            //     console.log(valid);
            //     console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n\n`)
            //
            //     if (!valid.isValid) {
            //         logger.error(`Problem with invitationContainer: ${valid.message}`);
            //         console.log(`\n\n\n`);
            //         console.log('REMOVEME=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
            //         console.log(`invitationContainer:`);
            //         console.log(invitationContainer)
            //         console.log('valid.errors')
            //         console.log(valid.errors)
            //         console.log(`REMOVEME=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n\n\n`)
            //         throw new mError.ChannelRecordValidatorError(`${JSON.stringify(invitationContainer.message.channelRecord)}`)
            //     }
            // })

            return validInvitationContainers;
        } catch (error){
            logger.error(`****************************************************************`);
            logger.error(`** getChannelInvitationContainersSentToAccount(sentToMemberAccountProperties).catch(error)`);
            logger.error(`****************************************************************`);
            logger.error(`error= ${error}`)
            throw error;
        }
    }

    /**
     * @TODO what if the user is invited; the user declines; the user is invitate again by the same inviter to the same channel?
     * @param {GravityAccountProperties} channelAccountProperties
     * @param {GravityAccountProperties} inviterAccountProperties
     * @param {string} inviteeAddress
     * @param {string} inviteePublicKey
     * @return {Promise<{channelAddress: string, inviteeAddress, channelName: *, invitationId}>}
     */
    async createInvitation(channelAccountProperties, inviterAccountProperties, inviteeAddress, inviteePublicKey){
        logger.verbose(`#### createInvitation(channelAccountProperties, inviterAccountProperties, inviteeAddress)`);
        if(!(channelAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`channelAccountProperties`)
        if(!(inviterAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`inviterAccountProperties`)
        if( !(channelAccountProperties.hasOwnProperty('channelName') && gu.isNonEmptyString(channelAccountProperties.channelName))){
            throw new mError.MetisError(`ChannelAccountProperties needs to have channelName`);
        }
        if(!gu.isWellFormedJupiterAddress(inviteeAddress)) throw new mError.MetisErrorBadJupiterAddress(`inviteeAddress: ${inviteeAddress}`)
        if(!gu.isWellFormedPublicKey(inviteePublicKey)) throw new mError.MetisErrorBadJupiterPublicKey(`inviteePublicKey: ${inviteePublicKey}`)
        logger.sensitive(`channelAccountProperties.address= ${JSON.stringify(channelAccountProperties.address)}`);
        logger.sensitive(`inviterAccountProperties.address= ${JSON.stringify(inviterAccountProperties.address)}`);
        logger.sensitive(`inviteeAddress= ${JSON.stringify(inviteeAddress)}`);
        logger.sensitive(`inviteePublicKey= ${JSON.stringify(inviteePublicKey)}`);
        try {
            // First: We can send the same invitation several times. When creating the invite list we'll de-dup.
            // Second: Send the invitation transaction
            const channelName = channelAccountProperties.channelName;
            const inviteRecordJson = await this.generateInviteRecordJson(channelName, inviteeAddress, inviteePublicKey, inviterAccountProperties, channelAccountProperties);
            const feeType = FeeManager.feeTypes.invitation_to_channel;
            // const inviteeInfo = await jupiterAccountService.getAccountOrNull(inviteeAddress);
            // const inviteePublicKey = inviteeInfo.publicKey;
            const recordTag = `${channelConfig.channelInviteRecord}.${channelAccountProperties.address}`;
            const sendTaggedAndEncipheredMetisMessageResponse = await this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
                inviterAccountProperties.passphrase,
                inviteeAddress,
                JSON.stringify(inviteRecordJson), //Not encrypted on Purpose
                recordTag,
                feeType,
                inviteePublicKey
            )
            const createInvitationResponse = {
                invitationId: sendTaggedAndEncipheredMetisMessageResponse.transaction,
                channelAddress: channelAccountProperties.address,
                channelName: channelAccountProperties.channelName,
                inviteeAddress: inviteeAddress,
            }

            return createInvitationResponse;
        } catch (error) {
            logger.error(`****************************************************************`);
            logger.error(`** createInvitation(channelAccountProperties, inviterAccountProperties, inviteeAddress).catch(error)`);
            logger.error(`error= ${error}`)
            logger.error(`****************************************************************`);
            throw error;
        }
    }


    /**
     *  1. Check to make sure the user is not already a member of the channel
     *  2. Add Member Information to the Channel Account
     *  3. Add Channel Information to the user's account
     *  4. Update channel's memebers public keys.
     * @param {GravityAccountProperties} memberAccountProperties
     * @param {string} channelAddress
     * @returns {Promise<void>}
     */
    async acceptInvitation(memberAccountProperties, channelAddress){
        logger.verbose(`#### acceptInvitation(memberAccountProperties, channelAddress)`);
        if(!gu.isWellFormedJupiterAddress(channelAddress)) throw new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)
        // if (!gu.isWellFormedJupiterAddress(channelAddress)) {
        //     throw new BadJupiterAddressError(channelAddress)
        // }
        if (!(memberAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('memberAccountProperties incorrect')
        }
        logger.sensitive(`memberAccountProperties.address= ${JSON.stringify(memberAccountProperties.address)}`);
        logger.sensitive(`channelAddress= ${channelAddress}`);

        try {
            // First: lets get the list of invitations
            const invitationContainers = await this.getChannelInvitationContainersSentToAccount(memberAccountProperties);
            // Second: confirm the channel being invited to is in the invitation list
            const hasInvitation = invitationContainers.some(invitationContainer => invitationContainer.message.channelRecord.address === channelAddress )
            if(!hasInvitation){throw new Error('Invitation Not Found')}
            //Third: Add the records to both Channel and User Accounts
            const invitationContainer = invitationContainers.find(invitationContainer => invitationContainer.message.channelRecord.address === channelAddress)
            if(invitationContainer === undefined){throw new Error('Invitation Not Found..')}
            const invitationRecord = invitationContainer.message;
            const validateResult = this.validator.validateInviteRecord(invitationRecord);
            if(!validateResult){
                throw new InviteRecordValidatorError(validateResult.message);
            }
            // const ExistingChannelAccountProperties = await this.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(memberAccountProperties, channelAddress);
            // if (ExistingChannelAccountProperties) { // member already has access to channel.
            //     return;
            // }
            const channelAccountPropertiesInvitedTo = await instantiateGravityAccountProperties(
                invitationRecord.channelRecord.passphrase,
                invitationRecord.channelRecord.password
            )
            channelAccountPropertiesInvitedTo.channelName = invitationRecord.channelRecord.channelName;
            const processNewMemberResponse = await this.processNewMember(memberAccountProperties, channelAccountPropertiesInvitedTo);

        } catch (error) {
            logger.error(`***********************************************************************************`);
            logger.error(`** acceptInvitations(memberAccountProperties, channelAddress).catch(error)`);
            logger.error(`** `);
            logger.error(`   memberAccountProperties.address= ${memberAccountProperties.address}`)
            logger.error(`   channelAddress= ${channelAddress}`)
            logger.error(`   error= ${error}`)
            throw error;
        }
    }


    /**
     *  @description OBSOLETE!!!!
     * @param channelAddress
     * @param memberAccountProperties
     */
    // async getChannelAccountPropertiesBelongingToMember(channelAddress, memberAccountProperties ){
    //     logger.verbose(`###################################################################################`);
    //     logger.verbose(`## getChannelAccountPropertiesBelongingToMember(channelAddress, memberAccountProperties )`);
    //     logger.verbose(`## `);
    //     if(!gu.isWellFormedJupiterAddress(channelAddress)){throw new BadJupiterAddressError(channelAddress)}
    //     // if(!gu.isWellFormedJupiterAddress(channelAddress)){throw new Error('channelAddress is invalid')}
    //     logger.sensitive(`channelAddress= ${JSON.stringify(channelAddress)}`);
    //     if(!(memberAccountProperties instanceof GravityAccountProperties )){ throw new Error('memberAccountProperties is invalid')}
    //     const allMemberChannels = await this.getMemberChannels(memberAccountProperties);
    //     const channelAccountPropertiesArray = allMemberChannels.filter( channelAccountProperties => channelAccountProperties.address === channelAddress );
    //     if(channelAccountPropertiesArray.length > 0){
    //         return channelAccountPropertiesArray[0];
    //     }
    //
    //     throw new Error('doesnt exist!')
    // }

    /**
     *
     * @param {GravityAccountProperties} memberAccountProperties
     * @param {string} channelAddress
     * @returns {Promise<GravityAccountProperties|null>}
     */
    async getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(memberAccountProperties, channelAddress){
        logger.verbose(`#### getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress)`);
        if(!gu.isWellFormedJupiterAddress(channelAddress)) throw new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)
        // if (!gu.isWellFormedJupiterAddress(channelAddress)) throw new mError.BadJupiterAddressError(channelAddress)
        if(!(memberAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`memberAccountProperties`)
        logger.sensitive(`channelAddress= ${channelAddress}`);
        logger.sensitive(`memberAccountProperties.address= ${memberAccountProperties.address}`);
        try {
            const tag = `${channelConfig.channelRecord}.${channelAddress}`;
            const transactions = await jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(
                memberAccountProperties.address,
                tag
            )
            logger.info(`tag= ${tag}`);
            logger.info(`transactions.length= ${transactions.length}`);
            const transactionsBySelf = transactionUtils.filterEncryptedMessageTransactionsBySender(transactions, memberAccountProperties.address);
            logger.debug(`transactionsBySelf.length= ${transactionsBySelf.length}`);
            if (!gu.isNonEmptyArray(transactionsBySelf)) {
                return null;
            }
            const [transaction] = transactionsBySelf;
            const transactionId = transactionUtils.extractTransactionId(transaction);
            const channelAccountRecord = await this.fetchChannelAccountRecord(transactionId, memberAccountProperties.crypto, memberAccountProperties.passphrase);
            logger.sensitive(`channelRecord= ${JSON.stringify(channelAccountRecord)}`);
            const gravityAccountProperties = await instantiateGravityAccountProperties(
                channelAccountRecord.passphrase,
                channelAccountRecord.password
            )
            gravityAccountProperties.channelName = channelAccountRecord.channelName;

            return gravityAccountProperties;
        } catch(error){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress).catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            logger.error(`memberAccountProperties.address= ${memberAccountProperties.address}`)
            logger.error(`channelAddress= ${channelAddress}`)
            logger.error(`error= ${error}`)
            throw error;
        }
    }

    /**
     *
     * @param transactionId
     * @param {GravityCrypto} crypto
     * @param passphrase
     * @return {Promise<{recordType, channelName, address, passphrase, password, publicKey, accountId, sender, createdBy, status, createdAt, updatedAt, version}>}
     */
    async fetchChannelAccountRecord(transactionId, crypto, passphrase){
        if(!gu.isWellFormedJupiterTransactionId(transactionId)){throw new Error(`transactionId is invalid`)}
        if(!(crypto instanceof GravityCrypto)){throw new Error(`crypto is invalid`)}
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error(`passphrase is invalid`)}
        const messageContainer = await this.jupiterTransactionsService.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
            transactionId,
            crypto,
            passphrase
        );
        if(!messageContainer.hasOwnProperty('message')) {
            throw new Error(`invalid channelRecord transaction: ${messageContainer}`)
        }
        const valid = this.validator.validateChannelRecord(messageContainer.message);
        if(!valid.isValid){
            throw new ChannelRecordValidatorError(valid.message);
        }

        return messageContainer.message;
    }


    /**
     *
     * @param transactionIds
     * @param crypto
     * @param passphrase
     * @return {*}
     */
    fetchMultiChannelRecords(transactionIds, crypto, passphrase){
        if(!Array.isArray(transactionIds)){throw new Error(`transactionIds is invalid`)}
        if(!(crypto instanceof GravityCrypto)){throw new Error(`crypto is invalid`)}
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error(`passphrase is invalid`)}
        const promises = transactionIds.map(tId => this.fetchChannelAccountRecord(tId, crypto,passphrase));
        return Promise.all(promises)
    }


    /**
     *
     * @param channelRecord
     * @param version
     * @return {boolean}
     */
    // static isValidChannelRecord(channelRecord, version= 1){
    //     switch (version){
    //         case 1: return ChanService.isValidChannelRecordV1(channelRecord);break;
    //         default: return false;
    //     }
    // }

    // static isValidChannelRecordV1(channelRecord){
    //     const channelRecordProperties = [
    //         'channelName',
    //         'address',
    //         'passphrase',
    //         'password',
    //         'publicKey',
    //         'accountId',
    //         'sender',
    //         'createdBy',
    //         'status',
    //         'createdAt',
    //         'updatedAt'
    //     ]
    //
    //     if(!channelRecord){return false}
    //     if(!( channelRecord.hasOwnProperty('recordType') &&
    //         channelRecord.recordType === 'channelRecord' )  &&
    //         channelRecord.hasOwnProperty('version')  &&
    //         channelRecord.version === 1
    //     ){
    //         return false;
    //     }
    //
    //     return channelRecordProperties.every( item => channelRecord.hasOwnProperty(item));
    // }

    /**
     * Get a new JupAccount, Fund a new Channel, send Channel_Record transaction, Add member pubKeys to channel account.
     *
     * @param {string} channelName
     * @param {GravityAccountProperties} firstMemberProperties
     * @returns {GravityAccountProperties}
     */
    async createNewChannelAndAddFirstMember(channelName, firstMemberProperties){
        logger.verbose(`#### createNewChannelAndAddFirstMember(channelName: ${channelName},firstMemberProperties)`);
        if(!(firstMemberProperties instanceof GravityAccountProperties)){throw new BadGravityAccountPropertiesError(`firstMemeberProperties`)}
        if(!gu.isWellFormedPublicKey(firstMemberProperties.publicKey)) throw new mError.MetisErrorBadJupiterPublicKey(`firstMemberProperties.publicKey`)
        if(!gu.isNonEmptyString(channelName)){ throw new Error('channelName is empty');}
        const channelPassphrase = gu.generatePassphrase();
        const channelPassword = gu.generateRandomPassword();
        const channelAccountProperties = await instantiateGravityAccountProperties(channelPassphrase, channelPassword);
        channelAccountProperties.channelName = channelName;
        try {
            const fundingResponse = await jupiterFundingService.provideInitialChannelAccountFunds(channelAccountProperties);
            const transactionWaitResponse = await jupiterFundingService.waitForTransactionConfirmation(fundingResponse.data.transaction);  //need to wait for confirmation in order for account to send transactions.
            const processNewMemberResponse = await this.processNewMember(firstMemberProperties, channelAccountProperties, 'creator');
            return channelAccountProperties;
        } catch (error){
            logger.error(`**** createNewChannelAndAddFirstMember(channelName, firstMemberProperties).catch(error)`);
            logger.error(`channelName= ${channelName}`)
            logger.error(`firstMemberProperties.address= ${firstMemberProperties.address}`)
            logger.error(`error= ${error}`)
            throw error;
        }
    }


    /**
     *  Add member info to channel account; add channel info to member account
     * @param {GravityAccountProperties} memberAccountProperties
     * @param {GravityAccountProperties} channelAccountPropertiesInvitedTo
     * @param {string} role
     * @returns {Promise<void>}
     */
    async processNewMember(memberAccountProperties,channelAccountPropertiesInvitedTo, role = 'basic-member'){
        logger.verbose(`#### processNewMember(memberAccountProperties,channelAccountPropertiesInvitedTo,role)`);
        if(!(memberAccountProperties instanceof GravityAccountProperties)){throw new BadGravityAccountPropertiesError('memberAccountProperties')}
        if(!(channelAccountPropertiesInvitedTo instanceof GravityAccountProperties)){throw new BadGravityAccountPropertiesError('channelAccountPropertiesInvitedTo')}
        if(!gu.isWellFormedPublicKey(memberAccountProperties.publicKey)) throw new mError.MetisErrorBadJupiterPublicKey(`memberAccountProperties.publicKey`)
        if(!gu.isWellFormedPublicKey(channelAccountPropertiesInvitedTo.publicKey)) throw new mError.MetisErrorBadJupiterPublicKey(`channelAccountPropertiesInvitedTo.publicKey`)
        logger.sensitive(`memberAccountProperties.address= ${JSON.stringify(memberAccountProperties.address)}`);
        logger.sensitive(`channelAccountPropertiesInvitedTo.address= ${channelAccountPropertiesInvitedTo.address}`);
        const params = {
            channel:  channelAccountPropertiesInvitedTo.address,  //channel_record.account,
            password: channelAccountPropertiesInvitedTo.password,  //channel_record.password,
            account: memberAccountProperties.address,//decryptedAccountData.account,
            alias: memberAccountProperties.getCurrentAliasNameOrNull()
        };
        try {
            const response1 = await metis.addToMemberList(params); // adds the member to the channel jupiter key/value properties. @TODO this is obsolete. Remove it!
            const response2 = await this.addMemberInfoToChannelIfDoesntExist(memberAccountProperties, channelAccountPropertiesInvitedTo,role)
            const response3 = await this.addChannelInfoToAccountIfDoesntExist(memberAccountProperties, channelAccountPropertiesInvitedTo)
            await jupiterFundingService.waitForAllTransactionConfirmations(response2.transactionsReport);

            //@TODO we need to wait for response2. But the addMemberInfoToChannelIfDoesntExist doesnt return the transactions. Need to refactor!
            // if(response2 && response2.hasOwnProperty('data')){
            //     const response2WaitResponse = await jupiterFundingService.waitForTransactionConfirmation(response2.data.transaction);
            // } else {
            //     console.log(`looks like the channel is already registered to the member`);
            //     console.log(response2)
            // }
        } catch(error) {
            logger.error(`**** processNewMember(memberAccountProperties,channelAccountPropertiesInvitedTo).catch(error)`);
            logger.error(`memberAccountProperties.address= ${memberAccountProperties.address}`)
            logger.error(`channelAccountPropertiesInvitedTo.address= ${channelAccountPropertiesInvitedTo.address}`)
            logger.error(`error= ${error}`)
            throw error;
        }
    }

    //requestType=sendMessage&
    // secretPhrase=direction three cross battle dirty warm think trade flirt unless smart hang
    // recipient=JUP-H9FB-5F4R-NQ6P-FPMQL&
    // messageToEncrypt={
    //      "recipient":"erikamc",
    //      "sender":"JUP-LHFN-PTQZ-ZV3Z-B8JT2",
    //      "channel":{
    //              "id":"6031744193050790326",
    //              "channel_record":{
    //                  "id":"6031744193050790326",
    //                  "passphrase":"stress wound tiny strike ready taint warn spread hunt shame bloody belly",
    //                  "account":"JUP-D8NA-FG4S-HZSD-HAY6P",
    //                  "password":"pattern explode hello stone",
    //                  "name":"Team Box 🥊",
    //                  "publicKey":"5d9191853326a861ae99ce19956cf538eac93b32aab3c9f737c8536827383846",
    //                  "date":1625519868090,
    //                  "confirmed":false
    //              },
    //              "date":1625519868090,
    //              "name":"Team Box 🥊"
    //       },
    //       "dataType":"channelInvite"
    // }

    /**
     *
     * @param channelName
     * @param inviteeAddress
     * @param inviteePublicKey
     * @param {GravityAccountProperties} inviterAccountProperties
     * @param {GravityAccountProperties} channelAccountProperties
     * @return {Promise<{createdAt: number, channelRecord: Promise<{address: string, recordType: string, publicKey: string, version: number, accountId: string, createdAt: number, password, sender, createdBy, channelName, passphrase: string, status: string, updatedAt: number}>, createdBy: string, recordType: string, inviteeAddress, inviterAddress: string, inviteePublicKey, version: number, status: string, updatedAt: number}>}
     */
    async generateInviteRecordJson(channelName, inviteeAddress, inviteePublicKey, inviterAccountProperties, channelAccountProperties) {
        logger.verbose(`#### generateInviteRecordJson(channelName, inviteeAddress, inviteePublicKey, inviterAccountProperties, channelAccountProperties)`);
        if(!(channelAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`channelAccountProperties`)
        if(!(inviterAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`inviterAccountProperties`)
        if (!gu.isNonEmptyString(channelName)) throw new mError.MetisError('channelName is empty')
        if(!gu.isWellFormedJupiterAddress(inviteeAddress)) throw new mError.MetisErrorBadJupiterAddress(inviteeAddress)
        if(!gu.isWellFormedPublicKey(inviteePublicKey)) throw new mError.MetisErrorBadJupiterPublicKey(inviteePublicKey)
        const date = Date.now();
        const channelRecordJson =  await this.generateNewChannelRecordJson(
            channelName,
            channelAccountProperties,
            inviterAccountProperties.address
        );
        const inviteRecord = {
            recordType: 'channelInvite',
            inviteeAddress: inviteeAddress,
            inviteePublicKey: inviteePublicKey,
            inviterAddress: inviterAccountProperties.address,
            channelRecord: channelRecordJson,
            createdBy: inviterAccountProperties.address,
            status: 'active',
            createdAt: date,
            updatedAt: date,
            version: 1,
        }
        const valid = validator.validateInviteRecord(inviteRecord);
        if(!valid.isValid){
            console.log('\n')
            logger.error(`************************* ERROR ***************************************`);
            logger.error(`* ** generateInviteRecordJson(channelName, inviteeAddress, inviteePublicKey, inviterAccountProperties, channelAccountProperties).catch(error)`);
            logger.error(`************************* ERROR ***************************************\n`);
            throw new mError.InviteRecordValidatorError(`${valid.message} FOR ${JSON.stringify(inviteRecord)}`);
        }

        return inviteRecord;
    }


    /**
     *
     * @param {string} channelName
     * @param {GravityAccountProperties} channelAccountProperties
     * @param {string} createdByAddress
     * @return {Promise<{address: string, recordType: string, publicKey: string, version: number, accountId: string, createdAt: number, password, sender, createdBy, channelName, passphrase: string, status: string, updatedAt: number}>}
     */
    async generateNewChannelRecordJson(channelName, channelAccountProperties, createdByAddress) {
        logger.verbose(`#### generateNewChannelRecordJson(channelName, channelAccountProperties, createdByAddress)`);
        if (!gu.isNonEmptyString(channelName)) throw new mError.MetisError('channelName is empty')
        if(!gu.isWellFormedJupiterAddress(createdByAddress)) throw new mError.MetisErrorBadJupiterAddress(`createdByAddress: ${createdByAddress}`)
        // if (!gu.isWellFormedJupiterAddress(createdByAddress)) throw new mError.BadJupiterAddressError(createdByAddress)
        if (!(channelAccountProperties instanceof GravityAccountProperties)) throw new mError.MetisError('channelAccountProperties is invalid')
        if(!(gu.isWellFormedPublicKey(channelAccountProperties.publicKey))) throw new mError.MetisErrorBadJupiterPublicKey(channelAccountProperties.publicKey);
        const createdDate = Date.now();
        const channelRecord = {
            recordType: 'channelRecord',
            channelName: channelName,
            address: channelAccountProperties.address,
            passphrase: channelAccountProperties.passphrase,
            password: channelAccountProperties.password,
            publicKey: channelAccountProperties.publicKey,
            accountId: channelAccountProperties.accountId,
            sender: createdByAddress,
            createdBy: createdByAddress,
            status: 'active',
            createdAt: createdDate,
            updatedAt: createdDate,
            version: 1
        }

        return channelRecord;
    }

    // generateUpdatedChannelRecordJson(channelName, channelAccountProperties, previousChannelRecordTransaction ){
    //     if(!gu.isNonEmptyString(channelName)){throw new Error('channelName is empty')}
    //     if(!gu.isWellFormedJupiterAddress(createdByAddress)){throw new Error('createdByAddress is invalid')}
    //     if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('channelAccountProperties is invalid')}
    //
    //
    //     const newChannelRecord = {... previousChannelRecordTransaction.data};
    //     newChannelRecord.channelName = channelName;
    //     newChannelRecord.status = status;
    //     newChannelRecord.updatedAt = Date.now();
    //     newChannelRecord.version = 1;
    //     newChannelRecord.previousChannelRecordTransactionId = previousChannelRecordTransaction.transaction
    //
    //     return newChannelRecord;
    // }


    // recordType: 'channelInvite',
    // inviteeAddress: inviteeAddress,
    // inviterAddress: inviterAccountProperties.address,
    // channelRecord: channelRecordJson,
    // createdAt: date,
    // version: 1,

    /**
     *
     * @param channelAccountProperties
     * @param memberAddress
     * @return {Promise<boolean>}
     */
    async channelHasMemberInfo(channelAccountProperties, memberAddress) {
        logger.verbose(`#### channelHasMemberInfo(channelAccountProperties, memberAddress=${memberAddress})`);
        const listTag = channelConfig.channelMemberList;
        const recordTag = `${channelConfig.channelMember}.${memberAddress}`;
        return this.accountHasReferenceAccountInfo(channelAccountProperties, memberAddress, listTag, recordTag)
    }


    /**
     *
     * @param accountProperties
     * @param referenceAddress
     * @param listTag
     * @param recordTag
     * @return {Promise<boolean>}
     */
    async accountHasReferenceAccountInfo(accountProperties,  referenceAddress, listTag, recordTag){
        logger.verbose(`#### accountHasReferenceAccountInfo(accountProperties,  referenceAddress, listTag, recordTag)`);
        if(!(accountProperties instanceof GravityAccountProperties)){throw new Error('accountProperties is invalid')}
        if(!gu.isWellFormedJupiterAddress(referenceAddress)) throw new mError.MetisErrorBadJupiterAddress(`referenceAddress: ${referenceAddress}`)
        // if(!gu.isWellFormedJupiterAddress(referenceAddress)){throw new BadJupiterAddressError(referenceAddress)}
        // if(!gu.isWellFormedJupiterAddress(referenceAddress)){throw new Error('referenceAddress is invalid')}
        if(!listTag){throw new Error('listtag is invalid')}
        if(!recordTag){throw new Error('recordTag is invalid')}

        logger.sensitive(`accountProperties.address= ${accountProperties.address}`);
        logger.sensitive(`referenceAddress= ${referenceAddress}`);
        logger.sensitive(`listTag= ${listTag}`);
        logger.sensitive(`listTag= ${listTag}`);

        const containers = await this.jupiterTransactionsService.getReadableTaggedMessageContainers(accountProperties, listTag);
        const firstContainer = gu.arrayShiftOrNull(containers);
        if(!firstContainer) {
            return false
        }
        const transactions = await this.jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(referenceAddress, recordTag);
        const firstTransaction = gu.arrayShiftOrNull(transactions);
        if(!firstTransaction){
            return false
        }


        // There can be a record but if its not in the list then its not considered a Has;
        if(firstContainer.message.includes(firstTransaction.transaction)){ return true }

        return false;
    }

    /**
     *
     * @param accountProperties
     * @param address
     * @returns {Promise<boolean>}
     */
    async accountHasChannelInfo(accountProperties, address){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## accountHasChannelInfo(accountProperties, address)`);
        logger.verbose(`## `);
        logger.sensitive(`accountProperties.address= ${JSON.stringify(accountProperties.address)}`);
        logger.sensitive(`address= ${JSON.stringify(address)}`);
        const recordTag = `${channelConfig.channelRecord}.${address}`;
        logger.sensitive(`recordTag= ${recordTag}`);
        const transactions = await this.jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(accountProperties.address, recordTag);
        if(transactions.length === 0){
            return false
        }

        return true;
    }

    /**
     *
     * @param accountProperties
     * @param channelAccountProperties
     * @return {Promise<{}|{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async addChannelInfoToAccountIfDoesntExist(accountProperties, channelAccountProperties) {
        console.log(`\n\n`)
        logger.verbose(`###################################################################################`);
        logger.verbose(`## addChannelInfoToAccountIfDoesntExist(accountProperties, channelAccountProperties)`);
        logger.verbose(`###################################################################################`);
        if(!(accountProperties instanceof GravityAccountProperties)){throw new Error('invalid accountProperties')}
        if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('invalid channelAccountProperties')}
        const accountHasChannelInfo =  await this.accountHasChannelInfo(channelAccountProperties, accountProperties.address);
        if(accountHasChannelInfo) {
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            logger.info(`++ account already has channel info`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            return {};
        }
        logger.info('  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        logger.info(`  ++ channelAccountProperties.channelName`);
        logger.verbose(channelAccountProperties.channelName);
        logger.info('  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        const channelRecordPayload = await this.generateNewChannelRecordJson(
            channelAccountProperties.channelName,
            channelAccountProperties,
            accountProperties.address
        );

        const encryptedChannelRecordPayload = accountProperties.crypto.encryptJson(channelRecordPayload);
        const feeType =   FeeManager.feeTypes.account_record;
        const recordTag = `${channelConfig.channelRecord}.${channelAccountProperties.address}`;

        // if(accountProperties.isMinimumProperties){
        //     await refreshGravityAccountProperties(accountProperties);
        // }
        return this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
            accountProperties.passphrase,
            accountProperties.address,
            encryptedChannelRecordPayload,
            recordTag,
            feeType,
            accountProperties.publicKey
        )
    }

    /**
     *
     * @returns {*}
     * @param {GravityAccountProperties} memberProperties
     * @param {GravityAccountProperties} channelProperties
     */
    async addMemberInfoToChannelIfDoesntExist(memberProperties, channelProperties, role = 'basic-member') {
        logger.verbose(`#### addMemberToChannelIfDoesntExist(memberProperties, channelProperties)`);
        if (!(memberProperties instanceof GravityAccountProperties)) {
            throw new BadGravityAccountPropertiesError('memberProperties')
        }
        if (!(channelProperties instanceof GravityAccountProperties)) {
            throw new BadGravityAccountPropertiesError('channelProperties')
        }
        try {
            // FIRST: Make sure user is not already a member.
            const isChannelMember = await this.channelHasMemberInfo(channelProperties, memberProperties.address);
            if (isChannelMember) {
                console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
                console.log('Already A Member');
                console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
                return {};
            }
            // SECOND: Add member information transaction and update the member list transaction
            const memberPublicKeys = await jupiterAccountService.getPublicKeysFromUserAccount(memberProperties);
            const newMemberPayload = {
                version: 1,
                address: memberProperties.address,
                publicKeys: memberPublicKeys,
                alias: memberProperties.getCurrentAliasNameOrNull(),
                dateJoined: Date.now(),
                firstName: memberProperties.firstName,
                lastName: memberProperties.lastName,
                role: role,
                profileUrl: null
            }
            const recordTag = `${channelConfig.channelMember}.${memberProperties.address}`;
            const listTag = channelConfig.channelMemberList;
            const transactionResponse = await this.gravityService.addNewRecordToReferencedDataSet(
                newMemberPayload,
                channelProperties,
                listTag,
                recordTag )

            const transactionIdForTheLatestTransactionsList = transactionUtils.extractTransactionIdFromTransactionResponse(transactionResponse);
            const transactionsReport = []
            transactionsReport.push({name: 'channel-member-list', id: transactionIdForTheLatestTransactionsList});
            // THIRD: Add the public keys to the channel
            memberPublicKeys.map(async (memberKey) => {
                await this.addE2EPublicKeyToChannel(memberKey, memberProperties.address, channelProperties);
            });

            return {transactionsReport:transactionsReport}
        } catch(error){
            logger.error(`**** addMemberInfoToChannelIfDoesntExist(memberProperties, channelProperties).catch(error)`);
            logger.error(`memberProperties.address= ${memberProperties.address}`)
            logger.error(`channelProperties.address= ${channelProperties.address}`)
            logger.error(`error= ${error}`)
            throw error;
        }
    }

    /**
     * @TODO should use a list of channels
     * @TODO what if the user removes his/her channel membership?
     * @Todo what if a user is banned from a channel?
     *
     * Returns  a list of GravityAccountProperties.
     *
     * @param {GravityAccountProperties} memberProperties
     * @returns {Promise<*[]|{address,passphrase,password}>}
     */
    async getMemberChannels(memberProperties) {
        logger.verbose(`#### getMemberChannels(memberProperties)`);
        if(!(memberProperties instanceof GravityAccountProperties)){throw new BadGravityAccountPropertiesError('memberProperties')};
        try {
            const transactions = await this.jupiterTransactionsService.fetchConfirmedAndUnconfirmedBlockChainTransactionsByTag(memberProperties.address, channelConfig.channelRecord);
            const transactions2 = this.transactionUtils.filterEncryptedMessageTransactionsBySender(transactions, memberProperties.address); //used to be by TableChannel. we are removing the table channel.
            const transactionIds = this.transactionUtils.extractTransactionIds(transactions2);
            const multiChannelRecords = await this.fetchMultiChannelRecords(transactionIds,memberProperties.crypto, memberProperties.passphrase);
            const listOfChannelsAndTheirProperties = multiChannelRecords.map( async channelRecord => {
                const properties = await instantiateGravityAccountProperties(channelRecord.passphrase, channelRecord.password);
                properties.channelName = channelRecord.channelName; //@TODO make this more robust.
                properties.createdBy = channelRecord.createdBy; //@TODO make this more robust.
                properties.createdAt = channelRecord.createdAt; //@TODO make this more robust.
                return properties;
            })
            return await Promise.all(listOfChannelsAndTheirProperties);
        } catch (error) {
            logger.error(`**** getAllMemberChannels(memberProperties).catch(error)`);
            console.log(error);
            throw error;
        }
    }

    /**
     *
     * @param memberProperties
     * @param e2ePublicKey
     * @return {Promise<void>}
     */
    async updateAllMemberChannelsWithNewE2EPublicKey(e2ePublicKey, memberProperties) {
        if(!gu.isWellFormedE2EPublicKey(e2ePublicKey)) throw new mError.MetisErrorBadJupiterPublicKey(`: ${e2ePublicKey}`)
        try {
            const memberChannels = await this.getMemberChannels(memberProperties);
            memberChannels.map(async ({passphrase, password}) => {
                const properties = await instantiateGravityAccountProperties(passphrase, password);
                await this.addE2EPublicKeyToChannel(e2ePublicKey, memberProperties.address, properties);
            });

        } catch (error) {
            logger.error(`ERROR: [updateAllMemberChannelsWithNewE2EPublicKey]: ${JSON.stringify(error)}`);
            throw error;
        }
    }



    /**
     *
     * @param channelAccountProperties
     * @returns {Promise<[*]>}
     */
    getChannelMembers(channelAccountProperties){
        logger.verbose(`#### getChannelMembers(channelAccountProperties) )`);
        if(!(channelAccountProperties instanceof GravityAccountProperties )){ throw new Error('channelAccountProperties is invalid')}
        logger.debug(`channelAccountProperties.address= ${channelAccountProperties.address}`);
        const listTag = channelConfig.channelMemberPublicKeyList;
        return jupiterTransactionsService.dereferenceListAndGetReadableTaggedMessageContainers(channelAccountProperties, listTag)
            .then( messageContainers  => {
                // console.log(`\n\n\n`);
                // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
                // console.log('messageContainers');
                // console.log(messageContainers);
                // console.log(`=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n\n\n`)
                return messageContainers.map(messageContainer => messageContainer.message);
            })
    }

    /**
     *
     * @param userPublicKey
     * @param userAddress
     * @param channelAccountProperties
     * @return {Promise<null|void>}
     */
    // async addPublicKeyToChannelOrNull(userPublicKey, userAddress, channelAccountProperties){
    //     try {
    //         return this.addE2EPublicKeyToChannel(userPublicKey, userAddress, channelAccountProperties);
    //     } catch (error){
    //         logger.error(`ERROR: [addPublicKeyToChannelOrNull]: ${JSON.stringify(error)}`);
    //         return null;
    //     }
    // }

    // hasPublicKeyInChannelAccount(publicKey, gravityAccountProperties) {
    //     return this.jupiterAccountService.publicKeyMessages(publicKey, gravityAccountProperties, channelConfig.channelMemberPublicKeyList)
    // }

    /**
     *
     * @param {string} userE2EPublicKey
     * @param {string} userAddress
     * @param {GravityAccountProperties} channelAccountProperties
     */
    addE2EPublicKeyToChannel(userE2EPublicKey, userAddress, channelAccountProperties) {
        logger.verbose(`#### addE2EPublicKeyToChannel(userPublicKey, userAddress, channelAccountProperties)`);
        return this.jupiterAccountService.addE2EPublicKeyToJupiterAccount(userE2EPublicKey,channelAccountProperties,userAddress,'ChannelAccount');
        // try {
        //
        //     //------------------------------
        //     const listTag =  channelConfig.channelMemberPublicKeyList
        //     //------------------------------
        //
        //
        //
        //     const latestE2EPublicKeysContainers = await this.jupiterTransactionsService.messageService.dereferenceListAndGetReadableTaggedMessageContainers(
        //         channelAccountProperties,
        //         listTag
        //     )
        //     const latestE2EPublicKeys = latestE2EPublicKeysContainers.map(containers => containers.message);
        //     const latestE2ETransactionIds = latestE2EPublicKeysContainers.map(containers => containers.transactionId);
        //     if(latestE2EPublicKeys.some(pk => pk === userPublicKey)){
        //         throw new mError.MetisErrorPublicKeyExists('', userPublicKey);
        //     }
        //
        //
        //
        //
        //     //------------------------------
        //     const newUserChannel = {
        //         userAddress,
        //         userPublicKey,
        //         date: Date.now()
        //     };
        //     const checksumPublicKey = gu.generateChecksum(userPublicKey);
        //     const channelUserTag = `${channelConfig.channelMemberPublicKey}.${userAddress}.${checksumPublicKey}`;
        //     //------------------------------
        //
        //
        //
        //     logger.debug(`newUserChannel= ${JSON.stringify(newUserChannel)}`);
        //     // Send A New E2E Public Key Transaction
        //     const encryptedMessage = channelAccountProperties.crypto.encryptJson(newUserChannel);
        //     const newUserTransactionResponse = await this.messageService.sendTaggedAndEncipheredMetisMessage(
        //         channelAccountProperties.passphrase,
        //         channelAccountProperties.address,
        //         encryptedMessage, // encipher message  [{ userAddress: userData.account, userPublicKey, date: Date.now() }];,
        //         channelUserTag,
        //         FeeManager.feeTypes.account_record,
        //         channelAccountProperties.publicKey
        //     )
        //
        //     // Update the Public keys List
        //     latestE2ETransactionIds.push(newUserTransactionResponse.transaction);
        //     const encryptedLatestE2ETransactionIds = channelAccountProperties.crypto.encryptJson(latestE2ETransactionIds);
        //     await this.messageService.sendTaggedAndEncipheredMetisMessage(
        //         channelAccountProperties.passphrase,
        //         channelAccountProperties.address,
        //         encryptedLatestE2ETransactionIds, // encipher message  [{ userAddress: userData.account, userPublicKey, date: Date.now() }];,
        //         listTag,
        //         FeeManager.feeTypes.account_record,
        //         channelAccountProperties.publicKey
        //     )
        //
        // } catch (error) {
        //     logger.error(`**** addE2EPublicKeyToChannel(userPublicKey, userAddress, channelAccountProperties).catch(error)`);
        //     if(error instanceof MetisErrorPublicKeyExists){
        //         logger.warn(`The PublicKey is already associated with the channel: channel=${channelAccountProperties.address}, user public key: ${userPublicKey}`);
        //         return;
        //     }
        //     logger.error(`error= ${error}`);
        //     throw error;
        // }
    }
}

module.exports.chanService = new ChanService(
    metisGravityAccountProperties,
    jupiterAPIService,
    jupiterTransactionsService,
    jupiterFundingService,
    jupiterAccountService,
    tableService,
    gravity,
    gravityService,
    transactionUtils,
    validator
)
