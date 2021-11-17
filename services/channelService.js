const {jupiterFundingService} = require("./jupiterFundingService");
const metis = require("../config/metis");
const {gravity} = require("../config/gravity");
const {feeManagerSingleton, FeeManager} = require("./FeeManager");

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
    channelCreationSetUp: (channelRecord, decryptedAccountData, userPublicKey, done) => {
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

        jupiterFundingService.provideInitialStandardTableFunds({address: channelRecord.record.account})
            .then(fundingResponse => jupiterFundingService.waitForTransactionConfirmation(fundingResponse.data.transaction))
            .then(() => metis.addMemberToChannelIfDoesntExist(
                    decryptedAccountData,
                    userPublicKey,
                    channelRecord.record.passphrase,  // from
                    channelRecord.record.account, // to
                    channelRecord.record.publicKey,
                    channelRecord.record.password
                )
            )
            .then(() => metis.addToMemberList(params))
            .then(() => done())
            .catch(error => {
                handleChannelCreationError(channelRecord);
                done(error);
            });
    }
}
