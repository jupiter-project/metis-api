const gu = require("../utils/gravityUtils")

module.exports.baseTransactionSchemaV1 = {
    $id: 'http://jup.io/schemas/baseTransactionSchemaV1.json',
    type: "object",
    definitions: {
        Attachment: {
            type: 'object',
            properties: {
                encryptedMessage: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'string'
                        }
                    }
                }
            }
        }
    },
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
            type: "string"
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
            type: "integer"
        },
        height: {
            type: "string"
        }
    },
    additionalProperties: false,
}

// required: [
//     "senderPublicKey",
//     "signature",
//     "feeNQT",
//     "type",
//     "fullHash",
//     "version",
//     "phased",
//     "ecBlockId",
//     "signatureHash",
//     "attachment",
//     'senderRS',
//     "subtype",
//     "amountNQT",
//     "sender",
//     "ecBlockHeight",
//     "deadline",
//     "transaction",
//     "timestamp",
//     "height"
// ],
