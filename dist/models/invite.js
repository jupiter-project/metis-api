"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _interopRequireDefault = require("@swc/helpers/lib/_interop_require_default.js").default;
const _model = /*#__PURE__*/ _interopRequireDefault(require("./_model"));
const _gravity = require("../config/gravity");
const _feeManager = require("../services/FeeManager");
const _jupiterAPIService = require("../services/jupiterAPIService");
const _applicationAccountProperties = require("../gravity/applicationAccountProperties");
const _jupiterTransactionsService = require("../services/jupiterTransactionsService");
const _instantiateGravityAccountProperties = require("../gravity/instantiateGravityAccountProperties");
const logger = require('../utils/logger').default(module);
class Invite extends _model.default {
    constructor(data = {
        id: null
    }){
        // Sets model name and table name
        super({
            data,
            model: 'channel',
            table: 'channels',
            belongsTo: 'user',
            model_params: [
                'id',
                'recipient',
                'sender',
                'channel'
            ]
        });
        this.public_key = data.public_key;
        // Mandatory method to be called after data
        this.record = this.setRecord();
    }
    setRecord() {
        // We set default data in this method after calling for the class setRecord method
        return super.setRecord(this.data);
    }
    loadRecords(accessData) {
        return super.loadRecords(accessData);
    }
    /**
   *
   * @returns {Promise<[]>}
   */ async get() {
        logger.verbose('###################################################################################');
        logger.verbose('## Invite.get()');
        logger.verbose('## ');
        return (0, _instantiateGravityAccountProperties.instantiateGravityAccountProperties)(this.user.passphrase, this.user.encryptionPassword).then((memberAccountProperties)=>{
            // @TODO we need to use tags here!!
            return _jupiterTransactionsService.jupiterTransactionsService.getAllConfirmedAndUnconfirmedBlockChainTransactions(this.user.account).then((transactionList)=>{
                return _jupiterTransactionsService.jupiterTransactionsService.getAllMessagesFromBlockChainAndIncludeTransactionInformation(memberAccountProperties, transactionList, this.user.encryptionPassword);
            }).then((messages)=>{
                logger.sensitive(`Decrypted invites: ${JSON.stringify(messages)}`);
                return messages.reduce((reduced, message)=>{
                    if (message.message.dataType === 'channelInvite') {
                        reduced.push(message.message);
                    }
                    return reduced;
                }, []);
            });
        });
    }
    // @TODO rename to sendInvitation
    async send() {
        logger.verbose('###################################################################################');
        logger.verbose('## send()');
        logger.verbose('## ');
        const messageData = this.record;
        messageData.dataType = 'channelInvite';
        const fee = _feeManager.feeManagerSingleton.getFee(_feeManager.FeeManager.feeTypes.invitation_to_channel);
        const { subtype  } = _feeManager.feeManagerSingleton.getTransactionTypeAndSubType(_feeManager.FeeManager.feeTypes.invitation_to_channel);
        const inviteRecord = {
            ...messageData
        };
        let recipient = inviteRecord.recipient;
        if (!recipient.toLowerCase().includes('jup-')) {
            try {
                const aliasResponse = await _gravity.gravity.getAlias(recipient);
                recipient = aliasResponse.accountRS;
            } catch (error) {
                throw new Error('Not valid alias');
            }
        }
        return _jupiterAPIService.jupiterAPIService.sendMetisMessageOrMessage('sendMetisMessage', recipient, null, this.user.passphrase, null, fee, _applicationAccountProperties.metisApplicationAccountProperties.deadline, null, null, null, null, false, JSON.stringify(messageData), null, null, null, false, true, null, null, null, null, null, subtype);
    }
}
module.exports = Invite;
