const mongooseClient = require('mongoose');

const encryptedMessageSchema = mongooseClient.Schema({
  data: String,
  nonce: String,
  isText: Boolean,
  isCompressed: Boolean,
});

const transactionSchema = mongooseClient.Schema({
  transactionId: {
    type: String,
    unique: true,
    required: true,
  },
  senderId: {
    type: String,
    required: true,
  },
  recipientId: {
    type: String,
    required: true,
  },
  subtype: Number,
  ecBlockHeight: Number,
  type: Number,
  senderRS: {
    type: String,
    required: true,
  },
  recipientRS: {
    type: String,
    required: true,
  },
  encryptedMessage: {
    type: encryptedMessageSchema,
    required: true,
  },
  status: {
    type: String,
    enum: ['new', 'unconfirmed', 'confirmed'],
    required: true,
  },
});

module.exports = mongooseClient.model('Transaction', transactionSchema);
