import Model from './_model';
import { gravity } from '../config/gravity';
import {FeeManager, feeManagerSingleton} from "../services/FeeManager";
import {jupiterAPIService} from "../services/jupiterAPIService";
import {applicationAccountProperties} from "../gravity/applicationAccountProperties";
import {jupiterTransactionsService} from "../services/jupiterTransactionsService";
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";
const logger = require('../utils/logger')(module);

class Invite extends Model {
  constructor(data = { id: null }) {
    // Sets model name and table name
    super({
      data,
      model: 'channel',
      table: 'channels',
      belongsTo: 'user',
      model_params: [
        'id', 'recipient', 'sender', 'channel',
      ],
    });
    this.public_key = data.public_key;

    // Mandatory method to be called after data
    this.record = this.setRecord();
  }

  setRecord() {
    // We set default data in this method after calling for the class setRecord method
    const record = super.setRecord(this.data);

    return record;
  }

  loadRecords(accessData) {
    return super.loadRecords(accessData);
  }

  async get() {
    const memberAccountProperties = new GravityAccountProperties(
        this.user.account,
        '', // accountId
        this.user.publicKey,
        this.user.passphrase,
        '', // hash
        this.user.encryptionPassword
    );

    return jupiterTransactionsService.getAllConfirmedAndUnconfirmedBlockChainTransactions(this.user.account)
        .then(transactionList => {
              return jupiterTransactionsService
                  .getAllMessagesFromBlockChainAndIncludeTransactionInformation(
                      memberAccountProperties,
                      transactionList,
                      this.user.encryptionPassword
                  );
            })
        .then(messages => {
          logger.sensitive(`Decrypted invites: ${JSON.stringify(messages)}`);
          return messages.reduce((reduced, message) => {
            if (message.message.dataType === 'channelInvite'){
              reduced.push(message.message);
            }
            return reduced;
          }, []);
        });
  }

  //@TODO rename to sendInvitation
  async send() {
    const messageData = this.record;
    messageData.dataType = 'channelInvite';
    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.invitation_to_channel);
    const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.invitation_to_channel);

    let inviteRecord = { ...messageData };
    let recipient = inviteRecord.recipient;
    if (!recipient.toLowerCase().includes('jup-')) {
      try{
        const aliasResponse = await gravity.getAlias(recipient);
        recipient = aliasResponse.accountRS;
      } catch (error){
        throw new Error('Not valid alias');
      }
    }


    return jupiterAPIService.sendMetisMessageOrMessage(
        'sendMetisMessage',
        recipient,
        null,
        this.user.passphrase,
        null,
        fee,
        applicationAccountProperties.deadline,
        null,
        null,
        null,
        null,
        false,
        JSON.stringify(messageData),
        null,
        null,
        null,
        false,
        true,
        null,
        null,
        null,
        null,
        null,
        subtype
    )

  }
}

module.exports = Invite;
