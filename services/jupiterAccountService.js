import gu from '../utils/gravityUtils';
import {channelConfig, userConfig} from '../config/constants';
import {
    instantiateGravityAccountProperties,
    refreshGravityAccountProperties
} from "../gravity/instantiateGravityAccountProperties";
import {gravityService} from "./gravityService";
import {transactionUtils} from "../gravity/transactionUtils";
import {BadGravityAccountPropertiesError, BadJupiterAddressError, UnknownAliasError} from "../errors/metisError";
const {FeeManager, feeManagerSingleton} = require('./FeeManager');

// metisGravityAccountProperties

const {GravityAccountProperties, metisGravityAccountProperties, myTest} = require('../gravity/gravityAccountProperties');
const {jupiterAPIService} = require('./jupiterAPIService');
const {tableService} = require('./tableService');
const {jupiterTransactionsService} = require('./jupiterTransactionsService');
const logger = require('../utils/logger')(module);
const bcrypt = require('bcrypt-nodejs');

class JupiterAccountService {
    constructor(jupiterAPIService, applicationProperties, tableService, jupiterTransactionsService, gravityService, transactionUtils) {
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
        this.gravityService = gravityService;
        this.transactionUtils = transactionUtils;
    }

    /**
     *
     * @param accountProperties
     * @param metisUsersTableProperties
     * @return {Promise<{data: *, transactionsReport: [{name: string, id: *}]}>}
     */
    addRecordToMetisUsersTable(accountProperties, metisUsersTableProperties) {
        logger.verbose('###########################################################################');
        logger.verbose('## addRecordToMetisUsersTable(accountProperties, metisUsersTableProperties)');
        logger.verbose('##');
        if(!accountProperties instanceof GravityAccountProperties){throw new Error('accountProperties is not valid')}
        if(!metisUsersTableProperties instanceof GravityAccountProperties){throw new Error('metisUsersTableProperties is not valid')}
        logger.verbose(`  accountProperties.address= ${accountProperties.address}`);
        logger.verbose(`  metisUsersTableProperties.address= ${metisUsersTableProperties.address}`);

        return this.generateId(accountProperties, metisUsersTableProperties)
            .then(async (transactionId) => {
                logger.verbose('---------------------------------------------------------------------------------');
                logger.verbose(`--- addRecordToMetisUsersTable()generateId().then(transactionId= ${transactionId})`);
                logger.verbose('--');
                const tag = `${userConfig.metisUserRecord}.${accountProperties.address}`;
                const userRecord = accountProperties.generateUserRecord(transactionId);
                const encryptedUserRecord = metisUsersTableProperties.crypto.encryptJson(userRecord);
                if (accountProperties.isMinimumProperties) {
                    await refreshGravityAccountProperties(accountProperties);
                }
                return this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
                    metisUsersTableProperties.passphrase,
                    accountProperties.address,
                    encryptedUserRecord,
                    tag,
                    FeeManager.feeTypes.account_record,
                    accountProperties.publicKey
                )
                    .then(response => {
                        return {
                            data: response.data,
                            transactionsReport: [{name: 'users-table-record', id: response.data.transaction}]
                        }
                    })
            });
    }

    /**
     *
     * @param userAccountProperties
     * @return {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async addUserRecordToUserAccount(userAccountProperties) {
        const tag = `${userConfig.userRecord}.${userAccountProperties.address}`;
        const createdDate = Date.now();
        const userRecord = {
            recordType: 'userRecord',
            password: userAccountProperties.password,
            email: userAccountProperties.email,
            firstName: userAccountProperties.firstName,
            lastName: userAccountProperties.lastName,
            status: 'active',
            createdAt: createdDate,
            updatedAt: createdDate,
            version: 1
        };
        const encryptedUserRecord = userAccountProperties.crypto.encryptJson(userRecord);

        if (userAccountProperties.isMinimumProperties) {
            await refreshGravityAccountProperties(userAccountProperties);
        }
        return this.jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
            userAccountProperties.passphrase,
            userAccountProperties.address,
            encryptedUserRecord,
            tag,
            FeeManager.feeTypes.account_record,
            userAccountProperties.publicKey
        ).then(response => {
            return response.data.transactionJSON;
        })
    }

    /**
     *
     * @param accountProperties
     * @param metisUsersTableProperties
     * @returns {Promise<unknown>}
     */
    async generateId(accountProperties, metisUsersTableProperties) {
        logger.verbose('### generateId()');
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

    /**
     *
     * @param address
     * @returns {Promise<{unconfirmedBalanceNQT,accountRS,forgedBalanceNQT,balanceNQT,publicKey, requestProcessingTime, account}>}
     */
    async getAccountOrNull(address) {
        return this.jupiterAPIService
            .getAccount(address)
            .then((response) => {
                return response.data;
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
            return response.data;
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
     * @returns {Promise<{GravityAccountProperties, balance, records,  attachedTables: []}>}
     */
    async fetchAccountStatement(passphrase, password, statementId = '', accountType = '', params = {}) {
        logger.verbose(`#### fetchAccountStatement(passphrase, password, statementId=${statementId}, accountType=${accountType})`);
        if (!gu.isWellFormedPassphrase(passphrase)) {throw new Error('problem with passphrase')}
        if(!gu.isNonEmptyString(password)){throw new Error('password is not valid')}
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        logger.sensitive(`passphrase=${passphrase}`);
        logger.sensitive(`password=${JSON.stringify(password)}`);
        logger.sensitive(`statementId=${JSON.stringify(statementId)}`);
        logger.sensitive(`accountType=${JSON.stringify(accountType)}`);
        logger.sensitive(`params=${JSON.stringify(params)}`);
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');

        try {
            const accountProperties = await instantiateGravityAccountProperties(passphrase, password);
            logger.sensitive(`address= ${accountProperties.address}`);
            const allBlockChainTransactions = await this.jupiterTransactionsService.getAllConfirmedAndUnconfirmedBlockChainTransactions(accountProperties.address);
            logger.sensitive(`allBlockChainTransactions.length= ${allBlockChainTransactions.length}`);
            const promises = [];
            promises.push(this.getAccountOrNull(accountProperties.address));
            promises.push(this.jupiterTransactionsService.messageService.extractMessagesBySender(accountProperties, allBlockChainTransactions));
            const [account, _transactionMessages] = await Promise.all(promises);
            const transactionMessages = _transactionMessages.map((message) => message.message);
            logger.sensitive(`transactionMessages.length= ${transactionMessages.length}`);
            let accountBalance = null;
            let accountUnconfirmedBalance = null;
            if (account && account.data) {
                accountProperties.accountId = account.data.account;
                accountBalance = account.data.balanceNQT;
                accountUnconfirmedBalance = account.data.unconfirmedBalanceNQT;
            }
            const records = this.tableService.extractRecordsFromMessages(transactionMessages);
            logger.sensitive(`records.length= ${records.length}`);
            const attachedTablesProperties = this.tableService.extractTablesFromMessages(transactionMessages);
            logger.sensitive(`attachedTablesProperties.length= ${attachedTablesProperties.length}`);
            const attachedTablesStatementsPromises = [];
            for (let i = 0; i < attachedTablesProperties.length; i++) {
                const tableAccountProperties = attachedTablesProperties[i];
                // console.log(tableAccountProperties);
                attachedTablesStatementsPromises.push(
                    this.fetchAccountStatement(tableAccountProperties.passphrase, password, `table-${tableAccountProperties.name}`, 'table', {
                        tableName: tableAccountProperties.name,
                    })
                );
            }
            const attachedTablesStatements = await Promise.all(attachedTablesStatementsPromises);
            logger.debug(`statementId= ${statementId}`);
            logger.debug(`attachedTables.length= ${attachedTablesStatements.length}`);

            const statement = {
                statementId: statementId,
                properties: accountProperties,
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
            return statement;
        }catch (error){
                logger.sensitive('*****************************ERROR**************************************');
                logger.sensitive(`** fetchAccountStatement( passphrase, password, statementId = '', accountType, params = {})`);
                logger.sensitive(`** passphrase= ${passphrase} `);
                logger.sensitive(`** password= ${password} `);
                logger.sensitive(`** statementId= ${statementId} `);
                throw(error);
        }
    }

    /**
     *
     * @param accountProperties
     * @return {Promise<{allRecords: *, accountProperties, allMessages: *, attachedTables: *[]}>}
     */
    async fetchAccountData(accountProperties) {
        logger.verbose(`#### fetchAccountData(accountProperties): accountProperties.address=${accountProperties.address}`);
        const transactionMessagesContainers = await this.jupiterTransactionsService.fetchAllMessagesBySender(accountProperties);
        const transactionMessages = transactionMessagesContainers.map((messageContainer) => messageContainer.message);
        const attachedTables = this.tableService.extractTablesFromMessages(transactionMessages);
        logger.sensitive(`attachedTables= ${JSON.stringify(attachedTables)}`);
        const records = this.tableService.extractRecordsFromMessages(transactionMessages);
        const accountInformationResponse = await this.fetchAccountInfo(accountProperties.passphrase);
        accountProperties.publicKey = accountInformationResponse.publicKey;
        return {
            attachedTables: attachedTables,
            allMessages: transactionMessagesContainers,
            allRecords: records,
            accountProperties: accountProperties,
        };
    }

    /**
     * Retrieves all public keys associated to an address
     * @param {GravityAccountProperties} accountProperties
     * @returns {Promise<unknown>}
     */
    async getPublicKeysFromUserAccount(accountProperties) {
        logger.verbose(`#### getPublicKeysFromUserAccount(accountProperties)`);
        // logger.sensitive(`accountProperties= ${JSON.stringify(accountProperties)}`);
        if(!(accountProperties instanceof GravityAccountProperties)){throw new Error('invalid accountProperties')}
        try {
            return  await this.gravityService.getLatestListByTag(accountProperties, userConfig.userPublicKeyList);
        } catch (error) {
            error.message = `getPublicKeysFromUserAccount: ${error.message}`;
            logger.error(`${error}`);
            throw error;
        }
    }

    async getPublicKeysFromChannelAccount(accountProperties) {
        try {
            const transactions = await jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(accountProperties.address, channelConfig.channelMemberPublicKeyList);
            const [latestTransaction] = transactions;

            if(!latestTransaction){
                return [];
            }

            const message = await jupiterTransactionsService.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
                latestTransaction.transaction,
                accountProperties.crypto,
                accountProperties.passphrase
            );

            if(!gu.isWellFormedJupiterTransactionId(message.message)){throw new Error('transactionId invalid')};
            const publicKeyIds = await jupiterTransactionsService.messageService.readMessagesFromMessageTransactionIdsAndDecryptOrPassThroughAndReturnMessageContainers(
                message.message,
                accountProperties.crypto,
                accountProperties.passphrase
            );

            return publicKeyIds.map((pk) => pk.message);
        } catch (error) {
            logger.error('######### getPublicKeysFromChannelAccount ########')
            logger.error(`${error}`);
        }
    }



    // async updateAllMemberChannelsWithNewPublicKey(memberProperties, publicKey) {
    //     try {
    //         const memberChannels = await this.getMemberChannels(memberProperties);
    //
    //         memberChannels.map(async ({passphrase, password}) => {
    //             const properties = await instantiateGravityAccountProperties(passphrase, password);
    //             await this.addPublicKeyToChannelOrNull(publicKey, memberProperties.address, properties);
    //         });
    //
    //     } catch (error) {
    //         logger.error(`ERROR: [updateAllMemberChannelsWithNewPublicKey]: ${JSON.stringify(error)}`);
    //         throw error;
    //     }
    // }



    /**
     *
     * @param {GravityAccountProperties} gravityAccountProperties
     * @param {string} tag
     */
    async getPublicKeyTransactionsList(gravityAccountProperties, tag) {
        try {
            const [latestList] = await jupiterTransactionsService.getBlockChainTransactionsByTag(gravityAccountProperties.address, tag);
            return await jupiterTransactionsService.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
                latestList.transaction,
                gravityAccountProperties.crypto,
                gravityAccountProperties.passphrase
            );
        } catch (error) {
            logger.error(`ERROR: [getPublicKeyTransactionsList]: ${JSON.parse(error)}`);
            throw error;
        }
    }


    // async addPublicKeyToChannelOrNull(userPublicKey, userAddress, channelAccountProperties){
    //     try {
    //         return this.addPublicKeyToChannel(userPublicKey, userAddress, channelAccountProperties);
    //     } catch (error){
    //         logger.error(`ERROR: [addPublicKeyToChannelOrNull]: ${JSON.stringify(error)}`);
    //         return null;
    //     }
    // }

    // /**
    //  *
    //  * @param userPublicKey
    //  * @param userAddress
    //  * @param {GravityAccountProperties} channelAccountProperties
    //  */
    // async addPublicKeyToChannel(userPublicKey, userAddress, channelAccountProperties) {
    //     logger.sensitive(`#### addPublicKeyToChannel(userPublicKey, userAddress, channelAccountProperties)`);
    //     try {
    //         if(channelAccountProperties.isMinimumProperties){
    //             await refreshGravityAccountProperties(channelAccountProperties);
    //         }
    //         const hasPublicKey = await this.hasPublicKeyInChannelAccount(userPublicKey, channelAccountProperties)
    //         if (hasPublicKey) {
    //             // TODO create an error business handler
    //             const error = new Error();
    //             error.code = 'PUBLIC-KEY_EXIST';
    //             error.message = 'Public key already exists';
    //             throw error;
    //         }
    //         const newUserChannel = {
    //             userAddress,
    //             userPublicKey,
    //             date: Date.now()
    //         };
    //         logger.sensitive(`newUserChannel=${JSON.stringify(newUserChannel)}`);
    //         const encryptedMessage = channelAccountProperties.crypto.encrypt(JSON.stringify(newUserChannel));
    //         const checksumPublicKey = gu.generateChecksum(userPublicKey);
    //         const channelUserTag = `${channelConfig.channelMemberPublicKey}.${userAddress}.${checksumPublicKey}`;
    //         const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record);
    //         const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}
    //         if (channelAccountProperties.isMinimumProperties) {
    //             await refreshGravityAccountProperties(channelAccountProperties);
    //         }
    //         const newUserTransactionResponse = await jupiterAPIService.sendEncipheredMetisMessageAndMessage(
    //             channelAccountProperties.passphrase,
    //             channelAccountProperties.address,
    //             encryptedMessage, // encipher message  [{ userAddress: userData.account, userPublicKey, date: Date.now() }];
    //             channelUserTag, // message: 'v1.metis.channel.public-key.JupAccount.checksum'
    //             fee,
    //             subtype,
    //             false,
    //             channelAccountProperties.publicKey
    //         );
    //         const latestPublicKeyTransactionsList = await this.getPublicKeyTransactionsList(channelAccountProperties, channelConfig.channelMemberPublicKeyList);
    //         latestPublicKeyTransactionsList.push(newUserTransactionResponse.transaction);
    //         const encryptedPublicKeyTransactionList = channelAccountProperties.crypto.encryptJson(latestPublicKeyTransactionsList);
    //         const publicKeyList = await jupiterAPIService.sendEncipheredMetisMessageAndMessage(
    //             channelAccountProperties.passphrase,
    //             channelAccountProperties.address,
    //             encryptedPublicKeyTransactionList,
    //             channelConfig.channelMemberPublicKeyList,
    //             fee,
    //             subtype,
    //             false,
    //             channelAccountProperties.publicKey
    //         );
    //     } catch (error) {
    //         logger.error(`**** functionName.catch(error)`);
    //         logger.error(`** - error= ${error}`)
    //         throw error;
    //     }
    // }

    /**
     *
     * @param {string} publicKey
     * @param {GravityAccountProperties} gravityAccountProperties
     * @returns {*}
     */
    addPublicKeyToUserAccount(publicKey, gravityAccountProperties) {
        return this.hasPublicKeyInUserAccount(publicKey, gravityAccountProperties)
            .then(async hasPublicKey => {
                if (hasPublicKey) {
                    // TODO create an error business handler
                    const error = new Error();
                    error.code = 'PUBLIC-KEY_EXIST';
                    error.message = 'Public key already exists';
                    throw error;
                }

                const encryptedMessage = gravityAccountProperties.crypto.encrypt(publicKey);
                if (gravityAccountProperties.isMinimumProperties) {
                    await refreshGravityAccountProperties(gravityAccountProperties);
                }
                const userPublicKeyPromise = jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
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
            .then(([_, userPublicKeyList]) => {
                const [latestPublicKeyList] = userPublicKeyList;

                if(!latestPublicKeyList){
                    return {message: []};
                }

                return jupiterTransactionsService.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
                    latestPublicKeyList.transaction,
                    gravityAccountProperties.crypto,
                    gravityAccountProperties.passphrase
                );
            })
            .then((userPublicKeyList) => {
                userPublicKeyList.message.push(publicKey);
                const encryptedMessage = gravityAccountProperties.crypto.encryptJson(userPublicKeyList.message);
                return jupiterTransactionsService.messageService.sendTaggedAndEncipheredMetisMessage(
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
                return transactionId ? jupiterTransactionsService.messageService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
                    transactionId.transaction,
                    gravityAccountProperties.crypto,
                    gravityAccountProperties.passphrase
                ) : [];
            })
            .then((publicKeyTransactionIds) => {
                if (!Array.isArray(publicKeyTransactionIds) || publicKeyTransactionIds.length === 0) {
                    return [];
                }


                logger.error('might need to do a map')
                throw new Error('might need to do a map')



                return jupiterTransactionsService.messageService.readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(
                    publicKeyTransactionIds,
                    gravityAccountProperties.crypto,
                    gravityAccountProperties.passphrase
                );
            });
    }



    hasPublicKeyInUserAccount(publicKey, gravityAccountProperties) {
        return this.publicKeyMessages(publicKey, gravityAccountProperties, userConfig.userPublicKeyList)
            .then((userPublicKeyArray) => userPublicKeyArray.some((upk) => upk === publicKey));
    }

    // /**
    //  *  @description OBSOLETE!!!!
    //  * @param channelAddress
    //  * @param memberAccountProperties
    //  */
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
    //
    // /**
    //  *
    //  * @param channelAccountProperties
    //  * @returns {Promise<[*]>}
    //  */
    // getChannelMembers(channelAccountProperties){
    //     logger.verbose(`#### getChannelMembers(channelAccountProperties) )`);
    //     if(!(channelAccountProperties instanceof GravityAccountProperties )){ throw new Error('channelAccountProperties is invalid')}
    //     logger.debug(`channelAccountProperties.address= ${channelAccountProperties.address}`);
    //     const listTag = channelConfig.channelMemberList;
    //     return jupiterTransactionsService.dereferenceListAndGetReadableTaggedMessageContainers(channelAccountProperties, listTag)
    //         .then( messageContainers  => {
    //             console.log(`\n\n\n`);
    //             console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    //             console.log('messageContainers');
    //             console.log(messageContainers);
    //             console.log(`=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n\n\n`)
    //             return messageContainers.map(messageContainer => messageContainer.message);
    //         })
    // }


//     const [latestList] = await jupiterTransactionsService.getBlockChainTransactionsByTag(gravityAccountProperties.address, tag);
//     return await jupiterTransactionsService.getReadableMessageContainerFromMessageTransactionIdAndDecrypt(
//         latestList.transaction,
//     gravityAccountProperties.crypto,
//     gravityAccountProperties.passphrase
// );



    // async getTableAccountProperties( tag, userAccountProperties){ //tableConfig.channelsTable
    //     logger.verbose(`###################################################################################`);
    //     logger.verbose(`## getTableAccountProperties( tag, userAccountProperties)`);
    //     logger.verbose(`## `);
    //     logger.sensitive(`tag=${JSON.stringify(tag)}`);
    //
    //     // const allBlockChainTransactions = await this.jupiterTransactionsService.getAllConfirmedAndUnconfirmedBlockChainTransactions(userAccountProperties.address);
    //     // const messagesBySender = await this.jupiterTransactionsService.extractMessagesBySender(userAccountProperties, allBlockChainTransactions);
    //     // const transactionMessages = messagesBySender.map((message) => message.message);
    //     // const attachedTablesProperties = this.tableService.extractTablesFromMessages(transactionMessages);
    //
    //     const transactions = await this.jupiterTransactionsService.getConfirmedAndUnconfirmedBlockChainTransactionsByTag(userAccountProperties.address, tag)
    //     console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    //     console.log('transactions.length');
    //     console.log(transactions.length);
    //     console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    //
    //     if(transactions.length === 0){ throw new Error('No Transactions/ValidMessages Found')}
    //
    //     const transactionIds = transactions.map(transaction=> transaction.transaction);
    //
    //     console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    //     console.log('transactionIds');
    //     console.log(transactionIds);
    //     console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    //
    //
    //     //[{"message":{"channels":{"address":"JUP-GBN3-DL5H-GU9G-DB5H5","passphrase":"break felicity knee any distance replace witch twenty pen problem diamond surprise","public_key":"8b4a47a687a7061c540d17030489279721371600e2cf766da6d9b46bc7ad3547"}},"transactionId":"17261131886870606461"}]
    //     const [message] = await this.jupiterTransactionsService.readMessagesFromMessageTransactionIdsAndDecryptAndReturnMessageContainer(transactionIds,userAccountProperties.crypto, userAccountProperties.passphrase)
    //     if(!message){ throw new Error('No Transactions/ValidMessages Found')}
    //
    //     let tableName = null;
    //     switch(tag){
    //         case tableConfig.channelsTable: tableName='channels';break;
    //     }
    //
    //
    //
    //     const properties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(message.message[tableName].passphrase, message.message[tableName].password);
    //
    //
    //     return properties;
    //     // const messagesBySender = await this.jupiterTransactionsService.extractMessagesBySender(userAccountProperties, allBlockChainTransactions);
    //
    //
    //     // const firstMemberAccountStatement = await this.fetchAccountStatement(userAccountProperties.passphrase, userAccountProperties.password);
    //     // const  channelStatement = transactions.find(transaction => statement.statementId === 'table-channels');
    //
    //
    //
    //     // return channelStatement.properties;
    // }

    // /**
    //  * example: {address, accountId, publicKey, passphrase}
    //  * @param passphrase
    //  * @returns {Promise<{address, accountId, publicKey, passphrase}>}
    //  */
    // getAccountIdOrNewAccount(passphrase) {
    //     logger.verbose(`###################################################################################`);
    //     logger.verbose(`## getAccountIdOrNewAccount(passphrase)`);
    //     logger.verbose(`## `);
    //     logger.sensitive(`passphrase=${JSON.stringify(passphrase)}`);
    //     if(!gu.isWellFormedPassphrase(passphrase)){throw new Error(`Jupiter passphrase is not valid: ${passphrase}`)}
    //
    //     return jupiterAPIService.getAccountId(passphrase)
    //         .then(accountIdResponse => {
    //
    //             if( !(accountIdResponse.data.hasOwnProperty('accountRS') &&  gu.isWellFormedJupiterAddress(accountIdResponse.data.accountRS))){
    //                 throw new Error('theres a problem with getAccountId.accountRS')
    //             }
    //
    //             if( !(accountIdResponse.data.hasOwnProperty('account') &&  gu.isWellFormedJupiterTransactionId(accountIdResponse.data.account))){
    //                 throw new Error('theres a problem with getAccountId.account')
    //             }
    //
    //             if( !(accountIdResponse.data.hasOwnProperty('publicKey') &&  gu.isWellFormedPublicKey(accountIdResponse.data.publicKey))){
    //                 throw new Error('theres a problem with getAccountId.publicKey')
    //             }
    //
    //
    //             console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    //             console.log('accountIdResponse.data');
    //             console.log(accountIdResponse.data);
    //             console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    //
    //
    //             const accountInformation =  {
    //                 address: accountIdResponse.data.accountRS,
    //                 accountId: accountIdResponse.data.account,
    //                 publicKey: accountIdResponse.data.publicKey,
    //                 passphrase: passphrase
    //             }
    //             logger.sensitive(`accountInformation= ${JSON.stringify(accountInformation)}`);
    //
    //             return accountInformation
    //         })
    //         .catch( error => {
    //             logger.error(`***********************************************************************************`);
    //             logger.error(`** getAccountIdOrNewAccount().getAccountId()catch(error)`);
    //             logger.error(`** `);
    //             console.log(error);
    //             throw error;
    //         })
    // }

    /**
     *
     * @param {string} passphrase
     * @returns {Promise<{address,accountId,publicKey,passphrase}>}
     */
    async fetchAccountInfo(passphrase) {
        logger.verbose(`#### fetchAccountInfo(passphrase)`);
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is not valid')}

        return this.jupiterAPIService.getAccountId(passphrase)
            .then(response => {
                return {
                            address: response.data.accountRS,
                            accountId: response.data.account,
                            publicKey: response.data.publicKey,
                            passphrase: passphrase
                        }
            })
            .catch( error => {
                logger.error(`********************************************`)
                logger.error('** fetchAccountInfo().getAccountId(passphrase).catch(error)')
                logger.error('**')
                logger.error(`${error}`);
                throw error
            })
    };

    /**
     * @todo this is a duplciate of fetchAccountInfo!
     * @param passphrase
     * @returns {Promise<{accountId: *, address: *, passphrase: *, publicKey: *}>}
     */
    // getAccountInformation(passphrase) {
    //     logger.verbose(`###################################################################################`);
    //     logger.verbose(`## getAccountInformation(passphrase)`);
    //     logger.verbose(`## `);
    //     logger.sensitive(`passphrase=${JSON.stringify(passphrase)}`);
    //     if(!gu.isWellFormedPassphrase(passphrase)){throw new Error(`Jupiter passphrase is not valid: ${passphrase}`)}
    //
    //     return jupiterAPIService.getAccountId(passphrase)
    //         .then(accountIdResponse => {
    //             if (!accountIdResponse) {
    //                 throw new Error('theres a problem with getAccountId')
    //             }
    //
    //             return {
    //                 address: accountIdResponse.accountRS,
    //                 accountId: accountIdResponse.account,
    //                 publicKey: accountIdResponse.publicKey,
    //                 passphrase: passphrase
    //             }
    //         })
    // }


    /**
     * @todo this looks wrong! Please refactor and test.
     *
     * @param passphrase
     * @returns {passphrase, unconfirmedBalanceNqt, accountId, address, forgedBalanceNqt, publicKey, balanceNqt}
     */
    // getAccountInformationUsingPassphrase(passphrase){
    //     logger.verbose(`###################################################################################`);
    //     logger.verbose(`## getAccountInformationUsingPassphrase(passphrase)`);
    //     logger.verbose(`## `);
    //     if(!gu.isWellFormedPassphrase(passphrase)){throw new Error(`Jupiter passphrase is not valid: ${passphrase}`)}
    //     return this.getAccountIdOrNewAccount(passphrase)
    //         .then(account => {
    //             console.log('** $$ ** $$ ** $$');
    //             return this.getAccountInformation(account.address);
    //         })
    //         .then(accountInfo => {
    //             const accountInformationUsingPassphrase = {
    //                 ...accountInfo,
    //                 passphrase
    //             }
    //             logger.sensitive(JSON.stringify(accountInformationUsingPassphrase));
    //             return accountInformationUsingPassphrase;
    //         })
    // }

    /**
     *
     * @param address
     * @returns {Promise<{aliasURI, aliasName, accountRS, alias, account, timestamp}[] | *[]>}
     */
    getAliasesOrEmptyArray(address){
        logger.sensitive(`##### getAliasesOrEmptyArray(address= ${address})`);
        if(!gu.isWellFormedJupiterAddress(address)){throw new BadJupiterAddressError(address)}
        // if(!gu.isWellFormedJupiterAddress(address)){throw new Error(`Jupiter Address is not valid: ${address}`)}

        return this.jupiterAPIService.getAliases(address)
            .then(getAliasesResponse => {
                logger.verbose(`---- getAliasesOrEmptyArray(address).jupiterAPI().getAliases().then()`);
                logger.debug(`address= ${address}`);
                if(getAliasesResponse.hasOwnProperty('data') && getAliasesResponse.data.hasOwnProperty('aliases')){
                    logger.debug(`aliases= ${getAliasesResponse.data.aliases}`);
                    return getAliasesResponse.data.aliases;
                }
                return [];
            })
            .catch( error => {
                if(error.message === 'Unknown account'){
                    logger.warn('This account has no aliases');
                    return [];
                }

                logger.error(`***********************************************************************************`);
                logger.error(`*** getAliasesOrEmptyArray(address=${address}).catch(error)`);
                logger.error(`***********************************************************************************`);
                // console.log(error);
                logger.error(`${error}`);
                throw error;
                // return [];
            })
    }

    /**
     *
     * @param aliasName
     * @returns {Promise<boolean>}
     */
    isAliasAvailable(aliasName){
        logger.verbose(`#### isAliasAvailable(aliasName=${aliasName})`);
        return this.jupiterAPIService.getAlias(aliasName)
            .then(response => {
                logger.verbose(`---- isAliasAvailable(aliasName=${aliasName}).then() : false`)
                return false;
            })
            .catch( error => {
                if(error.name === "UnknownAliasError"){
                    return true;
                }

                logger.error(`***********************************************************************************`);
                logger.error(`** isAliasAvailable(aliasName).catch(error)`);
                logger.error(`** `);
                logger.sensitive(`error=${error}`);

                console.log(error);
                throw error;
            })
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


    /**
     *
     * @param {string} memberPassphrase
     * @param {strin=} memberPassword
     * @return {Promise<null|GravityAccountProperties>}
     */
    async getMemberAccountPropertiesFromPersistedUserRecordOrNull(memberPassphrase, memberPassword) {
        const memberAccountProperties =  await instantiateGravityAccountProperties(memberPassphrase, memberPassword);
        const messageContainers = await jupiterTransactionsService.getReadableTaggedMessageContainers(
            memberAccountProperties,
            `${userConfig.userRecord}.${memberAccountProperties.address}`
        );
        if(messageContainers.length === 0){ return null }
        const messageContainer = messageContainers[0] //{recordType, password, email, firstName, lastName, status, createdAt, updatedAt, version}
        memberAccountProperties.email = messageContainer.message.email;
        memberAccountProperties.firstName = messageContainer.message.firstName;
        memberAccountProperties.lastName = messageContainer.message.lastName;
        memberAccountProperties.status = messageContainer.message.status;
        memberAccountProperties.createdAt = messageContainer.message.createdAt;
        memberAccountProperties.updatedAt = messageContainer.message.updatedAt;

        return memberAccountProperties //get latest userRecord version
    }

    // getStatement(address, moneyDecimals, minimumAppBalance, minimumTableBalance, isApp = false) {
    //     logger.verbose('getStatement()');
    //
    //     return new Promise((resolve, reject) => {
    //         this.jupiterAPIService.getBalance(address)
    //             .then(response => {
    //
    //                 logger.info(`Balance: ${(parseFloat(response.data.balanceNQT) / (10 ** moneyDecimals))} JUP.`);
    //
    //
    //                 let accountStatement = {};
    //
    //                 if (isApp) {
    //                     accountStatement.hasMinimumAppBalance = response.data.balanceNQT >= minimumAppBalance;
    //                     accountStatement.hasMinimumTableBalance = response.data.balanceNQT >= minimumTableBalance;
    //                 }
    //
    //                 accountStatement.balanceNQT = response.data.balanceNQT;
    //
    //
    //                 return resolve(accountStatement);
    //             })
    //             .catch(error => {
    //                 logger.error(`${error}`);
    //                 reject(error);
    //             })
    //
    //     })
    //
    // }

}

module.exports.JupiterAccountService = JupiterAccountService;

module.exports.jupiterAccountService = new JupiterAccountService(
    jupiterAPIService,
    metisGravityAccountProperties,
    tableService,
    jupiterTransactionsService,
    gravityService,
    transactionUtils
);
