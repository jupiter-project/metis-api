const inviteRecordSchemaV1 = {
  $id: 'http://jup.io/schemas/inviteRecordSchemaV1.json',
  type: 'object',
  additionalProperties: false,
  properties: {
    version: {
      type: 'integer'
    },
    recordType: {
      type: 'string',
      const: 'channelInvite'
    },
    inviteeAddress: {
      type: 'string',
      pattern: '^JUP-\\w\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w\\w$'
    },
    inviteePublicKey: {
      type: 'string',
      pattern: '^[0-9A-Fa-f]{64}'
    },
    inviterAddress: {
      type: 'string',
      pattern: '^JUP-\\w\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w\\w$'
    },
    inviterAlias: {
      type: 'string'
    },
    channelRecord: {
      $ref: 'channelRecordSchemaV1.json'
    },
    createdBy: {
      type: 'string',
      pattern: '^JUP-\\w\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w\\w$'
    },
    status: {
      type: 'string',
      enum: ['active']
    },
    updatedAt: {
      type: 'integer'
    },
    createdAt: {
      type: 'integer'
    }
  },
  required: [
    'version',
    'recordType',
    'inviteeAddress',
    'inviteePublicKey',
    'inviterAddress',
    'channelRecord',
    'createdBy',
    'status',
    'createdAt',
    'updatedAt'
  ]
}

module.exports.inviteRecordSchemaV1 = inviteRecordSchemaV1
