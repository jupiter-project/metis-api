const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');
const {metisGravityAccountProperties, GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {jupiterAccountService} = require("./jupiterAccountService");
const {tableService} = require("./tableService");
const {FeeManager, feeManagerSingleton} = require("./FeeManager");

/**
 *
 */
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
        gravity) {
        if(!appAccountProperties){throw new Error('missing applicationGravityAccountProperties')}
        if(!jupApi){throw new Error('missing jupiterAPIService')}
        if(!jupiterTransactionsService){throw new Error('missing jupiterTransactionsService')}
        if(!jupiterFundingService){throw new Error('missing jupiterFundingService')}
        if(!jupiterAccountService){throw new Error('missing jupiterAccountService')}
        if(!tableService){throw new Error('missing tableService')}
        if(!gravity){throw new Error('missing gravity')}
        this.appAccountProperties = appAccountProperties;
        this.jupiterTransactionsService = jupiterTransactionsService;
        this.jupApi = jupApi;
        this.jupiterFundingService = jupiterFundingService;
        this.jupiterAccountService = jupiterAccountService;
        this.tableService = tableService;
        this.gravity = gravity;
    }

    /**
     *
     * @param memberAccountProperties
     * @param channelAddress
     * @returns {Promise<void>}
     */
    async acceptInvitation(memberAccountProperties, channelAddress){

        throw new Error('RENE');

        if(!gu.isWellFormedJupiterAddress(channelAddress)){throw new Error('channelAddress is invalid')};
        if (!(memberAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('memberAccountProperties incorrect')
        }

        // getInvitation
        const invitation = await this.getChannelInvite(memberAccountProperties, channelAddress);





        const ExistingChannelAccountProperties = await this.getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress);
        if(ExistingChannelAccountProperties){ return }

        const channelAccountPropertiesInvitedTo = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
            invitation.channelRecord.passphrase,
            invitation.channelRecord.password
        )

        // Accept the invitation

        const params = {
            channel:  channelAddress,  //channel_record.account,
            password: invitation.channelRecord.password,  //channel_record.password,
            account: memberAccountProperties.address,//decryptedAccountData.account,
            alias: memberAccountProperties.getCurrentAliasNameOrNull()
        };


        const channelRecord =  this.generateChannelRecordJson(
            invitation.channelRecord.channel_record.channelName,
            channelAccountPropertiesInvitedTo,
            memberAccountProperties.address
        )

        // const channelRecordJson = invitation.channelRecord;
        const encryptedChannelRecordJson = memberAccountProperties.crypto.encryptJson(channelRecord);
        const feeType =   FeeManager.feeTypes.account_record;
        const tag = `${channelConfig.channelRecord}.${channelAccountPropertiesInvitedTo.address}`

        const response1 = await metis.addToMemberList(params); // adds the member to the channel jupiter key/value properties
        const response2 = await metis.addMemberToChannelIfDoesntExist(memberAccountProperties, channelAccountPropertiesInvitedTo)

        const sendTaggedAndEncipheredMetisMessageResponse = await this.jupiterTransactionsService.sendTaggedAndEncipheredMetisMessage(
            memberAccountProperties.passphrase,
            memberAccountProperties.address,
            encryptedChannelRecordJson,
            tag,
            feeType,
            memberAccountProperties.publicKey
        )
    }


    // async getReadableMessagesFromTaggedTransactionsOrNull(gravityAccountProperties, tag, isMetisEncrypted = true){

    /**
     *
     * @param getChannelAccountPropertiesOrNull
     * @param channelAddress
     * @returns {Promise<string>}
     */
    async getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress)`);
        logger.verbose(`## `);
        logger.sensitive(`channelAddress=${channelAddress}`);
        logger.sensitive(`memberAccountProperties.address=${memberAccountProperties.address}`);

        if(!gu.isWellFormedJupiterAddress(channelAddress)){throw new Error('channelAddress is invalid')};
        if (!(memberAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('memberAccountProperties incorrect')
        }
        const tag = `${channelConfig.channelRecord}.${channelAddress}`;
        const transactions = await jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(
            memberAccountProperties.address,
            tag
        )
        const transactionsBySelf = this.jupiterTransactionsService.filterMessageTransactionsBySender(transactions, memberAccountProperties.address);
        if (!gu.isNonEmptyArray(transactionsBySelf)) {
            return null;
        }
        const transaction = transactionsBySelf[0];
        const transactionId = this.jupiterTransactionsService.extractTransactionId(transaction);
        const message = await this.jupiterTransactionsService.getReadableMessageFromMessageTransactionIdOrNull(
            transactionId,
            memberAccountProperties.passphrase
        )

        const gravityAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
            message.channelRecord.passphrase,
            message.channelRecord.password
        )

        return gravityAccountProperties;
    }


    /**
     *
     * @param channelAccountProperties
     * @param inviterAccountProperties
     * @param inviteeAddress
     * @returns {Promise<void>}
     */
    async createNewInvitation(channelAccountProperties, inviterAccountProperties, inviteeAddress){
        if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('channelAccountProperties is invalid')};
        if(!(inviterAccountProperties instanceof GravityAccountProperties)){throw new Error('inviterAccountProperties is invalid')};
        if(!gu.isWellFormedJupiterAddress(inviteeAddress)){throw new Error('inviteeAddress is invalid')};

        // @TODO make sure not already invited.


//fix this!!!
        const channelName = '?'; //get from channel properties?
//fix this!!!



        const inviteRecordJson = this.generateInviteRecordJson(channelName, inviteeAddress, inviterAccountProperties, channelAccountProperties);
        // const encryptedInviteRecordJson = firstMemberProperties.crypto.encryptJson(channelRecordJson);

        //@TODO the message should either be encrypt with the reciever's publickey or not;
        const feeType = FeeManager.feeTypes.invitation_to_channel;
        // const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.invitation_to_channel);
        // const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.invitation_to_channel);

        const inviteeInfo = await jupiterAccountService.getAccountOrNull(inviteeAddress);
        const inviteePublicKey = inviteeInfo.publicKey;
        const tag = `${channelConfig.channelInviteRecord}.${channelAccountProperties.address}`;

        const sendTaggedAndEncipheredMetisMessageResponse = await this.jupiterTransactionsService.sendTaggedAndEncipheredMetisMessage(
            inviterAccountProperties.passphrase,
            inviteeAddress,
            JSON.stringify(inviteRecordJson), //Not encypted?
            tag,
            feeType,
            inviteePublicKey
        )
    }

    /**
     * Get a new JupAccount, Fund a new Channel, send Channel_Record transaction, Add member pubKeys to channel account.
     *
     * @param {string} channelName
     * @param {GravityAccountProperties} firstMemberProperties
     * @returns {GravityAccountProperties}
     */
    async createNewChannel(channelName, firstMemberProperties){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## createNewChannel(channelName,firstMemberProperties)`);
        logger.verbose(`## `);
        logger.sensitive(`channelName=${JSON.stringify(channelName)}`);
        if(!(firstMemberProperties instanceof GravityAccountProperties)){throw new Error('firstMemberProperties is invalid')};
        if(!gu.isWellFormedJupiterAddress(channelName)){'channelName is malformed'}

        const channelsTableAccountProperties = await this.jupiterAccountService.getTableAccountProperties(
            tableConfig.channelsTable,
            firstMemberProperties
        );

        const channelPassphrase = gu.generatePassphrase();
        const channelPassword = gu.generateRandomPassword();
        const channelAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(channelPassphrase, channelPassword);
        const channelRecordJson = this.generateChannelRecordJson(channelName, channelAccountProperties, firstMemberProperties.address);
        const encryptedChannelRecordJson = firstMemberProperties.crypto.encryptJson(channelRecordJson);
        const feeType =   FeeManager.feeTypes.account_record;
        const tag = `${channelConfig.channelRecord}.${channelAccountProperties.address}`
        const fundingResponse = await jupiterFundingService.provideInitialStandardTableFunds(channelAccountProperties);
        const transactionWaitResponse = await jupiterFundingService.waitForTransactionConfirmation(fundingResponse.data.transaction);  //need to wait for confirmation in order for account to send transactions.
        const sendTaggedAndEncipheredMetisMessageResponse = await this.jupiterTransactionsService.sendTaggedAndEncipheredMetisMessage(
            firstMemberProperties.passphrase,  // used to be from chanTable to user. now its user to user
            firstMemberProperties.address,
            encryptedChannelRecordJson,
            tag,
            feeType,
            firstMemberProperties.publicKey
        )

        await metis.addMemberToChannelIfDoesntExist(firstMemberProperties, channelAccountProperties);
        await metis.addToMemberList({
            channel: channelAccountProperties.address ,
            password: channelAccountProperties.password ,
            account: firstMemberProperties.address,
            alias: firstMemberProperties.getCurrentAliasNameOrNull()
        });

        return {channelName, channelAccountProperties};
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
        if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('channelAccountProperties is invalid')}

        const date = Date.now();
        const channelRecordJson = this.generateChannelRecordJson(channelName, channelAccountProperties, inviterAccountProperties.address);
        const inviteRecord = {
            recordType: 'channelInvite',
            version: '1',
            inviteeAddress: inviteeAddress,
            inviterAddress: inviterAccountProperties.address,
            channelRecord: channelRecordJson,
            date: date
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
    generateChannelRecordJson(channelName, channelAccountProperties, createdByAddress){
        if(!channelName){throw new Error('channelName is empty')}
        if(!gu.isWellFormedJupiterAddress(createdByAddress)){throw new Error('createdByAddress is invalid')}
        if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('channelAccountProperties is invalid')}

        const date = Date.now();
        const channelRecord = {
            recordType: 'channelRecord',
            channel_record: {
                channelName: channelName,
                account: channelAccountProperties.address,
                passphrase: channelAccountProperties.passphrase ,
                password: channelAccountProperties.password,
                publicKey: channelAccountProperties.publicKey,
                accountId: channelAccountProperties.accountId,
                sender: createdByAddress,
                createdBy: createdByAddress
            },
            // status: 'archived', @TODO add a status.
            date: date,
            version: 1
        }

        // tag = '#v1.metis.channel.channelRecord#'


        return channelRecord;
    }



    /**
     *
     * @param memberAccountProperties
     * @returns {Promise<*>}
     */
    async getChannelInvitations(memberAccountProperties) {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getChannelInvitations(memberAccountProperties)`);
        logger.verbose(`## `);

        if(!(memberAccountProperties instanceof GravityAccountProperties)) {throw new Error('memberAccountProperties is not well formed')};

        const transactions = await jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(
            memberAccountProperties.address,
            channelConfig.channelInviteRecord
        )
        const messages = await jupiterTransactionsService.getAllMessagesFromBlockChainAndIncludeTransactionInformation(
            memberAccountProperties,
            transactions
        );
        logger.sensitive(`messages= ${JSON.stringify(messages)}`);

        const  filteredMessages = messages.reduce((reduced, message) => {
            reduced.push(message.message);
            return reduced;
        }, []);

        return filteredMessages;
    }


    /**
     *
     * @param {GravityAccountProperties} memberAccountProperties
     * @param {string} channelAddress
     * @returns {Promise<object>}
     */
    async getChannelInvite(memberAccountProperties, channelAddress) {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getChannelInvite(memberAccountProperties, channelAddress)`);
        logger.verbose(`## `);
        logger.sensitive(`channelAddress=${JSON.stringify(channelAddress)}`);

        if (!gu.isWellFormedJupiterAddress(channelAddress)) {
            throw new Error('channelAddress not well formed')
        }
        if (!(memberAccountProperties instanceof GravityAccountProperties)) {
            throw new Error('mememberAccountProperties incorrect')
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
        const transactionId = this.jupiterTransactionsService.extractTransactionId(transaction);

        const message = await this.jupiterTransactionsService.getReadableMessageFromMessageTransactionId(
            transactionId,
            memberAccountProperties.passphrase
        )

        if (message.recordType !== 'channelInvite') {
            throw new Error('invalid invitation')
        }

        return message;
    }
}


const {jupiterAPIService} = require("./jupiterAPIService");
const {gravity} = require('../config/gravity');
const {jupiterFundingService} = require("./jupiterFundingService");
const {jupiterTransactionsService} = require("./jupiterTransactionsService");
const {channelConfig, tableConfig} = require("../config/constants");
const metis = require("../config/metis");

module.exports.chanService = new ChanService(
    metisGravityAccountProperties,
    jupiterAPIService,
    jupiterTransactionsService,
    jupiterFundingService,
    jupiterAccountService,
    tableService,
    gravity
)
