const {jupiterFundingService} = require("./jupiterFundingService");
const metis = require("../config/metis");
const {gravity} = require("../config/gravity");
const {feeManagerSingleton, FeeManager} = require("./FeeManager");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const logger = require('../utils/logger')(module);

const handleChannelCreationError = async (channelRecord) => {
    if (!channelRecord) {
        throw new Error('[channelCreationSetUp]: Channel record is required');
    }
    const accountPropertyFee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_property);
    const accountPropertyParams = {
        passphrase: channelRecord.record.passphrase,
        recipient: channelRecord.record.account,
        value: 'uncompleted',
        feeNQT: accountPropertyFee,
        property: `channel-creation-status`,
    };
    gravity.setAcountProperty(accountPropertyParams)
        .then(() => {}) //TODO
        .catch(error => {});// TODO what if it fails?
};

module.exports = {

    /**
     * Create a new Channel
     * @param channelRecord
     * @param decryptedAccountData
     * @param userPublicKey
     * @param done
     */
    channelCreationSetUp: async (channelRecord, decryptedAccountData, userPublicKey, done) => {
        if (!channelRecord) {
            throw new Error('[channelCreationSetUp]: Channel record is required');
        }

        if (channelRecord && channelRecord.model && channelRecord.model !== 'channel') {
            throw new Error('[channelCreationSetUp]: Channel record is required');
        }

        if (!decryptedAccountData) {
            throw new Error('[channelCreationSetUp]: User account data is required');
        }

        if (!userPublicKey) {
            throw new Error('[channelCreationSetUp]: User public key is required');
        }

        const params = {
            channel: channelRecord.record.account,
            password: channelRecord.record.password,
            account: decryptedAccountData.account,
            alias: decryptedAccountData.alias,
        };


        const memberProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
            decryptedAccountData.passphrase,
            decryptedAccountData.encryptionPassword);

        const channelProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
            channelRecord.record.passphrase,
            channelRecord.record.password);

        jupiterFundingService.provideInitialStandardTableFunds({address: channelRecord.record.account})
            .then(fundingResponse => jupiterFundingService.waitForTransactionConfirmation(fundingResponse.data.transaction))
            .then(() => metis.addMemberToChannelIfDoesntExist(
                memberProperties,
                channelProperties
                )
            )
            .then(() => metis.addToMemberList(params))
            .then(() => console.log('done'))
            .then(() => done())
            .catch(error => {
                logger.error(`***********************************************************************************`);
                logger.error(`** channelCreationSetUp().catch(error)`);
                logger.error(`** `);
                console.log(error);
                // handleChannelCreationError(channelRecord);
                done(error);
            });
    }
}
