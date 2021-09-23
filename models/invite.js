import Model from './_model';
import { gravity } from '../config/gravity';
import {FeeManager, feeManagerSingleton} from "../services/FeeManager";
import jupiterApiService from "../services/jupiterAPIService";

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
    let response;

    try {
      response = await gravity.getMessages(this.user.account, this.user.passphrase);
    } catch (e) {
      response = { error: true, fullError: e };
    }

    return response;
  }

  //@TODO rename to sendInvitation
  send() {
    const messageData = this.record;
    messageData.dataType = 'channelInvite';
    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.invitation_to_channel);
    const {subtype} = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.invitation_to_channel);

    return jupiterApiService.sendMetisMessageOrMessage(
        'sendMetisMessage',
        messageData.recipient,
        null,
        this.user.passphrase,
        null,
        fee,
        null,
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
