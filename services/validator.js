const Ajv = require("ajv");
const {channelRecordSchemaV1} = require("../schema/channelRecordSchemaV1");
const {inviteRecordSchemaV1} = require("../schema/inviteRecordSchemaV1");
const {baseTransactionSchemaV1} = require("../schema/baseTransactionSchemaV1");
const {encryptedMessageTransactionSchemaV1} = require("../schema/encryptedMessageTransactionSchemaV1");
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
        // const valid = this.ajv.validate(schema,data);
        const errorText =
            ajv.errorsText() && ajv.errorsText().toLocaleLowerCase() !== "no errors"
                ? ajv.errorsText()
                : "";
        return {
            isValid: !!valid,
            message: errorText
        }
    }
}

const ajv = new Ajv({
    schemas: [
        channelRecordSchemaV1,
        inviteRecordSchemaV1
    ],
    allErrors: true });

const channelRecordValidator = ajv.compile(channelRecordSchemaV1);
const inviteRecordValidator = ajv.compile(channelRecordSchemaV1);
const baseTransactionValidator = ajv.compile(baseTransactionSchemaV1);
const encryptedMessageTransactionValidator = ajv.compile(encryptedMessageTransactionSchemaV1);
module.exports.validator = new Validator(
    channelRecordValidator,
    inviteRecordValidator,
    baseTransactionValidator,
    encryptedMessageTransactionValidator
);
