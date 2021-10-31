require('dotenv').config();
const _ = require('lodash');
const { gravity } = require('./gravity');
const {feeManagerSingleton, FeeManager} = require("../services/FeeManager");
const {fundingManagerSingleton, FundingManager} = require("../services/fundingManager");
const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {ApplicationAccountProperties} = require("../gravity/applicationAccountProperties");
const {JupiterAPIService} = require("../services/jupiterAPIService");
const {JupiterFundingService} = require("../services/jupiterFundingService");
const {GravityCrypto} = require("../services/gravityCrypto");
const {channelConfig} = require("./constants");
const {hasJsonStructure} = require("../utils/utils");
const {generateChecksum} = require("../utils/gravityUtils");
const logger = require('../utils/logger')(module);

const propertyFee = 10;

// This contains specific helper methods for the Metis app
// They are built using gravity
function Metis() {
  function accountEnding(account) {
    const components = account.split('-');
    if (components.length !== 5) {
      return { error: true, message: 'Invalid account', description: 'metis.js : Error with accountEnding function' };
    }
    return components[components.length - 1];
  }

  // Retrieves list of properties.
  async function getChannelProperties(channel) {
    const propertiesResponse = await gravity.getAccountProperties({
      recipient: channel,
    });

    const { properties } = propertiesResponse;

    if (!properties) {
      return {
        error: true,
        message: propertiesResponse.message || 'Error obtaining properties',
        description: 'Metis.js-13 => getChannelProperties()',
        fullError: propertiesResponse,
      };
    }

    return properties;
  }

  async function getAliasAccountProperties(aliases = []) {
    const profilePictures = aliases.map(async (alias) => {
      const { accountRS } = await gravity.getAlias(alias);
      const { properties } = await gravity.getAccountProperties({ recipient: accountRS });
      const profilePicture = properties ? properties.find(({ property }) => property.includes('profile_picture')) : null;

      return { alias, accountRS , urlProfile: profilePicture ? profilePicture.value : '' };
    });

    return Promise.all(profilePictures);
  }

  // Gets alias information for a single user within a channel
  async function getMember(params) {
    // We retrieve the member list
    if (!params.password) {
      return {
        error: true,
        message: 'Channel encryption has not been provided',
      };
    }
    const properties = await getChannelProperties(params.channel);

    // If error return response
    if (properties.error) {
      return properties;
    }
    const members = [];
    _.filter(properties, (p) => {
      let property;
      try {
        property = gravity.decrypt(p.property, params.password);
      } catch (e) {
        // console.log(e);
      }
      if (property && property.includes('-a-')) {
        members.push(gravity.decrypt(p.value, params.password));
      }
    });

    // We lodash to look properties containing account of user and
    // the -a- string which are part of alias properties
    const membersMatches = _.filter(properties, (p) => {
      let property;
      try {
        property = gravity.decrypt(p.property, params.password);
      } catch (e) {
        // console.log(e);
      }
      if (property) {
        return property.includes(accountEnding(params.account))
          && property.includes('-a-');
      }
      return false;
    });

    const aliases = [];
    // We use lodash to push value of property (alias) to the aliases list
    _.filter(membersMatches, (p) => {
      let value;
      try {
        value = gravity.decrypt(p.value, params.password);
      } catch (e) {
        // console.log(e);
      }
      if (value && !aliases.includes(value)) {
        aliases.push(value);
      }
    });

    const memberProfilePicture = await getAliasAccountProperties(members);
    return { aliases, members, memberProfilePicture };
  }

  function getChannelUsersArray(channelAccount, tag) {
    const TRANSFER_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
    const ACCOUNT_CREATION_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const STANDARD_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const MINIMUM_TABLE_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table);
    const MINIMUM_APP_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user);
    const MONEY_DECIMALS = process.env.JUPITER_MONEY_DECIMALS;
    const DEADLINE = process.env.JUPITER_DEADLINE;

    const appAccountProperties = new ApplicationAccountProperties(
        DEADLINE, STANDARD_FEE, ACCOUNT_CREATION_FEE, TRANSFER_FEE, MINIMUM_TABLE_BALANCE, MINIMUM_APP_BALANCE, MONEY_DECIMALS,
    );
    const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties);
    return jupiterAPIService.getBlockChainTransactions(channelAccount, tag, false)
        .then(({ data: transactions }) => {
          if (transactions && Array.isArray(transactions.transactions)){
            return transactions.transactions.filter(t => t.attachment.message && t.attachment.message === tag);
          }
          return [];
        })
  }

  async function addToMemberList(params) {
    if (!params.alias) {
      return { error: true, message: 'No alias provided' };
    }
    // We verify here is user has any existing aliases
    //@TODO Cannot use Alias!! has to be the jup account!!!
    const memberSearch = await getMember(params);
    // We first retrieve the properties from recipient
    if (memberSearch.error) {
      return memberSearch;
    }

    const { aliases } = memberSearch;
    const { members } = memberSearch;
    for (let x = 0; x < aliases.length; x += 1) {
      aliases[x] = aliases[x].toLowerCase();
    }

    for (let x = 0; x < members.length; x += 1) {
      members[x] = members[x].toLowerCase();
    }
    // We verify if the current alias list contains the alias we wish to add to the member list
    const aliasInList = aliases.includes(params.alias.toLowerCase());
    const aliasInMembers = members.includes(params.alias.toLowerCase());

    if (aliasInList || aliasInMembers) {
      return {
        aliases,
        members,
        error: true,
        aliasExists: true,
        message: 'Alias already in member list',
      };
    }

    if (!params.password) {
      return {
        aliases,
        members,
        error: true,
        message: 'Request is missing table encryption',
      };
    }


    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.metis_channel_member);
    const propertyParams = {
      recipient: params.channel,
      feeNQT: fee,
      property: gravity.encrypt(`${accountEnding(params.account)}-a-${aliases.length}`, params.password),
      value: gravity.encrypt(params.alias, params.password),
    };
    return gravity.setAcountProperty(propertyParams)
        .then((propertyCreation) => {
          if (propertyCreation.errorDescription) {
            logger.error(`Property creation failed: ${JSON.stringify(propertyCreation)}`);
            return propertyCreation;
          }

          return {
            success: true,
            message: `${params.alias} has been added to member list of ${params.channel}`,
            fullResponse: propertyCreation,
          };
        })
        .catch(error => {
          return {
            success: false,
            message: 'Error saving the member',
            fullResponse: error,
          };
        });
  }

  function addMemberToChannel(memberAccessData, userPublicKey, from, to, recipientPublicKey, recipientPassword){
    const applicationGravityAccountProperties = new GravityAccountProperties(
        process.env.APP_ACCOUNT_ADDRESS,
        process.env.APP_ACCOUNT_ID,
        process.env.APP_PUBLIC_KEY,
        process.env.APP_ACCOUNT,
        '', // hash
        process.env.ENCRYPT_PASSWORD,
        process.env.ENCRYPT_ALGORITHM,
        process.env.APP_EMAIL,
        process.env.APP_NAME,
        '', // lastname
    );

    const TRANSFER_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
    const ACCOUNT_CREATION_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const STANDARD_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
    const MINIMUM_TABLE_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table);
    const MINIMUM_APP_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user);
    const MONEY_DECIMALS = process.env.JUPITER_MONEY_DECIMALS;
    const DEADLINE = process.env.JUPITER_DEADLINE;

    const appAccountProperties = new ApplicationAccountProperties(
        DEADLINE, STANDARD_FEE, ACCOUNT_CREATION_FEE, TRANSFER_FEE, MINIMUM_TABLE_BALANCE, MINIMUM_APP_BALANCE, MONEY_DECIMALS,
    );
    applicationGravityAccountProperties.addApplicationAccountProperties(appAccountProperties);


    const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties);
    const channelCrypto = new GravityCrypto(process.env.ENCRYPT_ALGORITHM, recipientPassword);

    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.account_record);
    const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.account_record); //{type:1, subtype:12}
    const jupiterFundingService = new JupiterFundingService(jupiterAPIService, applicationGravityAccountProperties);


    const checksumPublicKey = generateChecksum(userPublicKey);
    const tag = `${channelConfig.channel_users}.${memberAccessData.account}.${checksumPublicKey}`;

    // get transaction tag = v1.metis.channel.public-key.JUP-NEW_USER
    return getChannelUsersArray(to, tag)
        .then(useTransactions => {
          if(useTransactions && useTransactions.length > 0){
            throw new Error('User already set');
          }
          return getChannelUsersArray(to, channelConfig.channel_user_list)
        })
        .then(transactionList => {
          const newUserChannel = { userAddress: memberAccessData.account, userPublicKey, date: Date.now() };
          const encryptedMessage = channelCrypto.encrypt(JSON.stringify(newUserChannel));

          // if the user is not part of the user list, we need to add the user
          const newUserPromise = jupiterAPIService.sendEncipheredMetisMessageAndMessage(
              from,
              to,
              encryptedMessage, // encipher message  [{ userAddress: userData.account, userPublicKey, date: Date.now() }];
              tag, // message: 'v1.metis.channel.public-key.{JupAccount.checksum'
              fee,
              subtype,
              false,
              recipientPublicKey
          );

          if (transactionList && transactionList.length > 0){
            const [channelUserList] = transactionList;
            const channelUserListPromise = jupiterAPIService.getMessage(channelUserList.transaction, from);

            return Promise.all([newUserPromise, channelUserListPromise]);
          }

          return Promise.all([newUserPromise, null]);
        })
        .then(([newUserResponse, channelUserListResponse]) => {
          let newUserChannel = [];

          if (!channelUserListResponse){
            newUserChannel = [newUserResponse.data.transaction];
          } else {
            const jupiterDecryptedMessage = channelUserListResponse.data.decryptedMessage;
            const metisDecryptedMessage = channelCrypto.decryptOrNull(jupiterDecryptedMessage);
            if(metisDecryptedMessage && hasJsonStructure(metisDecryptedMessage)){
              const channelListObject = JSON.parse(metisDecryptedMessage);// encipher message  [{ userAddress: userData.account, userPublicKey, date: Date.now() }];
              newUserChannel.push(...channelListObject, newUserResponse.data.transaction);
            } else {
              newUserChannel = [newUserResponse.data.transaction];
            }
          }

          const encryptedMessage = channelCrypto.encrypt(JSON.stringify(newUserChannel));

          return jupiterAPIService.sendEncipheredMetisMessageAndMessage(
              from,
              to,
              encryptedMessage, // encipher message  [t1,t2,t3,t4,tn];
              channelConfig.channel_user_list, // message: 'v1.metis.channel.public-key.list'
              fee,
              subtype,
              false,
              recipientPublicKey
          );

        })
        .then(response => {
          return jupiterFundingService.waitForTransactionConfirmation(response.data.transaction)
        });
  }

  return Object.freeze({
    getChannelProperties,
    getMember,
    addToMemberList,
    addMemberToChannel,
    getChannelUsersArray,
  });
}

module.exports = Metis();
