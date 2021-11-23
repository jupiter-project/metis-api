import gu from '../utils/gravityUtils';
import {channelConfig, tableConfig, userConfig} from '../config/constants';
const {FeeManager, feeManagerSingleton} = require('./FeeManager');
const {GravityAccountProperties, metisGravityAccountProperties} = require('../gravity/gravityAccountProperties');
const _ = require('lodash');
const {jupiterAPIService} = require('./jupiterAPIService');
const {tableService} = require('./tableService');
const {jupiterTransactionsService} = require('./jupiterTransactionsService');
const logger = require('../utils/logger')(module);
const bcrypt = require('bcrypt-nodejs');

class JupiterAccountService {
    constructor(jupiterAPIService, applicationProperties, tableService, jupiterTransactionsService) {
        if (!jupiterAPIService) {
            throw new Error('missing jupiterAPIService');
        }
        if (!applicationProperties) {
            throw new Error('missing applicationProperties');
        }
        if (!tableService) {
            throw new Error('missing tableService');
        }
        if (!jupiterTransactionsService) {
            throw new Error('missing jupiterTransactionsService');
        }

        this.jupiterAPIService = jupiterAPIService;
        this.applicationProperties = applicationProperties;
        this.tableService = tableService;
        this.jupiterTransactionsService = jupiterTransactionsService;
    }

    async addRecordToMetisUsersTable(accountProperties, metisUsersTableProperties) {
        logger.verbose('###########################################################################');
        logger.verbose('## addRecordToMetisUsersTable(accountProperties, metisUsersTableProperties)');
        logger.verbose('##');
        logger.verbose(`  accountProperties.address= ${accountProperties.address}`);
        logger.verbose(`  metisUsersTableProperties.address= ${metisUsersTableProperties.address}`);
        logger.verbose(`  metisUsersTableProperties.publicKey= ${metisUsersTableProperties.publicKey}`);

        return new Promise((resolve, reject) => {
            this.generateId(accountProperties, metisUsersTableProperties).then((transactionId) => {
                logger.verbose('---------------------------------------------------------------------------------');
                logger.verbose(`--- addRecordToMetisUsersTable()generateId().then(transactionId= ${transactionId})`);
                logger.verbose('--');
                logger.debug(`transactionId= ${transactionId}`);
                const userRecord = accountProperties.generateUserRecord(transactionId);
                logger.debug(`userRecord.account=`);
                logger.debug(`metisUsersTableProperties.crypto = ${JSON.stringify(metisUsersTableProperties.crypto)}`);
                const encryptedUserRecord = metisUsersTableProperties.crypto.encryptJson(userRecord);
                logger.debug(`encryptedUserRecord= ${encryptedUserRecord}`);
                const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record);
                const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}
                this.jupiterAPIService
                    .sendSimpleEncipheredMetisMessage(metisUsersTableProperties, accountProperties, encryptedUserRecord, fee, subtype)
                    .then((response) => {
                        logger.verbose('---------------------------------------------------------------------------------');
                        logger.verbose(
                            `-- addRecordToMetisUsersTable()generateId().then(transactionId= ${transactionId}).sendSimpleEncipheredMetisMessage().then(response)`
                        );
                        logger.verbose('--');
                        return resolve({
                            data: response.data,
                            transactionsReport: [{name: 'users-table-record', id: response.data.transaction}]
                        });
                    });
            });
        });
    }

    /**
     *
     * @param accountProperties
     * @param metisUsersTableProperties
     * @returns {Promise<unknown>}
     */
    async generateId(accountProperties, metisUsersTableProperties) {
        logger.verbose('###########################################');
        logger.verbose('## generateId()');
        logger.verbose('###########################################');
        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record);
        const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}

        return new Promise((resolve, reject) => {
            this.jupiterAPIService
                .sendSimpleNonEncipheredMetisMessage(metisUsersTableProperties, accountProperties, 'Generating Id for record', fee, subtype, false)
                .then((response) => {
                    return resolve(response.data.transaction);
                })
                .catch((error) => {
                    return reject(error);
                });
        });
    }

    async getAccountOrNull(address) {
        return this.jupiterAPIService
            .getAccount(address)
            .then((response) => {
                return response;
            })
            .catch((error) => {
                if (error === 'Unknown account') {
                    return null;
                }
                if (error === 'Incorrect \\"account\\"') {
                    return null;
                }

                throw error;
            });
    }

    /**
     *
     * @param passphrase
     * @returns {Promise<{accountRS,publicKey, requestProcessingTime, account }>}
     */
    async getAccountId(passphrase) {
        return this.jupiterAPIService.getAccountId(passphrase).then((response) => {
            return response;
        });
    }

    /**
     *
     * @param address
     * @param passphrase
     * @param password
     * @param statementId
     * @param accountType
     * @param params
     * @returns {Promise<{Promise<{ GravityAccountProperties, balance, records,  attachedTables: [tableStatement]}>}
     */
    async fetchAccountStatement(passphrase, password, statementId = '', accountType = '', params = {}) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## fetchAccountStatement(passphrase, password, statementId=${statementId}, accountType=${accountType})`);
        logger.verbose('##');
        logger.sensitive(`passphrase=${JSON.stringify(passphrase)}`);
        logger.sensitive(`password=${JSON.stringify(password)}`);
        logger.sensitive(`statementId=${JSON.stringify(statementId)}`);
        logger.sensitive(`accountType=${JSON.stringify(accountType)}`);
        logger.sensitive(`params=${JSON.stringify(params)}`);

        if (!gu.isWellFormedPassphrase(passphrase)) {
            throw new Error('problem with passphrase');
        }

        return new Promise(async (resolve, reject) => {
            const accountInfo = await jupiterAPIService.getAccountInformation(passphrase); //{address,accountId,publicKey,success}
            const passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
            const properties = new GravityAccountProperties(
                accountInfo.address,
                accountInfo.accountId,
                accountInfo.publicKey,
                passphrase,
                passwordHash,
                password
            );

            const allBlockChainTransactions = await this.jupiterTransactionsService.getAllConfirmedAndUnconfirmedBlockChainTransactions(accountInfo.address);
            const promises = [];
            promises.push(this.getAccountOrNull(accountInfo.address));
            promises.push(this.getAccountId(passphrase));
            promises.push(
                this.jupiterTransactionsService.extractMessagesBySender(properties, allBlockChainTransactions)
            );
            promises.push(this.jupiterAPIService.getAliases(accountInfo.address));

            Promise.all(promises)
                .then((results) => {
                    logger.verbose('---------------------------------------------------------------------------');
                    logger.verbose(`-- fetchAccountStatement().promise.all().then()`);
                    logger.verbose('--');

                    const [account, getAccountIdResponse, _transactionMessages, aliases] = results;
                    const transactionMessages = _transactionMessages.map((message) => message.message);
                    properties.publicKey = getAccountIdResponse.publicKey;
                    let accountBalance = null;
                    let accountUnconfirmedBalance = null;

                    if (account && account.data) {
                        properties.accountId = account.data.account;
                        accountBalance = account.data.balanceNQT;
                        accountUnconfirmedBalance = account.data.unconfirmedBalanceNQT;
                    }

                    const records = this.tableService.extractRecordsFromMessages(transactionMessages);

                    aliases.forEach((aliasInfo) => {
                        properties.addAlias(aliasInfo);
                    });

                    const attachedTablesProperties = this.tableService.extractTablesFromMessages(transactionMessages);
                    const attachedTablesStatementsPromises = [];
                    for (let i = 0; i < attachedTablesProperties.length; i++) {
                        const tableAccountProperties = attachedTablesProperties[i];

                        attachedTablesStatementsPromises.push(
                            this.fetchAccountStatement(tableAccountProperties.passphrase, password, `table-${tableAccountProperties.name}`, 'table', {
                                tableName: tableAccountProperties.name,
                            })
                        );
                    }

                    Promise.all(attachedTablesStatementsPromises).then((attachedTablesStatements) => {
                        // logger.sensitive(`attachedTables= ${JSON.stringify(attachedTables)}`);
                        const statement = {
                            statementId: statementId,
                            properties: properties,
                            balance: accountBalance,
                            unconfirmedBalance: accountUnconfirmedBalance,
                            records: records,
                            messages: transactionMessages,
                            attachedTables: attachedTablesStatements,
                            blockchainTransactionCount: allBlockChainTransactions.length,
                            transactions: allBlockChainTransactions,
                        };

                        if (accountType === 'table') {
                            statement.tableName = params.tableName;
                        }

                        return resolve(statement);
                    });
                })
                .catch((error) => {
                    logger.error('*******************************************************************');
                    logger.error(`** fetchAccountStatement( passphrase, password, statementId = '', accountType, params = {})`);
                    logger.error('**');
                    reject(error);
                });
        });
    }

    fetchAccountData(accountProperties) {
        logger.verbose('#####################################################################################');
        logger.verbose('## fetchAccountData(accountProperties)');
        logger.verbose('##');
        return new Promise((resolve, reject) => {
            this.jupiterTransactionsService
                .fetchAllMessagesBySender(accountProperties)
                .then((transactionMessagesContainers) => {
                    logger.verbose('---------------------------------------------------------------------------------------');
                    logger.verbose(`-- fetchAccountData().fetchAllMessagesBySender().then(transactionMessages)`);
                    logger.verbose('--');

                    const transactionMessages = transactionMessagesContainers.map((messageContainer) => messageContainer.message);

                    const attachedTables = this.tableService.extractTablesFromMessages(transactionMessages);
                    logger.sensitive(`attachedTables= ${JSON.stringify(attachedTables)}`);

                    const records = this.tableService.extractRecordsFromMessages(transactionMessages);

                    this.jupiterAPIService
                        .getAccountInformation(accountProperties.passphrase)
                        .then((accountInformationResponse) => {
                            accountProperties.publicKey = accountInformationResponse.publicKey;
                            resolve({
                                attachedTables: attachedTables,
                                allMessages: transactionMessagesContainers,
                                allRecords: records,
                                accountProperties: accountProperties,
                            });
                        })
                        .catch((error) => {
                            reject(error);
                        });
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    /**
     *
     * @param accountProperties
     * @returns {Promise<unknown>}
     */
    async getStatement(accountProperties) {
        logger.verbose('##############################################################');
        logger.verbose('## getStatement()');
        logger.verbose('##############################################################');
        return new Promise((resolve, reject) => {
            this.jupiterAPIService
                .getBalance(accountProperties.address)
                .then((response) => {
                    let accountStatement = {};
                    accountStatement.balanceNQT = response.data.balanceNQT;
                    accountStatement.hasMinimumAppBalance = null;
                    accountStatement.hasMinimumTableBalance = null;

                    if (this.applicationProperties.isApp()) {
                        logger.info(`Balance: ${parseFloat(response.data.balanceNQT) / 10 ** this.applicationProperties.moneyDecimals} JUP.`);
                        accountStatement.hasMinimumAppBalance = response.data.balanceNQT >= this.applicationProperties.minimumAppBalance;
                        accountStatement.hasMinimumTableBalance = response.data.balanceNQT >= this.applicationProperties.minimumTableBalance;
                    }

                    return resolve(accountStatement);
                })
                .catch((error) => {
                    logger.error(`${error}`);
                    reject(error);
                });
        });
    }


    async getLatestListByTag(accountProperties, tag){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getLatestListByTag(accountProperties, tag)`);
        logger.verbose(`## `);
        logger.sensitive(`tag=${JSON.stringify(tag)}`);

        if(! accountProperties instanceof GravityAccountProperties){throw new Error('invalid accountProperties')}
        if(!tag){throw new Error('empty tag')}

        const transactions = await jupiterTransactionsService.getBlockChainTransactionsByTag(accountProperties.address, tag);
        if(transactions.length < 1){ return []}
        const mostRecentTransaction = this.jupiterTransactionsService.getMostRecentTransaction(transactions);

        const transactionMessage = await jupiterTransactionsService.getReadableMessageFromMessageTransactionIdAndDecrypt(
            mostRecentTransaction.transaction,
            accountProperties.crypto,
            accountProperties.passphrase
        );

        if(!Array.isArray(transactionMessage)){throw new Error('transaction message is not an array')}

        return transactionMessage;
    }

    /**
     * Retrieves all public keys associated to an address
     * @param {GravityAccountProperties} accountProperties
     * @returns {Promise<unknown>}
     */
    async getPublicKeysFromUserAccount(accountProperties) {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getPublicKeysFromUserAccount(accountProperties)`);
        logger.verbose(`## `);
        logger.sensitive(`accountProperties=${JSON.stringify(accountProperties)}`);

        if(! accountProperties instanceof GravityAccountProperties){throw new Error('invalid accountProperties')}

        try {

            const latestListOfPublicKeyTransactions = await this.getLatestListByTag(accountProperties, userConfig.userPublicKeyList);

            const publicKeyIds = await jupiterTransactionsService.readMessagesFromMessageTransactionIdsAndDecryptOrPassThrough(
                latestListOfPublicKeyTransactions,
                accountProperties.crypto,
                accountProperties.passphrase
            );

            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            console.log('publicKeyIds');
            console.log(publicKeyIds);
            console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')

            return publicKeyIds.map((pk) => pk.message);
        } catch (error) {
            error.message = `getPublicKeysFromUserAccount: ${error.message}`;
            logger.error(`${error}`);
            throw error;
        }
    }

    async getPublicKeysFromChannelAccount(accountProperties) {
        try {
            const transactions = await jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(accountProperties.address, channelConfig.channelUserList);
            const [latestTransaction] = transactions;

            const message = await jupiterTransactionsService.getReadableMessageFromMessageTransactionIdAndDecrypt(
                latestTransaction.transaction,
                accountProperties.crypto,
                accountProperties.passphrase
            );
            const publicKeyIds = await jupiterTransactionsService.readMessagesFromMessageTransactionIdsAndDecryptOrPassThrough(
                message,
                accountProperties.crypto,
                accountProperties.passphrase
            );

            return publicKeyIds.map((pk) => pk.message);
        } catch (error) {
            logger.error(`${error}`);
        }
    }



    async updateAllMemberChannelsWithNewPublicKey(memberProperties, publicKey) {
        try {
            const memberChannels = await this.getMemberChannels(memberProperties);

            memberChannels.map(async ({passphrase, password}) => {
                const properties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(passphrase, password);
                await this.addPublicKeyToChannelOrNull(publicKey, memberProperties.address, properties);
            });

        } catch (error) {
            logger.error(`ERROR: [updateAllMemberChannelsWithNewPublicKey]: ${JSON.stringify(error)}`);
            throw error;
        }
    }

    /**
     * getMemberChannels
     * @param {GravityAccountProperties} memberProperties
     * @returns {Promise<*[]|{address,passphrase,password}>}
     */
    async getMemberChannels(memberProperties) {
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getMemberChannels(memberProperties)`);
        logger.verbose(`## `);
        try {
            if(!(memberProperties instanceof  GravityAccountProperties)){throw new Error('memberProperties is invalid')};
            // const channelTableAccountProperties = await this.getTableAccountProperties( tableConfig.channelsTable, memberProperties);
            const transactions = await this.jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(memberProperties.address, channelConfig.channelRecord);
            const transactions2 = await this.jupiterTransactionsService.filterMessageTransactionsBySender(transactions, memberProperties.address); //used to be by TableChannel. we are removing the table channel.
            const transactionIds = this.jupiterTransactionsService.extractTransactionIds(transactions2);
            const channelRecords = await this.jupiterTransactionsService.readMessagesFromMessageTransactionIdsAndDecrypt(transactionIds,memberProperties.crypto, memberProperties.passphrase);
            const listOfChannelsAndTheirProperties = channelRecords.map( async message => {
                    const properties = await  GravityAccountProperties.instantiateBasicGravityAccountProperties(message.message.channel_record.passphrase, message.message.channel_record.password);
                     properties.channelName = message.message.channel_record.channelName;
                     return properties;
            })

            return await Promise.all(listOfChannelsAndTheirProperties);
        } catch (error) {
            logger.error(`***********************************************************************************`);
            logger.error(`** getAllMemberChannels().catch(error)`);
            logger.error(`** `);
            console.log(error);
            throw error;
        }
    }

    /**
     *
     * @param {GravityAccountProperties} gravityAccountProperties
     * @param {string} tag
     */
    async getPublicKeyTransactionsList(gravityAccountProperties, tag) {
        try {
            const [latestList] = await jupiterTransactionsService.getBlockChainTransactionsByTag(gravityAccountProperties.address, tag);
            return await jupiterTransactionsService.getReadableMessageFromMessageTransactionIdAndDecrypt(
                latestList.transaction,
                gravityAccountProperties.crypto,
                gravityAccountProperties.passphrase
            );
        } catch (error) {
            logger.error(`ERROR: [getPublicKeyTransactionsList]: ${JSON.parse(error)}`);
            throw error;
        }
    }


    async addPublicKeyToChannelOrNull(userPublicKey, userAddress, channelAccountProperties){
        try {
            return this.addPublicKeyToChannel(userPublicKey, userAddress, channelAccountProperties);
        } catch (error){
            logger.error(`ERROR: [addPublicKeyToChannelOrNull]: ${JSON.stringify(error)}`);
            return null;
        }
    }

    /**
     *
     * @param userPublicKey
     * @param userAddress
     * @param {GravityAccountProperties} channelAccountProperties
     */
    async addPublicKeyToChannel(userPublicKey, userAddress, channelAccountProperties) {
        try {
            const hasPublicKey = await this.hasPublicKeyInChannelAccount(userPublicKey, channelAccountProperties)
            if (hasPublicKey) {
                // TODO create an error business handler
                const error = new Error();
                error.code = 'PUBLIC-KEY_EXIST';
                error.message = 'Public key already exists';
                throw error;
            }

            const newUserChannel = {
                userAddress,
                userPublicKey,
                date: Date.now()
            };

            logger.sensitive(`newUserChannel=${JSON.stringify(newUserChannel)}`);

            const encryptedMessage = channelAccountProperties.crypto.encrypt(JSON.stringify(newUserChannel));
            const checksumPublicKey = gu.generateChecksum(userPublicKey);
            const channelUserTag = `${channelConfig.channelUsers}.${userAddress}.${checksumPublicKey}`;
            const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record);
            const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}

            const newUserPromise = await jupiterAPIService.sendEncipheredMetisMessageAndMessage(
                channelAccountProperties.passphrase,
                channelAccountProperties.address,
                encryptedMessage, // encipher message  [{ userAddress: userData.account, userPublicKey, date: Date.now() }];
                channelUserTag, // message: 'v1.metis.channel.public-key.JupAccount.checksum'
                fee,
                subtype,
                false,
                channelAccountProperties.publicKey
            );

            const latestPublicKeyTransactionsList = await this.getPublicKeyTransactionsList(channelAccountProperties, channelConfig.channelUserList);
            latestPublicKeyTransactionsList.push(newUserPromise.transaction);
            const encryptedPublicKeyTransactionList = channelAccountProperties.crypto.encryptJson(latestPublicKeyTransactionsList);

            const publicKeyList = await jupiterAPIService.sendEncipheredMetisMessageAndMessage(
                channelAccountProperties.passphrase,
                channelAccountProperties.address,
                encryptedPublicKeyTransactionList,
                channelConfig.channelUserList,
                fee,
                subtype,
                false,
                channelAccountProperties.publicKey
            );
        } catch (error) {
            logger.error(`ERROR: [addPublicKeyToChannel]: ${JSON.stringify(error)}`);
            throw error;
        }
    }

    /**
     *
     * @param {string} publicKey
     * @param {GravityAccountProperties} gravityAccountProperties
     * @returns {*}
     */
    addPublicKeyToUserAccount(publicKey, gravityAccountProperties) {
        return this.hasPublicKeyInUserAccount(publicKey, gravityAccountProperties)
            .then(hasPublicKey => {
                if (hasPublicKey) {
                    // TODO create an error business handler
                    const error = new Error();
                    error.code = 'PUBLIC-KEY_EXIST';
                    error.message = 'Public key already exists';
                    throw error;
                }

                const encryptedMessage = gravityAccountProperties.crypto.encrypt(publicKey);
                const userPublicKeyPromise = jupiterTransactionsService.sendTaggedAndEncipheredMetisMessage(
                    gravityAccountProperties.passphrase,
                    gravityAccountProperties.address,
                    encryptedMessage,
                    userConfig.userPublicKey,
                    FeeManager.feeTypes.account_record,
                    gravityAccountProperties.publicKey
                );

                const userPublicKeyListPromise = jupiterTransactionsService.getBlockChainTransactionsByTag(
                    gravityAccountProperties.address,
                    userConfig.userPublicKeyList
                );
                return Promise.all([userPublicKeyPromise, userPublicKeyListPromise]);
            })
            .then(([userPublicKey, userPublicKeyList]) => {
                const latestPublicKeyList = userPublicKeyList.pop();
                return Promise.all([
                    userPublicKey,
                    jupiterTransactionsService.getReadableMessageFromMessageTransactionIdAndDecrypt(
                        latestPublicKeyList.transaction,
                        gravityAccountProperties.crypto,
                        gravityAccountProperties.passphrase
                    ),
                ]);
            })
            .then(([userPublicKey, userPublicKeyList]) => {
                userPublicKeyList.push(userPublicKey);
                const encryptedMessage = gravityAccountProperties.crypto.encryptJson(userPublicKeyList);
                return jupiterTransactionsService.sendTaggedAndEncipheredMetisMessage(
                    gravityAccountProperties.passphrase,
                    gravityAccountProperties.address,
                    encryptedMessage,
                    userConfig.userPublicKeyList,
                    FeeManager.feeTypes.account_record,
                    gravityAccountProperties.publicKey
                );
            });
    }

    /**
     *
     * @param {string} publicKey
     * @param {GravityAccountProperties} gravityAccountProperties
     * @param {string} tag
     * @returns {*}
     */
    publicKeyMessages(publicKey, gravityAccountProperties, tag) {
        return jupiterTransactionsService
            .getBlockChainTransactionsByTag(gravityAccountProperties.address, tag)
            .then((transactions) => {
                const [transactionId] = transactions;
                return transactionId ? jupiterTransactionsService.getReadableMessageFromMessageTransactionIdAndDecrypt(
                    transactionId,
                    gravityAccountProperties.crypto,
                    gravityAccountProperties.passphrase
                ) : [];
            })
            .then((publicKeyTransactionIds) => {
                if (!Array.isArray(publicKeyTransactionIds) || publicKeyTransactionIds.length === 0) {
                    return [];
                }

                return jupiterTransactionsService.readMessagesFromMessageTransactionIdsAndDecrypt(
                    publicKeyTransactionIds,
                    gravityAccountProperties.crypto,
                    gravityAccountProperties.passphrase
                );
            });
    }

    hasPublicKeyInChannelAccount(publicKey, gravityAccountProperties) {
        return this.publicKeyMessages(publicKey, gravityAccountProperties, channelConfig.channelUserList)
    }

    hasPublicKeyInUserAccount(publicKey, gravityAccountProperties) {
        return this.publicKeyMessages(publicKey, gravityAccountProperties, userConfig.userPublicKeyList)
            .then((userPublicKeyArray) => userPublicKeyArray.some((upk) => upk === publicKey));
    }

    /**
     *
     * @param channelAddress
     * @param memberAccountProperties
     */
    async getChannelAccountPropertiesBelongingToMember(channelAddress, memberAccountProperties ){
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getChannelAccountPropertiesBelongingToMember(channelAddress, memberAccountProperties )`);
        logger.verbose(`## `);
        logger.sensitive(`channelAddress= ${JSON.stringify(channelAddress)}`);
        if(!gu.isWellFormedJupiterAddress(channelAddress)){throw new Error('channelAddress is invalid')};
        if(!(memberAccountProperties instanceof GravityAccountProperties )){ throw new Error('memberAccountProperties is invalid')}
        const allMemberChannels = await this.getMemberChannels(memberAccountProperties);
        console.log('#########################################')
        console.log(allMemberChannels);
        const channelAccountPropertiesArray = allMemberChannels.filter( channelAccountProperties => channelAccountProperties.address === channelAddress );
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
        console.log('channelAccountProperties');
        console.log(channelAccountPropertiesArray);
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')

        if(channelAccountPropertiesArray.length > 0){
            return channelAccountPropertiesArray[0];
        }

        throw new Error('doesnt exist!')
    }


    async getTableAccountProperties( tag, userAccountProperties){ //tableConfig.channelsTable
        logger.verbose(`###################################################################################`);
        logger.verbose(`## getTableAccountProperties( tag, userAccountProperties)`);
        logger.verbose(`## `);
        logger.sensitive(`tag=${JSON.stringify(tag)}`);

        // const allBlockChainTransactions = await this.jupiterTransactionsService.getAllConfirmedAndUnconfirmedBlockChainTransactions(userAccountProperties.address);
        // const messagesBySender = await this.jupiterTransactionsService.extractMessagesBySender(userAccountProperties, allBlockChainTransactions);
        // const transactionMessages = messagesBySender.map((message) => message.message);
        // const attachedTablesProperties = this.tableService.extractTablesFromMessages(transactionMessages);

        const transactions = await this.jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(userAccountProperties.address, tag)
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
        console.log('transactions.length');
        console.log(transactions.length);
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')


        const transactionIds = transactions.map(transaction=> transaction.transaction);

        console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
        console.log('transactionIds');
        console.log(transactionIds);
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')


        const [message] = await this.jupiterTransactionsService.readMessagesFromMessageTransactionIdsAndDecrypt(transactionIds,userAccountProperties.crypto, userAccountProperties.passphrase)

    // ] [{"message":{"channels":{"address":"JUP-GBN3-DL5H-GU9G-DB5H5","passphrase":"break felicity knee any distance replace witch twenty pen problem diamond surprise","public_key":"8b4a47a687a7061c540d17030489279721371600e2cf766da6d9b46bc7ad3547"}},"transactionId":"17261131886870606461"}]

        let tableName = null;
        switch(tag){
            case tableConfig.channelsTable: tableName='channels';break;
        }



        const properties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(message.message[tableName].passphrase, message.message[tableName].password);


        return properties;
        // const messagesBySender = await this.jupiterTransactionsService.extractMessagesBySender(userAccountProperties, allBlockChainTransactions);


        // const firstMemberAccountStatement = await this.fetchAccountStatement(userAccountProperties.passphrase, userAccountProperties.password);
        // const  channelStatement = transactions.find(transaction => statement.statementId === 'table-channels');



        // return channelStatement.properties;
    }



}

module.exports.JupiterAccountService = JupiterAccountService;

module.exports.jupiterAccountService = new JupiterAccountService(
    jupiterAPIService,
    metisGravityAccountProperties,
    tableService,
    jupiterTransactionsService
);
