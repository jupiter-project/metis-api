const socketIO = require('socket.io');
const logger = require('../utils/logger')(module);

const socketOptions = {
  pingTimeout: 9000000, // pingTimeout value to consider the connection closed
  pingInterval: 30000, // how many ms before sending a new ping packet
};

class MetisSocket {
  static init(httpServer) {
    logger.info('Creating socket');

    if (!this.instance) {
      this.instance = new MetisSocket(httpServer);
    }
  }

  static getConnection() {
    logger.info('Getting socket connection');

    if (!this.instance) {
      throw new Error('No active connection');
    }

    return this.instance;
  }

  constructor(server) {
    logger.info('Socket constructor called');

    this.io = socketIO(server, socketOptions);
    this.io.of('/chat').on('connection', this.onConnection);
  }

  onConnection(socket) {
    logger.info('Socket onConnection');

    this.socket = socket;

    this.socket.on('statusConnetion', (data) => {
      console.log(data);
    });

    this.socket.on('disconnect', () => {
      console.log(socket.id, 'Un socket se desconecto');
    });

    console.log(`New socket connection: ${socket.id}`);
  }
}

module.exports = {
  init: MetisSocket.init,
  connection: MetisSocket.getConnection,
};
