const gu = require('../utils/gravityUtils')

module.exports.baseTransactionSchemaV1 = {
  $id: 'http://jup.io/schemas/baseTransactionSchemaV1.json',
  type: 'object',
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
      type: 'string'
    },
    signature: {
      type: 'string'
    },
    feeNQT: {
      type: 'string'
    },
    type: {
      type: 'number'
    },
    fullHash: {
      type: 'string'
    },
    version: {
      type: 'number'
    },
    phased: {
      type: 'boolean'
    },
    ecBlockId: {
      type: 'string'
    },
    signatureHash: {
      type: 'string'
    },
    attachment: {
      type: 'object'
    },
    senderRS: {
      type: 'string'
    },
    subtype: {
      type: 'number'
    },
    amountNQT: {
      type: 'string'
    },
    sender: {
      type: 'string'
    },
    ecBlockHeight: {
      type: 'number'
    },
    deadline: {
      type: 'number'
    },
    transaction: {
      type: 'string'
    },
    timestamp: {
      type: 'integer'
    },
    height: {
      type: 'number'
    }
  },
  additionalProperties: true
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
