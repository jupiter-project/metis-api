const gu = require("../utils/gravityUtils")
const inviteRecordSchemaV1 = {
    $id: 'inviteRecordSchemaV1',
    type: "object",
    properties: {
        version: {
            type: "integer"
        },
        recordType: {
            type: "string"
        },
        inviteeAddress: {
            type: "string",
            validate: (_,data)=>gu.isWellFormedJupiterAddress(data)
        },
        inviterAddress: {
            type: "string",
            validate: (_,data)=>gu.isWellFormedJupiterAddress(data)
        },
        channelRecord: {
             "$ref": 'channelRecordSchemaV1'
        },
        createdBy: {type: "string"},
        status: {type: "string"},
        updatedAt: {
            type: "integer",
            format: "date-time"
        },
        createdAt: {
            type: "integer",
            format: "date-time"
        },
    },
    required: [
        'version',
        'recordType',
        'inviteeAddress',
        'inviterAddress',
        'channelRecord',
        'createdBy',
        'status',
        'createdAt',
        'updatedAt'
    ],
    additionalProperties: false,
}

module.exports.inviteRecordSchemaV1 = inviteRecordSchemaV1;
