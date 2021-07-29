const TransactionBlocks = require('../models/transactions.js');
const logger = require('../utils/logger')(module);

// TODO This code was not called. Check if it's necessary.
// const getDisconnectingEvent = (reason) => {
//   const event = {
//     event: 'disconnecting',
//     reason,
//   };
//   return JSON.stringify(event);
// };
//
// const disconnect = (ws, reason) => {
//   ws.send(getDisconnectingEvent(reason));
//   ws.terminate();
// };

const handleMessage = async (message) => {
  try {
    const parsedMessage = JSON.parse(message);

    const transactionBlock = new TransactionBlocks(parsedMessage);
    await transactionBlock.save();
  } catch (e) {
    logger.error('Error on socket message', e);
  }
};

const connection = (ws) => {
  logger.info('jupiter ws connected');

  ws.on('message', (message) => {
    console.log('jupiterWss:', message);
    const filtered = message.slice(20);
    handleMessage(filtered);
  });

  ws.on('close', () => {
    console.log('connection closed');
    clearTimeout(ws.connectionTimeout);
  });
};

module.exports = { connection };
