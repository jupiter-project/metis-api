
const logger = require('../utils/logger')(module);

const leaveRoom = function (data, callback) {
  const { room } = data;
  if (!room) {
    return callback({
      error: true,
      message: '[leaveRoom]: The Room is required',
    });
  }

  logger.info(`The user ${this.name} left the room ${room}`);
  this.leave(room);
};

const createMessage = function (data, callback) {
  const { room } = data;
  if (!room) {
    return callback({
      error: true,
      message: '[createMessage]: The Room is required',
    });
  }

  this.broadcast.to(room).emit('createMessage');
};

const invites = function (data) {
  const { room, message } = data;
  if (room && message) {
    this.broadcast.to(room).emit('invites', message);
  }
};

const joinRoom = (socket, room, user) => {
  socket.name = user;
  socket.join(room);
  socket.in(room).allSockets().then((result) => {
    logger.info(`The user ${user} joined to the room ${room}, and the number of user connected is: ${result.size}`);
  });
};

const signUpSuccessful = function (account) {
  console.log('signUpSuccessful....................................OK');
  this.broadcast.to(`sign-up-${account}`).emit('signUpSuccessful');
};
const signupFailedAttempt = function (account) {
  this.broadcast.to(`sign-up-${account}`).emit('signUpFailedAttempt');
};
const signUpFailed = function (account) {
  this.broadcast.to(`sign-up-${account}`).emit('signUpFailed');
};
const signUpConnection = function (socket) {
  const { room, user } = socket.handshake.query;
  if (!room || !user) {
    logger.error(`Missing parameter ${JSON.stringify({ room, user })}`);
    return socket.close();
  }

  joinRoom(socket, room, user);

  socket.on('leaveRoom', leaveRoom);
  socket.on('connect_error', (error) => {
    logger.error(JSON.stringify(error));
  });
  socket.on('signUpSuccessful', signUpSuccessful);
  socket.on('signupFailedAttempt', signupFailedAttempt);
  socket.on('signUpFailed', signUpFailed);
  /**
   * io server disconnect The server has forcefully disconnected the socket with socket.disconnect()
   * io client disconnect The socket was manually disconnected using socket.disconnect()
   * ping timeout The server did not send a PING within the pingInterval + pingTimeout range
   * transport close The connection was closed (example: the user has lost connection, or the network was changed from WiFi to 4G)
   * transport error The connection has encountered an error (example: the server was killed during a HTTP long-polling cycle)
   */
  socket.on('disconnect', (reason) => {
    logger.info(`reason: ${reason}`);
    logger.info(`${socket.name} has disconnected from the chat.${socket.id}`);
  });
};


const connection = function (socket) {
  logger.info('a user connected');
  const { room, user, event } = socket.handshake.query;
  if (!room || !user || !event) {
    logger.error(`Missing parameter ${JSON.stringify({ room, user, event })}`);
    return socket.close();
  }

  joinRoom(socket, room, user, event);

  socket.on('leaveRoom', leaveRoom);
  socket.on('createMessage', createMessage);
  socket.on('invites', invites);
  socket.on('connect_error', (error) => {
    logger.error(JSON.stringify(error));
  });

  /**
   * io server disconnect The server has forcefully disconnected the socket with socket.disconnect()
   * io client disconnect The socket was manually disconnected using socket.disconnect()
   * ping timeout The server did not send a PING within the pingInterval + pingTimeout range
   * transport close The connection was closed (example: the user has lost connection, or the network was changed from WiFi to 4G)
   * transport error The connection has encountered an error (example: the server was killed during a HTTP long-polling cycle)
   */
  socket.on('disconnect', (reason) => {
    logger.info(`reason: ${reason}`);
    logger.info(`${socket.name} has disconnected from the chat.${socket.id}`);
  });
};

module.exports = { connection, signUpConnection };
