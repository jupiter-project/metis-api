// const gu = require("../utils/gravityUtils")
// const {baseTransactionSchemaV1} = require("./baseTransactionSchemaV1");

module.exports.encryptedMessageTransactionSchemaV1 = {
    $id: 'http://jup.io/schemas/encryptedMessageTransactionSchemaV1.json',
    $patch: {
        'source': {$ref: 'baseTransactionSchemaV1.json'},
        with: [
                {
                    op: 'replace',
                    path: '/properties/attachment',
                    value: {$ref: '#/definitions/Attachment'}
                }
            ]
        }
}
