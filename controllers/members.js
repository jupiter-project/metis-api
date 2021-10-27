import metis from '../config/metis';
import {FeeManager, feeManagerSingleton} from "../services/FeeManager";
import {FundingManager, fundingManagerSingleton} from "../services/fundingManager";
import {ApplicationAccountProperties} from "../gravity/applicationAccountProperties";
import {JupiterAPIService} from "../services/jupiterAPIService";
import {JupiterTransactionsService} from "../services/jupiterTransactionsService";
import {channelConfig} from "../config/constants";
import {gravity} from "../config/gravity";
import {GravityCrypto} from "../services/gravityCrypto";
const logger = require('../utils/logger')(module);

module.exports = (app) => {
  app.get('/v1/api/data/members', async (req, res) => {
    const { channel_record: { account, password, passphrase }} = req.channel;

    const tableData = { account, password, passphrase };
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
    const tag = channelConfig.channel_users;
    const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties);
    const channelCrypto = new GravityCrypto(process.env.ENCRYPT_ALGORITHM, password);

    metis.getChannelUsersArray(tableData.account, tag)
        .then(async (channelUsers) => {
          let channelUserList = [];
          if (channelUsers && channelUsers.length > 0){
            const [ lastTransaction ] = channelUsers;
            const jupiterTransactionsService = new JupiterTransactionsService(jupiterAPIService);
            const decryptedTransactionMessages =
                await jupiterTransactionsService.getReadableMessageFromMessageTransactionId(
                    lastTransaction.transaction,
                    tableData.passphrase
                );
            channelUserList = JSON.parse(channelCrypto.decrypt(decryptedTransactionMessages));
          }

          const memberList = await metis.getMember({
            channel: tableData.account,
            account: req.user.account,
            password: tableData.password
          });

          return { ...memberList, channelUserList };
        })
        .then(memberList => res.send(memberList))
        .catch(error => res.status(500).send({success: false, error}))
  });


  //@TODO this endpoint has to be removed! Metis is responsible for adding users to channels. Not the user.
  app.post('/v1/api/data/members', async (req, res) => {
    const { userData, accountData } = req.user;
    const { userPublicKey } = req.body;
    const { channel_record: {
      account : channelAccount,
      passphrase: channelPassphrase,
      publicKey: channelPublicKey,
      password: channelPassword }} = req.channel;


    let response = null;
    const memberAccessData = JSON.parse(gravity.decrypt(accountData));
    const params = {
      channel: channelAccount,
      password: channelPassword,
      account: userData.account,
      alias: userData.alias,
    };

    try {
      await metis.addMemberToChannel(
          memberAccessData,
          userPublicKey,
          channelPassphrase,  // from
          channelAccount, // to
          channelPublicKey,
          channelPassword
      );
      // Adds the user to the channel properties
      response = await metis.addToMemberList(params); //TODO remove this
      res.send(response);
    } catch (error) {
      logger.error(error);
      res.status(500).send(response);
    }

  });
};
