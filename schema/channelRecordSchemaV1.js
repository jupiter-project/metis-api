const gu = require("../utils/gravityUtils");
const channelRecordSchemaV1 = {
    $id: 'channelRecordSchemaV1',
    type: "object",
    properties: {
        version: {
            type: "integer"
        },
        recordType: {
            type: "string"
        },
        channelName: {
            type: "string"
        },
        address: {
            type: "string",
            validate: (_,data)=>gu.isWellFormedJupiterAddress(data)
        },
        passphrase: {
            type: "string",
            validate: (_,data)=>gu.isWellFormedPassphrase(data)
        },
        password: {
            type: "string"
        },
        publicKey: {
            type: "string",
            validate:(_,data)=>gu.isWellFormedPublicKey(data)
        },
        accountId: {
            type: "string",
            validate: (_,data)=>gu.isWellFormedAccountId(data)
        },
        sender: {type: "string"},
        createdBy: {type: "string"},
        status: {type: "string"},
        createdAt: {
            type: "integer",
            format: "date-time"
        },
        updatedAt: {
            type: "integer",
            format: "date-time"
        },
    },
    required: [
        'version',
        'recordType',
        'channelName',
        'address',
        'passphrase',
        'password',
        'publicKey',
        'accountId',
        'sender',
        'createdBy',
        'status',
        'createdAt',
        'updatedAt'
    ],
    additionalProperties: false,
}

module.exports.channelRecordSchemaV1 = channelRecordSchemaV1;
