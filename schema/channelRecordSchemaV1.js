const gu = require("../utils/gravityUtils");
const channelRecordSchemaV1 = {
    $id: 'http://jup.io/schemas/channelRecordSchemaV1.json',
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
            pattern: '^JUP-\\w\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w\\w$'
        },
        passphrase: {
            type: "string",
            pattern: '^(\\w+\\s){11}\\w+$'
        },
        password: {
            type: "string"
        },
        publicKey: {
            type: "string",
            pattern: '^[0-9A-Fa-f]{64}'
        },
        accountId: {
            type: "string"
        },
        sender: {type: "string"},
        createdBy: {type: "string"},
        status: {type: "string"},
        createdAt: {
            type: "integer"
        },
        updatedAt: {
            type: "integer"
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
