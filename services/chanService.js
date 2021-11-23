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

    async createNewInvitation(channelAccountProperties, inviterAccountProperties, inviteeAddress){
        if(!(channelAccountProperties instanceof GravityAccountProperties)){throw new Error('channelAccountProperties is invalid')};
        if(!(inviterAccountProperties instanceof GravityAccountProperties)){throw new Error('inviterAccountProperties is invalid')};
        if(!gu.isWellFormedJupiterAddress(inviteeAddress)){throw new Error()};

        const channelName = '?'; //get from channel properties?
        const inviteRecordJson = this.generateInviteRecordJson(channelName, inviteeAddress, inviterAccountProperties, channelAccountProperties);
        // const encryptedInviteRecordJson = firstMemberProperties.crypto.encryptJson(channelRecordJson);

        //@TODO the message should either be encrypt with the reciever's publickey or not;
        const feeType = FeeManager.feeTypes.invitation_to_channel;
        // const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.invitation_to_channel);
        // const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.invitation_to_channel);

        const inviteeInfo = await jupiterAccountService.getAccountOrNull(inviteeAddress);
        const inviteePublicKey = inviteeInfo.publicKey;

        const sendTaggedAndEncipheredMetisMessageResponse = await this.jupiterTransactionsService.sendTaggedAndEncipheredMetisMessage(
            inviterAccountProperties.passphrase,
            inviteeAddress,
            JSON.stringify(inviteRecordJson), //Not encypted?
            channelConfig.channelInviteRecord,
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
        if(!channelName){throw new Error('channelName is empty')};

        const channelsTableAccountProperties = await  this.jupiterAccountService.getTableAccountProperties(tableConfig.channelsTable ,firstMemberProperties);
        console.log(channelsTableAccountProperties);
        const channelPassphrase = gu.generatePassphrase();
        const channelPassword = gu.generateRandomPassword();
        const channelAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(channelPassphrase, channelPassword);
        const channelRecordJson = this.generateChannelRecordJson(channelName, channelAccountProperties, firstMemberProperties.address);
        const encryptedChannelRecordJson = firstMemberProperties.crypto.encryptJson(channelRecordJson);
        const feeType =   FeeManager.feeTypes.account_record;
        const fundingResponse = await jupiterFundingService.provideInitialStandardTableFunds(channelAccountProperties);
        const transactionWaitResponse = await jupiterFundingService.waitForTransactionConfirmation(fundingResponse.data.transaction);  //need to wait for confirmation in order for account to send transactions.
        const sendTaggedAndEncipheredMetisMessageResponse = await this.jupiterTransactionsService.sendTaggedAndEncipheredMetisMessage(
            channelsTableAccountProperties.passphrase,
            firstMemberProperties.address,
            encryptedChannelRecordJson,
            channelConfig.channelRecord,
            feeType,
            firstMemberProperties.publicKey
        )

        // send self-trans to member with chan info.
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
        // channel.name = channel.channel_record.name;
        const inviteRecord = {
            recordType: 'channelInvite',
            invite_record: {
                recipient: inviteeAddress, //its usually the alias
                sender: inviterAccountProperties.address,
                channel_record: channelRecordJson,
            },
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
            date: date
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

        const transactionList = await jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(
            memberAccountProperties.address,
            channelConfig.channelInviteRecord
        )
        const messages = await jupiterTransactionsService.getAllMessagesFromBlockChainAndIncludeTransactionInformation(
            memberAccountProperties,
            transactionList
        );
        logger.sensitive(`Decrypted invites: ${JSON.stringify(messages)}`);

        const  filteredMessages = messages.reduce((reduced, message) => {
            // if (message.message.dataType === 'channelInvite'){
                return reduced.push(message.message);
            // }
            // return reduced;
        }, []);

        // const  filteredMessages = messages.reduce((reduced, message) => {
        //     if (message.message.dataType === 'channelInvite'){
        //         reduced.push(message.message);
        //     }
        //     return reduced;
        // }, []);

        return filteredMessages;
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
