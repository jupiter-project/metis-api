// const gu = require("../utils/gravityUtils")
// const {baseTransactionSchemaV1} = require("./baseTransactionSchemaV1");

module.exports.encryptedMessageTransactionSchemaV1 = {
    $id: 'encryptedMessageTransactionSchemaV1',
    $patch: {
        source: {$ref: "baseTransactionSchemaV1"},
        with: [
            {
                op: 'replace',
                path: '/properties/attachment',
                value: {$ref: '#/definitions/Attachment'}
            },
            {
                op: 'add',
                path: '/required/-',
                value: 'attachment'
            }
        ]
    },
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
    }
}
