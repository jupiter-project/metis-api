"use strict";
const axios = require('axios');
const events = require('events');
const Model = require('./_model');
const Methods = require('../config/_methods');
const { gravity  } = require('../config/gravity');
const { FeeManager , feeManagerSingleton  } = require('../services/FeeManager');
const logger = require('../utils/logger').default(module);
class Channel extends Model {
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
                'passphrase',
                'account',
                'password',
                'name',
                'publicKey',
                'sender',
                'accountId',
                'createdBy'
            ]
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
                    dataType: 'String'
                }
            }
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
    async loadChannelByAddress(account, accessData) {
        // @TODO figure out how to get a single channel
        const { records  } = await super.loadRecords(accessData);
        if (records && Array.isArray(records)) {
            // console.log('Channel records ------>'. records);
            return records.find((record)=>record.channel_record.account === account);
        }
        throw new Error('Channel not found');
    }
    /**
   *
   * @param accessLink
   * @returns {Promise<unknown>}
   */ import(accessLink) {
        logger.verbose('#####################################################################################');
        logger.verbose('## import(accessLink)');
        logger.verbose('##');
        logger.sensitive(`accessLink=${JSON.stringify(accessLink)}`);
        const self = this;
        const eventEmitter = new events.EventEmitter();
        let recordTable;
        return new Promise((resolve, reject)=>{
            if (self.verify().errors === true) {
                reject({
                    false: false,
                    verification_error: true,
                    errors: self.verify().messages
                });
            } else {
                eventEmitter.on('id_generated', ()=>{
                    const stringifiedRecord = JSON.stringify(self.record);
                    const fullRecord = {
                        id: self.record.id,
                        [`${self.model}_record`]: stringifiedRecord,
                        date: Date.now()
                    };
                    logger.sensitive(`fullRecord=${JSON.stringify(fullRecord)}`);
                    const encryptedRecord = gravity.encrypt(JSON.stringify(fullRecord), accessLink.encryptionPassword);
                    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.invitation_to_channel);
                    const callUrl = `${gravity.jupiter_data.server}/nxt?requestType=sendMessage&secretPhrase=${recordTable.passphrase}&recipient=${self.user.account}&messageToEncrypt=${encryptedRecord}&feeNQT=${fee}&deadline=${gravity.jupiter_data.deadline}&recipientPublicKey=${self.user.publicKey}&compressMessageToEncrypt=true`;
                    logger.sensitive('channel invitation----');
                    logger.sensitive('url:');
                    logger.sensitive(callUrl);
                    axios.post(callUrl).then((response)=>{
                        logger.verbose('-----------------------------------------------------------------');
                        logger.verbose('-- import().then');
                        logger.verbose('-- ');
                        logger.sensitive(`callUrl=${JSON.stringify(callUrl)}`);
                        if (response.data.broadcasted && response.data.broadcasted === true) {
                            resolve({
                                success: true,
                                message: 'Record created'
                            });
                        } else if (response.data.errorDescription != null) {
                            reject({
                                success: false,
                                errors: response.data.errorDescription
                            });
                        } else {
                            reject({
                                success: false,
                                errors: 'Unable to save data in blockchain'
                            });
                        }
                    }).catch((error)=>{
                        logger.verbose('********************************************************************************');
                        logger.verbose('** import().catch(error)');
                        logger.verbose('** ');
                        logger.sensitive(`error=${JSON.stringify(error)}`);
                        reject({
                            success: false,
                            errors: error
                        });
                    });
                });
                eventEmitter.on('request_authenticated', ()=>{
                    self.loadAppTable(accessLink).then((res)=>{
                        recordTable = res;
                        eventEmitter.emit('id_generated');
                    }).catch((err)=>{
                        reject({
                            success: false,
                            errors: err
                        });
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
            firstIndex: nextIndex
        };
        if (queryMode === 'unconfirmed') {
            query.noConfirmed = true;
        }
        const response = await gravity.getDataTransactions(query);
        if (!response.error) {
            return {
                success: true,
                messages: response
            };
        }
        return response;
    }
    async create(accessLink) {
        logger.verbose('#########################################################');
        logger.verbose(`## Channel.create(accessLink:${!!accessLink})`);
        logger.verbose('##');
        logger.sensitive(`accessLink= ${JSON.stringify(accessLink)}`);
        if (!this.record.passphrase || this.record.password) {
            // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            // console.log('this.record.passphrase');
            // console.log(this.record.passphrase);
            // console.log('this.record.password');
            // console.log(this.record.password);
            // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
            this.record.passphrase = Methods.generate_passphrase();
            this.record.password = Methods.generate_keywords();
            this.data.passphrase = this.record.passphrase;
            this.data.password = this.record.password;
            const response = await gravity.getAccountInformation(this.record.passphrase);
            this.record.account = response.address;
            this.record.publicKey = response.publicKey;
            this.data.account = response.address;
            this.data.publicKey = response.publicKey;
            logger.sensitive('creating a new Channel Account');
            logger.sensitive(`address: ${response.address}`);
            logger.sensitive(`publicKey: ${response.publicKey}`);
            logger.sensitive(`passphrase: ${this.record.passphrase}`);
            logger.sensitive(`password: ${this.record.password}`);
            logger.sensitive(`response = ${JSON.stringify(response)}`);
        }
        logger.sensitive(`record = ${JSON.stringify(this.record)}`);
        logger.sensitive(`data = ${JSON.stringify(this.data)}`);
        if (accessLink) {
            return super.create(accessLink);
        }
        return Promise.reject({
            error: true,
            message: 'Missing user information'
        });
    }
}
module.exports = Channel;
