const gu = require("../utils/gravityUtils")

module.exports.baseTransactionSchemaV1 = {
    $id: 'baseTransactionSchemaV1',
    type: "object",
    properties: {
        senderPublicKey: {
            type: "string"
        },
        signature: {
            type: "string"
        },
        feeNQT: {
            type: "string"
        },
        type: {
            type: "string"
        },
        fullHash: {
            type: "string"
        },
        version: {
            type: "string"
        },
        phased: {
            type: "string"
        },
        ecBlockId: {
            type: "string"
        },
        signatureHash: {
            type: "string"
        },
        attachment: {
            type: "string"
        },
        senderRS: {
            type: "string",
            validate: (_,data)=>gu.isWellFormedJupiterAddress(data)
        },
        subtype: {
            type: "string"
        },
        amountNQT: {
            type: "string"
        },
        sender: {
            type: "string"
        },
        ecBlockHeight: {
            type: "string"
        },
        deadline: {
            type: "string"
        },
        transaction: {
            type: "string"
        },
        timestamp: {
            type: "integer",
            format: "date-time"
        },
        height: {
            type: "string"
        }
    },
    required: [
        "senderPublicKey",
        "signature",
        "feeNQT",
        "type",
        "fullHash",
        "version",
        "phased",
        "ecBlockId",
        "signatureHash",
        "attachment",
        'senderRS',
        "subtype",
        "amountNQT",
        "sender",
        // "recipientRS", // type1 subtype 1 doesnt have a recipient: ie alias assignment
        // "recipient", // type1 subtype 1 doesnt have recipient
        "ecBlockHeight",
        "deadline",
        "transaction",
        "timestamp",
        "height"
    ],
    additionalProperties: false,
}
