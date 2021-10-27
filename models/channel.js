import axios from 'axios';
import events from 'events';
import Model from './_model';
import Methods from '../config/_methods';
import {gravity} from '../config/gravity';
import {FeeManager, feeManagerSingleton} from "../services/FeeManager";
import JupiterFSService from "../services/JimService";
import {FundingManager, fundingManagerSingleton} from "../services/fundingManager";
import {ApplicationAccountProperties} from "../gravity/applicationAccountProperties";
import {JupiterAPIService} from "../services/jupiterAPIService";
import {GravityCrypto} from "../services/gravityCrypto";
import {channelConfig} from "../config/constants";
import {JupiterFundingService} from "../services/jupiterFundingService";
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";

const logger = require('../utils/logger')(module);

class Channel extends Model {
  constructor(data = { id: null }) {
    // Sets model name and table name
    super({
      data,
      model: 'channel',
      table: 'channels',
      belongsTo: 'user',
      model_params: [
        'id', 'passphrase', 'account', 'password', 'name', 'publicKey', 'sender', 'accountId', 'createdBy',
      ],
    });
    this.public_key = data.public_key;

    // Mandatory method to be called after data
    this.record = this.setRecord();


    this.validation_rules = [
      // We list all validation rules as a list of hashes
      {
        validate: this.record.name,
        attribute_name: 'name',
        rules: {
          required: true,
          dataType: 'String',
        },
      },
    ];
  }

  setRecord() {
    // We set default data in this method after calling for the class setRecord method
    const record = super.setRecord(this.data);

    return record;
  }

  loadRecords(accessData) {
    return super.loadRecords(accessData);
  }

  async loadChannelByAddress(account, accessData){
    // @TODO figure out how to get a single channel
    const { records } = await super.loadRecords(accessData);
    if (records && Array.isArray(records)) {
      return records.find(record => record.channel_record.account === account);
    }

    throw new Error('Channel not found');
  }

  import(accessLink) {
    const self = this;
    const eventEmitter = new events.EventEmitter();
    let recordTable;

    return new Promise((resolve, reject) => {
      if (self.verify().errors === true) {
        reject({ false: false, verification_error: true, errors: self.verify().messages });
      } else {
        eventEmitter.on('id_generated', () => {
          const stringifiedRecord = JSON.stringify(self.record);

          const fullRecord = {
            id: self.record.id,
            [`${self.model}_record`]: stringifiedRecord,
            date: Date.now(),
          };

          const encryptedRecord = gravity.encrypt(
            JSON.stringify(fullRecord),
            accessLink.encryptionPassword,
          );
          const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.invitation_to_channel);
          const callUrl = `${gravity.jupiter_data.server}/nxt?requestType=sendMessage&secretPhrase=${recordTable.passphrase}&recipient=${self.user.account}&messageToEncrypt=${encryptedRecord}&feeNQT=${fee}&deadline=${gravity.jupiter_data.deadline}&recipientPublicKey=${self.user.publicKey}&compressMessageToEncrypt=true`;

          axios.post(callUrl)
            .then((response) => {
              if (response.data.broadcasted && response.data.broadcasted === true) {
                resolve({ success: true, message: 'Record created' });
              } else if (response.data.errorDescription != null) {
                reject({ success: false, errors: response.data.errorDescription });
              } else {
                reject({ success: false, errors: 'Unable to save data in blockchain' });
              }
            })
            .catch((error) => {
              reject({ success: false, errors: error });
            });
        });

        eventEmitter.on('request_authenticated', () => {
          self.loadAppTable(accessLink)
            .then((res) => {
              recordTable = res;
              eventEmitter.emit('id_generated');
            })
            .catch((err) => {
              reject({ success: false, errors: err });
            });
        });

        if (accessLink) {
          eventEmitter.emit('request_authenticated');
        } else {
          reject('Missing access link');
        }
      }
    });
  }

  async loadMessages(queryMode, nextIndex = 0, order = 'desc', limit = 10) {
    const numberOfRecords = limit || 10;
    const lastIndex = parseInt(nextIndex, 10) + parseInt(numberOfRecords, 10);
    const query = {
      lastIndex,
      numberOfRecords,
      account: this.record.account,
      recipientRS: this.record.account,
      dataLink: 'message_record',
      encryptionPassword: this.record.password,
      encryptionPassphrase: this.record.passphrase,
      includeUnconfirmed: true,
      multiChannel: true,
      order,
      firstIndex: nextIndex,
    };
    if (queryMode === 'unconfirmed') {
      query.noConfirmed = true;
    }

    const response = await gravity.getDataTransactions(query);

    if (!response.error) {
      return { success: true, messages: response };
    }
    return response;
  }


  async create(accessLink) {
    if (!this.record.passphrase || this.record.password) {
      this.record.passphrase = Methods.generate_passphrase();
      this.record.password = Methods.generate_keywords();
      this.data.passphrase = this.record.passphrase;
      this.data.password = this.record.password;

      const response = await gravity.getAccountInformation(this.record.passphrase);

      this.record.account = response.address;
      this.record.publicKey = response.publicKey;
      this.data.account = response.address;
      this.data.publicKey = response.publicKey;
      logger.sensitive(`response = ${JSON.stringify(response) }`);
    }

    logger.sensitive(`record = ${JSON.stringify(this.record)}`);
    logger.sensitive(`data = ${JSON.stringify(this.data)}`);

    if (accessLink) {
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
      const jupiterFundingService = new JupiterFundingService(jupiterAPIService, applicationGravityAccountProperties);

      return super.create(accessLink)
          .then( ({accountInfo}) =>
              Promise.all([accountInfo, jupiterFundingService.waitForTransactionConfirmation(accountInfo.transaction)]))
          .then(([accountInfo]) => jupiterFundingService.provideInitialStandardTableFunds({ address: accountInfo.account }))
          .then(sendMoneyResponse => jupiterFundingService.waitForTransactionConfirmation(sendMoneyResponse.data.transaction));
    }

    return Promise.reject({ error: true, message: 'Missing user information' });
  }
}

module.exports = Channel;
