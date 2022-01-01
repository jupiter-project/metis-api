// import Ajv2019 from "ajv/dist/2019"
// const Ajv = new Ajv2019()
// const Ajv = require("ajv");
// const Ajv = require("ajv").default
const {channelRecordSchemaV1} = require("../schema/channelRecordSchemaV1");
const {inviteRecordSchemaV1} = require("../schema/inviteRecordSchemaV1");
const {baseTransactionSchemaV1} = require("../schema/baseTransactionSchemaV1");
const {encryptedMessageTransactionSchemaV1} = require("../schema/encryptedMessageTransactionSchemaV1");
// const {ajvConf} = require("../config/ajvConf");
const {ajvService} = require("./ajvService");
const logger = require('../utils/logger')(module);

class Validator {
    /**
     *
     * @param channelRecordValidator
     * @param inviteRecordValidator
     * @param baseTransactionValidator
     */
    constructor(channelRecordValidator,
                inviteRecordValidator,
                baseTransactionValidator,
                encryptedMessageTransactionValidator) {
        this.channelRecordValidator = channelRecordValidator;
        this.inviteRecordValidator = inviteRecordValidator;
        this.baseTransactionValidator = baseTransactionValidator;
        this.encryptedMessageTransactionValidator = encryptedMessageTransactionValidator;
    }

    /**
     *
     * @param channelRecord
     * @return {{isValid: boolean, message: (*|string)}}
     */
    validateChannelRecord(channelRecord) {
        return this.validate(this.channelRecordValidator, channelRecord);
    }

    /**
     *
     * @param inviteRecord
     * @return {{isValid: boolean, message: (*|string)}}
     */
    validateInviteRecord(inviteRecord) {
        return this.validate(this.inviteRecordValidator, inviteRecord);
    }

    validateBaseTransaction(baseTransaction) {
        return this.validate(this.baseTransactionValidator, baseTransaction);
    }

    validateEncryptedMessageTransaction(data) {
        return this.validate(this.encryptedMessageTransactionValidator, data);
    }

    /**
     *
     * @param schema
     * @param data
     * @return {{isValid: boolean, message: (*|string)}}
     */
    validate(validator, data){
        logger.sensitive(`#### validate(schema,data)`);
        const valid = validator(data);
        const message = validator.errors ? `There are ${validator.errors.length} errors.` : '';
        return {
            isValid: !!valid,
            message: message,
            errors: validator.errors
        }
    }
}


const channelRecordValidator = ajvService.compile(channelRecordSchemaV1);
const inviteRecordValidator = ajvService.compile(inviteRecordSchemaV1);
const baseTransactionValidator = ajvService.compile(baseTransactionSchemaV1);
const encryptedMessageTransactionValidator = ajvService.compile(encryptedMessageTransactionSchemaV1);
module.exports.validator = new Validator(
    channelRecordValidator,
    inviteRecordValidator,
    baseTransactionValidator,
    encryptedMessageTransactionValidator
);
