const assert = require('assert');
const logger = require('../utils/logger')(module);
const Transaction = require('../models/transactions.js');

class TransactionService {
  async processBlock(block) {
    logger.info('Processing block');

    // const transactions = block.transactions.map(transaction => );

    // await Promise.all(transactions);
  }

  async saveTransaction(transaction, status = 'new') {
    logger.info('Saving transaction');

    const parsedTransaction = TransactionService.parseTransaction(transaction, status);
    const query = { transactionId: parsedTransaction.transactionId };
    const options = { upsert: true };

    await Transaction.findOneAndUpdate(query, parsedTransaction, options);
  }

  static parseTransaction(raw, status) {
    assert(raw, 'Transaction is empty');
    assert(raw.attachment, 'Attachment is empty');
    assert(raw.attachment.encryptedMessage, 'Encrypted message is empty');

    return {
      transactionId: raw.transaction,
      senderId: raw.sender,
      senderRS: raw.senderRS,
      recipientId: raw.recipient,
      recipientRS: raw.recipientRS,
      subtype: raw.subtype,
      ecBlockHeight: raw.ecBlockHeight,
      type: raw.type,
      encryptedMessage: {
        data: raw.attachment.encryptedMessage.data,
        nonce: raw.attachment.encryptedMessage.nonce,
        isText: raw.attachment.encryptedMessage.isText,
        isCompressed: raw.attachment.encryptedMessage.isCompressed,
      },
      status,
    };
  }

  static parseBlockStatus(block) {
  }
}

// TODO Change this to support dependency injection
const service = new TransactionService();

module.exports = { saveTransaction: service.saveTransaction, processBlock: service.processBlock };
