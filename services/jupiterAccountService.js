import gu from '../utils/gravityUtils';
import { userConfig } from '../config/constants';
const { FeeManager, feeManagerSingleton } = require('./FeeManager');
const { GravityAccountProperties, metisGravityAccountProperties } = require('../gravity/gravityAccountProperties');
const _ = require('lodash');
const { jupiterAPIService } = require('./jupiterAPIService');
const { tableService } = require('./tableService');
const { jupiterTransactionsService } = require('./jupiterTransactionsService');
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
                const { subtype } = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}
                this.jupiterAPIService
                    .sendSimpleEncipheredMetisMessage(metisUsersTableProperties, accountProperties, encryptedUserRecord, fee, subtype)
                    .then((response) => {
                        logger.verbose('---------------------------------------------------------------------------------');
                        logger.verbose(
                            `-- addRecordToMetisUsersTable()generateId().then(transactionId= ${transactionId}).sendSimpleEncipheredMetisMessage().then(response)`
                        );
                        logger.verbose('--');
                        return resolve({ data: response.data, transactionsReport: [{ name: 'users-table-record', id: response.data.transaction }] });
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
        const { subtype } = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}

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
    async fetchAccountStatement(passphrase, password, statementId = '', accountType, params = {}) {
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

            const allBlockChainTransactions = await this.jupiterTransactionsService.getAllBlockChainTransactions(accountInfo.address);
            const promises = [];
            promises.push(this.getAccountOrNull(accountInfo.address));
            promises.push(this.getAccountId(passphrase));
            promises.push(
                this.jupiterTransactionsService.getAllMessagesFromBlockChainAndReturnMessageContainers(properties, allBlockChainTransactions)
            );
            promises.push(this.jupiterAPIService.getAliases(accountInfo.address));

            Promise.all(promises)
                .then((results) => {
                    logger.verbose('---------------------------------------------------------------------------');
                    logger.verbose(`-- fetchAccountStatement().promise.all().then()`);
                    logger.verbose('--');

                    const [account, getAccountIdResponse, transactionMessagesContainer, aliases] = results;
                    const transactionMessages = transactionMessagesContainer.map((message) => message.message);
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
                            messages: transactionMessagesContainer,
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
                    logger.error(error);
                    reject(error);
                });
        });
    }

    /**
     * Retrieves all public keys associated to an address
     * @param accountProperties
     * @returns {Promise<unknown>}
     */
    async getPublicKeysByAddress({ address, crypto, passphrase }) {
        try {
            const transactions = await jupiterTransactionsService.getBlockChainTransactionsByTag(address, userConfig.userPublicKeyList);
            const { transaction } = transactions.pop();

            const message = await jupiterTransactionsService.getReadableMessageFromMessageTransactionIdAndDecrypt(transaction, crypto, passphrase);
            const publicKeyIds = await jupiterTransactionsService.readMessagesFromMessageTransactionIdsAndDecryptOrPassThrough(
                message,
                crypto,
                passphrase
            );

            return publicKeyIds.map((pk) => pk.message);
        } catch (error) {
            logger.error(error);
        }
    }

    addPublicKey(publicKey, gravityAccountProperties) {
        return this.hasPublicKey(publicKey, gravityAccountProperties)
            .then((hasPublicKey) => {
                if (hasPublicKey) {
                    throw new Error('Public key already exists');
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
     * @returns {*}
     */
    hasPublicKey(publicKey, gravityAccountProperties) {
        return jupiterTransactionsService
            .getBlockChainTransactionsByTag(gravityAccountProperties.address, userConfig.userPublicKeyList)
            .then((transactions) => {
                const transactionIds = transactions.pop();
                return jupiterTransactionsService.getReadableMessageFromMessageTransactionIdAndDecrypt(
                    transactionIds,
                    gravityAccountProperties.crypto,
                    gravityAccountProperties.passphrase
                );
            })
            .then((message) => {
                if (!Array.isArray(message) || message.length === 0) {
                    return false;
                }

                return jupiterTransactionsService.readMessagesFromMessageTransactionIdsAndDecrypt(
                    message,
                    gravityAccountProperties.crypto,
                    gravityAccountProperties.passphrase
                );
            })
            .then((userPublicKeyArray) => userPublicKeyArray.some((upk) => upk === publicKey));
    }
}

module.exports.JupiterAccountService = JupiterAccountService;

module.exports.jupiterAccountService = new JupiterAccountService(
    jupiterAPIService,
    metisGravityAccountProperties,
    tableService,
    jupiterTransactionsService
);
