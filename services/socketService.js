const logger = require('../utils/logger')(module)

const leaveRoom = function (data, callback) {
  const { room } = data
  if (!room) {
    return callback({
      error: true,
      message: '[leaveRoom]: The Room is required'
    })
  }

  logger.info(`The user ${this.name} left the room ${room}`)
  this.leave(room)
}

const createMessage = function (data, callback) {
  const { room, message } = data
  if (!room) {
    return callback({
      error: true,
      message: '[createMessage]: The Room is required'
    })
  }

  this.broadcast.to(room).emit('createMessage', message)
}

const invites = function (data) {
  const { room, message } = data
  if (room && message) {
    this.broadcast.to(room).emit('invites', message)
  }
}

const joinRoom = (socket, room, user) => {
  logger.verbose('###############################')
  logger.verbose('## joinRoom()')
  logger.verbose('##')
  logger.debug(`  room= ${room}`)

  socket.name = user
  socket.join(room) // creates the room and join the socket
  socket
    .in(room)
    .allSockets()
    .then((result) => {
      logger.info(`The user ${user} joined to the room ${room}, and the number of user connected is: ${result.size}`)
    })
}

const joinChannelRoom = (socket, room, user) => {
  logger.verbose('###############################')
  logger.verbose('## joinChannelRoom()')
  logger.verbose('##')
  logger.debug(`  room= ${room}`)

  socket.name = user
  socket.join(room) // creates the room and join the socket
  socket
    .in(room)
    .allSockets()
    .then((result) => {
      logger.info(`The user ${user} joined to the room ${room}, and the number of user connected is: ${result.size}`)
    })
}

const signUpSuccessful = function (account) {
  console.log('signUpSuccessful....................................OK')
  this.broadcast.to(`sign-up-${account}`).emit('signUpSuccessful')
}

const signInStartDiscovery = function ({ selectedAccount, publicKey }) {
  console.log('signInStartDiscovery', selectedAccount)
  this.broadcast
    .to(`sign-in-${selectedAccount}`)
    .emit(`discover-request-${selectedAccount}`, { selectedAccount, publicKey })
}

const signInResponseDiscovery = function ({ selectedAccount, encryptedMessage }) {
  console.log('signInResponseDiscovery', encryptedMessage)
  this.broadcast.to(`sign-in-${selectedAccount}`).emit(`discover-response-${selectedAccount}`, encryptedMessage)
}

const signupFailedAttempt = function (account) {
  this.broadcast.to(`sign-up-${account}`).emit('signUpFailedAttempt')
}

/**
 *
 * @param account
 */
const signUpFailed = function (account) {
  logger.verbose('#########################')
  logger.verbose(`## signUpFailed(account=${account})`)
  this.broadcast.to(`sign-up-${account}`).emit('signUpFailed')
}

const channelCreationConnection = function (socket) {
  const { room, user } = socket.handshake.query
  if (!room || !user) {
    logger.error(`Missing parameter ${JSON.stringify({ room, user })}`)
    return socket.close()
  }

  joinChannelRoom(socket, room, user)

  socket.on('leaveRoom', leaveRoom)
  socket.on('connect_error', (error) => {
    logger.error(JSON.stringify(error))
  })
  /**
   * io server disconnect The server has forcefully disconnected the socket with socket.disconnect()
   * io client disconnect The socket was manually disconnected using socket.disconnect()
   * ping timeout The server did not send a PING within the pingInterval + pingTimeout range
   * transport close The connection was closed (example: the user has lost connection, or the network was changed from WiFi to 4G)
   * transport error The connection has encountered an error (example: the server was killed during a HTTP long-polling cycle)
   */
  socket.on('disconnect', (reason) => {
    logger.info(`reason: ${reason}`)
    logger.info(`${socket.name} has disconnected from the chat.${socket.id}`)
  })
}

/**
 *
 * @param socket
 * @returns {*}
 */
const signUpConnection = function (socket) {
  const { room, user } = socket.handshake.query
  if (!room || !user) {
    logger.error(`Missing parameter ${JSON.stringify({ room, user })}`)
    return socket.close()
  }

  joinRoom(socket, room, user)

  socket.on('leaveRoom', leaveRoom)
  socket.on('connect_error', (error) => {
    logger.error('***********************************************************************************')
    logger.error('** signUpConnection(socket).catch(error)')
    logger.error('** ')
    console.log(error)
  })

  socket.on('signUpSuccessful', signUpSuccessful)
  socket.on('signupFailedAttempt', signupFailedAttempt)
  socket.on('signUpFailed', signUpFailed)
  /**
   * io server disconnect The server has forcefully disconnected the socket with socket.disconnect()
   * io client disconnect The socket was manually disconnected using socket.disconnect()
   * ping timeout The server did not send a PING within the pingInterval + pingTimeout range
   * transport close The connection was closed (example: the user has lost connection, or the network was changed from WiFi to 4G)
   * transport error The connection has encountered an error (example: the server was killed during a HTTP long-polling cycle)
   */
  socket.on('disconnect', (reason) => {
    logger.error('***********************************************************************************')
    logger.error('** signUpConnection(socket).onDisconnect(reason)')
    logger.error('** ')
    logger.error(`reason: ${reason}`)
    logger.info(`${socket.name} has disconnected from the chat.${socket.id}`)
  })
}

/**
 *
 * @param socket
 * @returns {*}
 */
const signInConnection = function (socket) {
  const { room, user } = socket.handshake.query
  if (!room || !user) {
    logger.error(`Missing parameter ${JSON.stringify({ room, user })}`)
    return socket.close()
  }

  joinRoom(socket, room, user)

  socket.on('leaveRoom', leaveRoom)
  socket.on('connect_error', (error) => {
    logger.error('***********************************************************************************')
    logger.error('** signUpConnection(socket).catch(error)')
    logger.error('** ')
    console.log(error)
  })

  socket.on('signInStartDiscovery', signInStartDiscovery)
  socket.on('signInResponseDiscovery', signInResponseDiscovery)

  /**
   * io server disconnect The server has forcefully disconnected the socket with socket.disconnect()
   * io client disconnect The socket was manually disconnected using socket.disconnect()
   * ping timeout The server did not send a PING within the pingInterval + pingTimeout range
   * transport close The connection was closed (example: the user has lost connection, or the network was changed from WiFi to 4G)
   * transport error The connection has encountered an error (example: the server was killed during a HTTP long-polling cycle)
   */
  socket.on('disconnect', (reason) => {
    logger.error('***********************************************************************************')
    logger.error('** signInConnection(socket).onDisconnect(reason)')
    logger.error('** ')
    logger.error(`reason: ${reason}`)
    logger.info(`${socket.name} has disconnected from the room.${socket.id}`)
  })
}

const syncDevices = function (socket, io) {
  const { room, user } = socket.handshake.query
  if (!room || !user) {
    logger.error(`Missing parameter  ${JSON.stringify({ room, user })}`)
    return socket.close()
  }

  joinRoom(socket, room, user)

  socket.on('sync-devices-request', ({ ethAccount }) => {
    io.of('sync-devices').to(room).emit('sync-devices-requested', {
      ethAccount
    })
  })

  socket.on('sync-devices-grant', (data) => {
    io.of('sync-devices').to(room).emit('sync-devices-granted', data)
  })

  socket.on('sync-devices-reject', () => {
    io.of('sync-devices').to(room).emit('sync-devices-rejected')
  })

  socket.on('leaveRoom', leaveRoom)

  socket.on('disconnect', (reason) => {
    logger.error('***********************************************************************************')
    logger.error('** syncDevices(socket).onDisconnect(reason)')
    logger.error('** ')
    logger.error(`reason: ${reason}`)
    logger.info(`${socket.name} has disconnected from the room.${socket.id}`)
  })
}

const connection = function (socket) {
  logger.info('a user connected')
  const { room, user, event } = socket.handshake.query
  if (!room || !user || !event) {
    logger.error(`Missing parameter ${JSON.stringify({ room, user, event })}`)
    return socket.close()
  }

  joinRoom(socket, room, user)

  socket.on('leaveRoom', leaveRoom)
  socket.on('createMessage', createMessage)
  socket.on('acceptInvites', invites)
  socket.on('connect_error', (error) => {
    logger.error(JSON.stringify(error))
  })

  /**
   * io server disconnect The server has forcefully disconnected the socket with socket.disconnect()
   * io client disconnect The socket was manually disconnected using socket.disconnect()
   * ping timeout The server did not send a PING within the pingInterval + pingTimeout range
   * transport close The connection was closed (example: the user has lost connection, or the network was changed from WiFi to 4G)
   * transport error The connection has encountered an error (example: the server was killed during a HTTP long-polling cycle)
   */
  socket.on('disconnect', (reason) => {
    logger.info(`reason: ${reason}`)
    logger.info(`${socket.name} has disconnected from the chat.${socket.id}`)
  })
}

module.exports = { connection, signUpConnection, channelCreationConnection, signInConnection, syncDevices }
