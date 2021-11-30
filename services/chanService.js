const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');
const {metisGravityAccountProperties, GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {jupiterAccountService} = require("./jupiterAccountService");
const {gravityService} = require("./gravityService");
const {tableService} = require("./tableService");
const {FeeManager} = require("./FeeManager");

class ChanService {
    /**
     *
     * @param appAccountProperties
     * @param jupApi
     * @param {JupiterTransactionsService} jupiterTransactionsService
     * @param jupiterFundingService
     * @param jupiterAccountService
     * @param tableService
     * @param gravity
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
        transactionUtils) {
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
        this.gravityService = gravityService
        this.transactionUtils = transactionUtils
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
        if (!gu.isWellFormedJupiterAddress(channelAddress)) {
            throw new Error('channelAddress not well formed')
        }
        logger.sensitive(`channelAddress=${JSON.stringify(channelAddress)}`);
        if (!(memberAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('memberAccountProperties incorrect')
        }
        const tag = `${channelConfig.channelInviteRecord}.${channelAddress}`;
        const transactions = await jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(
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
        if (!gu.isWellFormedJupiterAddress(forChannelAddress)) {
            throw new Error('forChannelAddress not well formed')
        }
        if (!(sentToMemberAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('sentToMemberAccountProperties incorrect')
        }
        logger.sensitive(`forChannelAddress=${forChannelAddress}`);
        logger.sensitive(`sentToMemberAccountProperties.address=${sentToMemberAccountProperties.address}`);

        try {
            // First: Get all Invitations
            const invitationContainers = await this.getChannelInvitationContainersSentToAccount(sentToMemberAccountProperties);
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('invitationContainers');
            console.log(invitationContainers);
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            const invitationChannelAddresses = invitationContainers.map(messageContainer => messageContainer.message.channelRecord.address)
            if(invitationChannelAddresses.length === 0){return false}

            return invitationChannelAddresses.some(invitationAddress => invitationAddress === forChannelAddress);

            // const tag = `${channelConfig.channelInviteRecord}.${channelAddress}`;
            // const transactions = await jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(
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
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getChannelInvitationContainersSentToAccount(sentToMemberAccountProperties)`);
        logger.verbose(`## `);
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
            const memberChannels = await this.jupiterAccountService.getMemberChannels(sentToMemberAccountProperties);

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

            return dedupedInvitationContainers;
        } catch (error){
            logger.error(`****************************************************************`);
            logger.error(`** getChannelInvitationContainersSentToAccount(sentToMemberAccountProperties).catch(error)`);
            logger.error(`** - error= ${error}`)

            throw error;
        }
    }

    /**
     * @TODO what if the user is invited; the user declines; the user is invitate again by the same inviter to the same channel?
     * @param channelAccountProperties
     * @param inviterAccountProperties
     * @param inviteeAddress
     * @returns {Promise<void>}
     */
    async createInvitation(channelAccountProperties, inviterAccountProperties, inviteeAddress){
        logger.verbose(`    ########################################################################`);
        logger.verbose(`    ## createInvitation(channelAccountProperties, inviterAccountProperties, inviteeAddress)`);
        if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('channelAccountProperties is invalid')};
        if(!(inviterAccountProperties instanceof GravityAccountProperties)){throw new Error('inviterAccountProperties is invalid')};
        if(!gu.isWellFormedJupiterAddress(inviteeAddress)){throw new Error('inviteeAddress is invalid')};
        logger.sensitive(`  ## - channelAccountProperties.address= ${JSON.stringify(channelAccountProperties.address)}`);
        logger.sensitive(`  ## - inviterAccountProperties.address= ${JSON.stringify(inviterAccountProperties.address)}`);
        logger.sensitive(`  ## - inviteeAddress= ${JSON.stringify(inviteeAddress)}`);

        try {

            // First: We can send the same invitation several times. When creating the invite list we'll de-dup.

            // Second: Send the invitation transaction
            const channelName = channelAccountProperties.channelName;
            const inviteRecordJson = this.generateInviteRecordJson(channelName, inviteeAddress, inviterAccountProperties, channelAccountProperties);
            const feeType = FeeManager.feeTypes.invitation_to_channel;
            const inviteeInfo = await jupiterAccountService.getAccountOrNull(inviteeAddress);
            const inviteePublicKey = inviteeInfo.publicKey;
            const recordTag = `${channelConfig.channelInviteRecord}.${channelAccountProperties.address}`;
            const sendTaggedAndEncipheredMetisMessageResponse = await this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
                inviterAccountProperties.passphrase,
                inviteeAddress,
                JSON.stringify(inviteRecordJson), //Not encrypted
                recordTag,
                feeType,
                inviteePublicKey
            )

            const createInvitationResponse = {
                invitationId: sendTaggedAndEncipheredMetisMessageResponse.data.transaction,
                channelAddress: channelAccountProperties.address,
                channelName: channelAccountProperties.channelName,
                inviteeAddress: inviteeAddress,
            }

            return createInvitationResponse;
        } catch (error) {
            logger.error(`****************************************************************`);
            logger.error(`** createInvitation(channelAccountProperties, inviterAccountProperties, inviteeAddress).catch(error)`);
            logger.error(`** - error= ${error}`)

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
        logger.verbose(`    ########################################################################`);
        logger.verbose(`    ## acceptInvitation(memberAccountProperties, channelAddress)`);
        if (!gu.isWellFormedJupiterAddress(channelAddress)) {
            throw new Error('channelAddress is invalid')
        }
        if (!(memberAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('memberAccountProperties incorrect')
        }
        logger.sensitive(`  ## - memberAccountProperties.address= ${JSON.stringify(memberAccountProperties.address)}`);
        logger.sensitive(`  ## - channelAddress= ${channelAddress}`);

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
            // const ExistingChannelAccountProperties = await this.getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress);
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


    // async getReadableTaggedMessagesOrNull(gravityAccountProperties, tag, isMetisEncrypted = true){

    /**
     *
     * @param getChannelAccountPropertiesOrNull
     * @param channelAddress
     * @returns {Promise<string>}
     */
    async getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress){
        logger.verbose(`  ###################################################################################`);
        logger.verbose(`  ## getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress)`);

        try {
            if (!gu.isWellFormedJupiterAddress(channelAddress)) {
                throw new Error('channelAddress is invalid')
            }
            if (!(memberAccountProperties instanceof GravityAccountProperties)) {
                throw new Error('memberAccountProperties incorrect')
            }
            logger.sensitive(`## - channelAddress=${channelAddress}`);
            logger.sensitive(`## - memberAccountProperties.address=${memberAccountProperties.address}`);

            const tag = `${channelConfig.channelRecord}.${channelAddress}`;
            const transactions = await jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(
                memberAccountProperties.address,
                tag
            )
            const transactionsBySelf = transactionUtils.filterEncryptedMessageTransactionsBySender(transactions, memberAccountProperties.address);
            if (!gu.isNonEmptyArray(transactionsBySelf)) {
                return null;
            }
            const [transaction] = transactionsBySelf;
            const transactionId = transactionUtils.extractTransactionId(transaction);
            const messageContainer = await this.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
            // const messageContainer = await this.jupiterTransactionsService.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
                transactionId,
                memberAccountProperties.crypto,
                memberAccountProperties.passphrase
            );

            const gravityAccountProperties = await instantiateGravityAccountProperties(
                messageContainer.message.passphrase,
                messageContainer.message.password
            )

            return gravityAccountProperties;
        } catch(error){
            logger.error(`****************************************************************`);
            logger.error(`** getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress).catch(error)`);
            logger.error(`** - memberAccountProperties.address= ${memberAccountProperties.address}`)
            logger.error(`** - channelAddress= ${channelAddress}`)
            logger.error(`** - error= ${error}`)
            throw error;
        }
    }




    /**
     * Get a new JupAccount, Fund a new Channel, send Channel_Record transaction, Add member pubKeys to channel account.
     *
     * @param {string} channelName
     * @param {GravityAccountProperties} firstMemberProperties
     * @returns {GravityAccountProperties}
     */
    async createNewChannelAndAddFirstMember(channelName, firstMemberProperties){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## createNewChannelAndAddFirstMember(channelName: ${channelName},firstMemberProperties)`);
        logger.verbose(`## `);
        if(!(firstMemberProperties instanceof GravityAccountProperties)){throw new Error('firstMemberProperties is invalid')}
        if(!gu.isNonEmptyString(channelName)){ throw new Error('channelName is empty');}
        const channelPassphrase = gu.generatePassphrase();
        const channelPassword = gu.generateRandomPassword();
        const channelAccountProperties = await instantiateGravityAccountProperties(channelPassphrase, channelPassword);
        channelAccountProperties.channelName = channelName;
        try {
            const fundingResponse = await jupiterFundingService.provideInitialStandardTableFunds(channelAccountProperties);
            const transactionWaitResponse = await jupiterFundingService.waitForTransactionConfirmation(fundingResponse.data.transaction);  //need to wait for confirmation in order for account to send transactions.
            const processNewMemberResponse = await this.processNewMember(firstMemberProperties, channelAccountProperties, 'creator');

            return channelAccountProperties;
        } catch (error){
            logger.error(`****************************************************************`);
            logger.error(`** createNewChannelAndAddFirstMember(channelName, firstMemberProperties).catch(error)`);
            logger.error(`** `);
            logger.error(`   channelName= ${channelName}`)
            logger.error(`   firstMemberProperties.address= ${firstMemberProperties.address}`)
            logger.error(`   error= ${error}`)
            throw error;
        }
    }


    /**
     *  Add member info to channel account; add channel info to member account
     * @param memberAccountProperties
     * @param channelAccountPropertiesInvitedTo
     * @returns {Promise<void>}
     */
    async processNewMember(memberAccountProperties,channelAccountPropertiesInvitedTo, role = 'basic-member'){
        logger.verbose(`########################################################################`);
        logger.verbose(`## processNewMember(memberAccountProperties,channelAccountPropertiesInvitedTo)`);
        logger.verbose(`## `);
        if(! memberAccountProperties instanceof GravityAccountProperties){throw new Error('memberAccountProperties is invalid')}
        if(! channelAccountPropertiesInvitedTo instanceof GravityAccountProperties){throw new Error('channelAccountPropertiesInvitedTo is invalid')}
        logger.sensitive(`   memberAccountProperties.address= ${JSON.stringify(memberAccountProperties.address)}`);
        logger.sensitive(`   channelAccountPropertiesInvitedTo.address= ${channelAccountPropertiesInvitedTo.address}`);

        const params = {
            channel:  channelAccountPropertiesInvitedTo.address,  //channel_record.account,
            password: channelAccountPropertiesInvitedTo.password,  //channel_record.password,
            account: memberAccountProperties.address,//decryptedAccountData.account,
            alias: memberAccountProperties.getCurrentAliasNameOrNull()
        };

        try {
            const response1 = await metis.addToMemberList(params); // adds the member to the channel jupiter key/value properties
            const response2 = await this.addMemberInfoToChannelIfDoesntExist(memberAccountProperties, channelAccountPropertiesInvitedTo,role)
            const response3 = await this.addChannelInfoToAccountIfDoesntExist(memberAccountProperties, channelAccountPropertiesInvitedTo)
            // @TODO not sure why unconfirmed transactions dont show the above transactions. For now lets wait for a confirmation.

            if(response3.hasOwnProperty('data')){
                // const response3WaitResponse = await jupiterFundingService.waitForTransactionConfirmation(response3.data.transaction);
            } else {
                console.log(`looks like the channel is already registered to the memember`);
                console.log(response3)
            }


        } catch(error) {
            logger.error(`****************************************************************`);
            logger.error(`** processNewMember(memberAccountProperties,channelAccountPropertiesInvitedTo).catch(error)`);
            logger.error(`** `);
            logger.error(`   memberAccountProperties.address= ${memberAccountProperties.address}`)
            logger.error(`   channelAccountPropertiesInvitedTo.address= ${channelAccountPropertiesInvitedTo.address}`)
            logger.error(`   error= ${error}`)
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
    generateInviteRecordJson(channelName, inviteeAddress, inviterAccountProperties, channelAccountProperties){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## generateInviteRecordJson(channelName, inviteeAddress, inviterAccountProperties, channelAccountProperties)`);
        logger.verbose(`## `);
        if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('channelAccountProperties is invalid')}
        if(!(inviterAccountProperties instanceof GravityAccountProperties)){throw new Error('inviterAccountProperties is invalid')}
        if(!gu.isNonEmptyString(channelName)){throw new Error('channelName is empty')}
        if(!gu.isNonEmptyString(inviteeAddress)){throw new Error('inviteeAddress is empty')}

        const date = Date.now();
        const channelRecordJson = this.generateNewChannelRecordJson(channelName, channelAccountProperties, inviterAccountProperties.address);
        const inviteRecord = {
            recordType: 'channelInvite',
            inviteeAddress: inviteeAddress,
            inviterAddress: inviterAccountProperties.address,
            channelRecord: channelRecordJson,
            createdAt: date,
            version: 1,
        }

        return inviteRecord;
    }


    /**
     *
     * @param {string} channelName
     * @param {GravityAccountProperties} channelAccountProperties
     * @param {string} createdByAddress
     * @returns {{date: number, channel_record: {accountId: *, password, sender, createdBy, name, publickey, passphrase, account}}}
     */
    generateNewChannelRecordJson(channelName, channelAccountProperties, createdByAddress){
        if(!gu.isNonEmptyString(channelName)){throw new Error('channelName is empty')}
        if(!gu.isWellFormedJupiterAddress(createdByAddress)){throw new Error('createdByAddress is invalid')}
        if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('channelAccountProperties is invalid')}

        const createdDate = Date.now();
        const channelRecord = {
            recordType: 'channelRecord',
            channelName: channelName,
            address: channelAccountProperties.address,
            passphrase: channelAccountProperties.passphrase ,
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

    async channelHasMemberInfo(channelAccountProperties, memberAddress) {
        logger.sensitive(`#### channelHasMemberInfo(channelAccountProperties, memberAddress=${memberAddress})`);
        const listTag = channelConfig.channelMemberList;
        const recordTag = `${channelConfig.channelMember}.${memberAddress}`;
        return this.accountHasReferenceAccountInfo(channelAccountProperties, memberAddress, listTag, recordTag)
    }


    async accountHasReferenceAccountInfo(accountProperties,  referenceAddress, listTag, recordTag){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## accountHasReferenceAccountInfo(accountProperties,  referenceAddress, listTag, recordTag)`);
        logger.verbose(`## `);
        if(!accountProperties instanceof GravityAccountProperties){throw new Error('accountProperties is invalid')}
        if(!gu.isWellFormedJupiterAddress(referenceAddress)){throw new Error('referenceAddress is invalid')}
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
        const transactions = await this.jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(referenceAddress, recordTag);
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
        const transactions = await this.jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(accountProperties.address, recordTag);
        if(transactions.length === 0){
            return false
        }

        return true;
    }

    async addChannelInfoToAccountIfDoesntExist(accountProperties, channelAccountProperties) {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## addChannelInfoToAccountIfDoesntExist(accountProperties, channelAccountProperties)`);
        logger.verbose(`## `);
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
        const channelRecordPayload = this.generateNewChannelRecordJson(
            channelAccountProperties.channelName,
            channelAccountProperties,
            accountProperties.address
        );

        const encryptedChannelRecordPayload = accountProperties.crypto.encryptJson(channelRecordPayload);
        const feeType =   FeeManager.feeTypes.account_record;
        const recordTag = `${channelConfig.channelRecord}.${channelAccountProperties.address}`;

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
        logger.verbose(`###################################################################################`);
        logger.verbose(`## addMemberToChannelIfDoesntExist(memberProperties, channelProperties)`);
        logger.verbose(`## `);
        if (!(memberProperties instanceof GravityAccountProperties)) {
            throw new Error('invalid memberProperties')
        }
        if (!(channelProperties instanceof GravityAccountProperties)) {
            throw new Error('invalid channelProperties')
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

            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('New Member');
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')

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

            await this.gravityService.addNewRecordToReferencedDataSet(
                newMemberPayload,
                channelProperties,
                listTag,
                recordTag )

            // THIRD: Add the public keys to the channel
            memberPublicKeys.map(async (memberKey) => {
                await jupiterAccountService.addPublicKeyToChannel(memberKey, memberProperties.address, channelProperties);
            });

            // const listTag = channelConfig.channelMemberPublicKeyList;

            logger.debug('addMemberInfoToChannelIfDoesntExist() end.')
        } catch(error){
            logger.error(`****************************************************************`);
            logger.error(`** addMemberInfoToChannelIfDoesntExist(memberProperties, channelProperties).catch(error)`);
            logger.error(`** `);
            logger.error(`   memberProperties.address= ${memberProperties.address}`)
            logger.error(`   channelProperties.address= ${channelProperties.address}`)
            logger.error(`   error= ${error}`)
            throw error;
        }
    }
}


const {jupiterAPIService} = require("./jupiterAPIService");
const {gravity} = require('../config/gravity');
const {jupiterFundingService} = require("./jupiterFundingService");
const {jupiterTransactionsService} = require("./jupiterTransactionsService");
const {channelConfig, tableConfig, userConfig} = require("../config/constants");
const metis = require("../config/metis");
const {instantiateGravityAccountProperties} = require("../gravity/instantiateGravityAccountProperties");
const {head, stubFalse, has} = require("lodash");
const {transactionUtils} = require("../gravity/transactionUtils");
// const {jupiterTransactionMessageService} = require("./jupiterTransactionMessageService");

module.exports.chanService = new ChanService(
    metisGravityAccountProperties,
    jupiterAPIService,
    jupiterTransactionsService,
    jupiterFundingService,
    jupiterAccountService,
    tableService,
    gravity,
    gravityService,
    transactionUtils
)
