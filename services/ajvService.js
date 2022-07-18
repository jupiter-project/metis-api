const Ajv = require('ajv')
const { ajvConf } = require('../config/ajvConf')
const { channelRecordSchemaV1 } = require('../schema/channelRecordSchemaV1')
const { inviteRecordSchemaV1 } = require('../schema/inviteRecordSchemaV1')
const { baseTransactionSchemaV1 } = require('../schema/baseTransactionSchemaV1')
const { encryptedMessageTransactionSchemaV1 } = require('../schema/encryptedMessageTransactionSchemaV1')
const config = {
  ...ajvConf,
  ...{
    schemas: [channelRecordSchemaV1, inviteRecordSchemaV1, baseTransactionSchemaV1]
  }
}

const ajv = new Ajv(config)
require('ajv-merge-patch')(ajv)
// ajv.addKeyword({
//     keyword: 'isNotEmpty',
//     type: 'string',
//     validate: (schema, data) => typeof data === 'string' && data.trim() !== '',
//     errors: false
// })
module.exports.ajvService = ajv
