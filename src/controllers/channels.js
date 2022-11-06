const _ = require('lodash')
const controller = require('../config/controller')
const { gravity } = require('../config/gravity')
const { jupiterAccountService } = require('../services/jupiterAccountService')
const { chanService } = require('../services/chanService')
const {
  instantiateGravityAccountProperties,
  instantiateMinimumGravityAccountProperties
} = require('../gravity/instantiateGravityAccountProperties')
const { jupiterTransactionsService } = require('../services/jupiterTransactionsService')
const {
  generateNewMessageRecordJson,
  sendMessagePushNotifications,
  createMessageRecord
} = require('../services/messageService')
// const {mError} = require("../errors/metisError")
const mError = require('../errors/metisError')
const { StatusCode } = require('../utils/statusCode')
const { messagesConfig } = require('../config/constants')
const { MetisErrorCode } = require('../utils/metisErrorCode')
const { websocketConstants } = require('../modules/metis/constants/websocketConstants')
const moment = require('moment') // require
const gu = require('../utils/gravityUtils')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger').default(module)
const { getPNTokensAndSendPushNotification } = require('../services/PushNotificationMessageService')

let newChannelCounter = 1
let newInvitationCounter = 1

module.exports = (app, passport, jobs, websocket) => {
  /**
   * Get List of Channels
   */
  app.get('/v1/api/channels', async (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('== Get member Channels')
    logger.info('== GET: /v1/api/channels')
    logger.sensitive(`== req.user.passphrase: ${req.user.passphrase}`)
    logger.sensitive(`== req.user.password: ${req.user.password}`)
    logger.info('======================================================================================')
    console.log('')

    const memberAccountProperties = await instantiateGravityAccountProperties(req.user.passphrase, req.user.password)

    const allMemberChannels = await chanService.getMemberChannels(memberAccountProperties)

    const listOfChannels = allMemberChannels.reduce((reduced, channelAccountProperties) => {
      reduced.push({
        channelAddress: channelAccountProperties.address,
        channelPublicKey: channelAccountProperties.publicKey,
        channelName: channelAccountProperties.channelName,
        createdBy: channelAccountProperties.createdBy,
        createdAt: channelAccountProperties.createdAt
      })
      return reduced
    }, [])

    res.send(listOfChannels)

    console.log('')
    logger.info('^======================================================================================^')
    logger.info('^ Get member Channels')
    logger.info('^ GET: /v1/api/channels')
  })

  /**
   * Video Conference
   */
  app.post('/v1/api/channels/call', async (req, res) => {
    // @TODO what is this used for?
    console.log('')
    logger.info('======================================================================================')
    logger.info('== Video Conference')
    logger.info('== POST: v1/api/channels/call')
    logger.info('======================================================================================')
    console.log('')

    const { data } = req.body
    const { user } = req
    try {
      const senderAlias = user.userData.alias
      let recipientAddress = _.get(data, 'recipient', '')

      if (!recipientAddress.toLowerCase().includes('jup-')) {
        const aliasResponse = await gravity.getAlias(recipientAddress)
        recipientAddress = aliasResponse.accountRS
      }

      const message = `${senderAlias} is inviting you to a video call`
      const url = `metis/${uuidv4()}`
      const metadata = { isCall: 'true', url, recipient: recipientAddress, sender: senderAlias }
      getPNTokensAndSendPushNotification([recipientAddress], senderAlias, {}, message, 'call', metadata)
      res.send({ success: true, url })
    } catch (e) {
      logger.error(e)
      res.status(500).send(`${e}`)
    }
  })

  /**
   * Accept channel invite
   */
  app.post('/v1/api/channel/invite/accept', async (req, res) => {
    console.log('\n\n')
    logger.info('======================================================================================')
    logger.info('== Accept Channel Invite')
    logger.info('== v1/api/channel/invite/accept')
    logger.info('======================================================================================\n\n')
    const { channelAddress } = req.body
    if (!gu.isWellFormedJupiterAddress(channelAddress)) {
      throw new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)
    }
    const memberAccountProperties = req.user.gravityAccountProperties

    chanService
      .acceptInvitation(memberAccountProperties, channelAddress)
      .then(() => {
        websocket.of('/chat').to(channelAddress).emit('newMemberChannel')
        res.status(StatusCode.SuccessOK).send({ message: 'Invite accepted' })
      })
      .catch((error) => {
        logger.error('*********************************************')
        logger.error('** channel/invite/accept ERROR')
        logger.error(`${error}`)
        logger.error(`Invitation to channel: ${channelAddress}`)
        if (error.message === 'Invitation Not Found') {
          return res.status(StatusCode.ClientErrorNotFound).send({ message: error.message, code: error.code })
        }
        return res.status(StatusCode.ServerErrorInternal).send({ message: error.message, code: error.code })
      })
  })

  /**
   * Render a channel's conversations
   */
  app.get('/channels/:id', controller.isLoggedIn, (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('== Render a channel conversations')
    logger.info('== GET: channels/:id')
    logger.info('======================================================================================')
    console.log('')

    const messages = req.session.flash
    req.session.flash = null

    const PageFile = require('../views/convos.jsx')

    res.send()
  })

  /**
   * Get a channel's messages
   */
  app.get('/v1/api/channels/:channelAddress/messages', async (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info("== Get a channel's messages")
    logger.info('== GET: /v1/api/data/messages/:firstIndex')
    logger.info('======================================================================================\n')
    const { user } = req
    // pageNumber starts at Page 0;
    const { pageNumber: _pageNumber, pageSize: _pageSize } = req.query
    const { channelAddress } = req.params

    if (!gu.isWellFormedJupiterAddress(channelAddress)) {
      const error = new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)
      return res.status(StatusCode.ClientErrorBadRequest).send({ message: error.message, code: error.code })
    }

    // if (!gu.isWellFormedJupiterAddress(channelAddress)) {
    //     return res.status(StatusCode.ClientErrorBadRequest).send({message: `bad channel address: ${channelAddress}`})
    // }

    if (isNaN(_pageNumber)) {
      return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'pageNumber needs to be an integer' })
    }
    if (isNaN(_pageSize)) {
      return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'pageSize needs to be an integer' })
    }
    const pageNumber = parseInt(_pageNumber)
    const pageSize = parseInt(_pageSize)

    if (!(pageSize > 0 && pageSize < 1000)) {
      return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'pageSize can only be between 1 and 1000' })
    }
    if (pageNumber < 0) {
      return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'pageNumber needs to be more than 0' })
    }
    try {
      const firstIndex = pageNumber * pageSize
      const lastIndex = firstIndex + (pageSize - 1)
      const memberAccountProperties = instantiateMinimumGravityAccountProperties(
        user.passphrase,
        user.password,
        user.address
      )
      const channelAccountProperties =
        await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(
          memberAccountProperties,
          channelAddress
        )

      if (!channelAccountProperties) {
        return res
          .status(StatusCode.ServerErrorInternal)
          .send({ message: `channel is not available: ${channelAddress}` })
      }

      // @TODO this will be a big problem when channel has a lot of messages!!!!!!!
      const messageTransactions = await jupiterTransactionsService.getReadableTaggedMessageContainers(
        channelAccountProperties,
        messagesConfig.messageRecord,
        false,
        firstIndex,
        lastIndex
      )

      res.send(messageTransactions)
    } catch (error) {
      logger.error('Error getting messages:')
      logger.error(`${error}`)
      res.status(StatusCode.ServerErrorInternal).send({ message: 'Error getting messages' })
    }
  })

  /**
   * Send a message
   */
  app.post('/v1/api/channels/:channelAddress/messages', async (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('== Send a message')
    logger.info('== POST: /v1/api/data/messages')
    logger.info('======================================================================================')
    try {
      const { user } = req
      const {
        message,
        replyMessage,
        replyRecipientAlias,
        replyRecipientAddress,
        attachmentObj = null,
        version,
        mentions = [],
        messageType = 'message'
      } = req.body
      const { channelAddress } = req.params

      if (!(attachmentObj || message)) {
        // @todo throw exception. needs to be at lease one.
      }

      // @TODO
      // if(attachmentObj){
      //     validate(attachmentObj)
      // }

      if (!gu.isWellFormedJupiterAddress(channelAddress)) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'Must include a valid address' })
      }
      if (!message) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'Must include a valid message' })
      }
      if (!Array.isArray(mentions)) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'mentions should be an array' })
      }
      const mentionedAddresses = await mentions.reduce(async (reduced, mention) => {
        try {
          const inviteeAccountInfo = await jupiterAccountService.fetchAccountInfoFromAliasOrAddress(mention)
          const data = await reduced
          return [...data, inviteeAccountInfo.address]
        } catch (error) {
          return await reduced
        }
      }, Promise.resolve([]))

      const memberAccountProperties = user.gravityAccountProperties
      const messageRecord = generateNewMessageRecordJson(
        memberAccountProperties,
        message,
        messageType,
        replyMessage,
        replyRecipientAlias,
        replyRecipientAddress,
        attachmentObj,
        version
      )
      const channelAccountProperties =
        await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(
          memberAccountProperties,
          channelAddress
        )
      if (!channelAccountProperties) {
        return res
          .status(StatusCode.ClientErrorBadRequest)
          .send({ message: 'Invalid channel address.', code: MetisErrorCode.MetisError })
      }
      await createMessageRecord(
        memberAccountProperties,
        channelAccountProperties,
        message,
        messageType,
        replyMessage,
        replyRecipientAlias,
        replyRecipientAddress,
        attachmentObj,
        version
      )
      if (messageType === 'invitation') websocket.of('/chat').to(channelAddress).emit('newMemberChannel')
      websocket
        .of(websocketConstants.invitation.chat.namespace)
        .to(channelAddress)
        .emit(websocketConstants.invitation.chat.rooms.createMessage, { message: messageRecord })
      res.send({ message: 'Message successfully sent' })

      try {
        await sendMessagePushNotifications(memberAccountProperties, channelAccountProperties, mentionedAddresses)
      } catch (error) {
        logger.error('Error sending the push notification')
        logger.error(`${error}`)
      }
    } catch (error) {
      logger.error('Error sending metis message:')
      logger.error(JSON.stringify(error))
      return res
        .status(StatusCode.ServerErrorInternal)
        .send({ message: `Error sending message. ${error.message}`, code: error.code })
    }
  })

  /**
   * Get a user's invites
   */
  app.get('/v1/api/channel/invites', async (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('== Get user invites')
    logger.info('== GET: /v1/api/channel/invites')
    logger.info('======================================================================================')
    console.log('')
    try {
      if (!req.hasOwnProperty('user')) throw new mError.MetisError('req.user is not defined')
      if (!gu.isWellFormedPassphrase(req.user.passphrase)) {
        throw new mError.MetisErrorBadJupiterPassphrase('req.user.passphrase')
      }
      if (!gu.isStrongPassword(req.user.password)) throw new mError.MetisErrorWeakPassword('req.user.password')
      const memberAccountProperties = await instantiateGravityAccountProperties(req.user.passphrase, req.user.password)
      await chanService
        .getChannelInvitationContainersSentToAccount(memberAccountProperties)
        .then((channelInvitations) => {
          const payload = channelInvitations.map((channelInvitationContainer) => {
            return {
              invitationId: channelInvitationContainer.transactionId,
              channelName: channelInvitationContainer.message.channelRecord.channelName,
              channelAddress: channelInvitationContainer.message.channelRecord.address,
              inviterAddress: channelInvitationContainer.message.inviterAddress,
              inviterAlias: channelInvitationContainer.message.inviterAlias,
              invitationSentAt: channelInvitationContainer.message.createdAt
            }
          })
          res.send(payload)
        })
    } catch (error) {
      console.log(error)
      res.status(StatusCode.ServerErrorInternal).send({ message: 'Internal Error', code: error.code })
    }
  })

  /**
   * Send an invite
   */
  app.post('/v1/api/channel/invite', async (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('== Send An Invite')
    logger.info('== POST: api/channel/invite')
    logger.info('======================================================================================')
    console.log('')
    const { channelAddress, inviteeAddressOrAlias } = req.body
    const { user } = req
    if (!gu.isWellFormedJupiterAddress(channelAddress)) {
      return res
        .status(StatusCode.ClientErrorBadRequest)
        .send({ message: 'channelAddress is invalid', code: MetisErrorCode.MetisErrorBadJupiterAddress })
    }
    try {
      const inviterAccountProperties = user.gravityAccountProperties
      const inviteeAccountInfo = await jupiterAccountService.fetchAccountInfoFromAliasOrAddress(inviteeAddressOrAlias)
      const inviteeAddress = inviteeAccountInfo.address
      const inviteePublicKey = inviteeAccountInfo.publicKey
      const channelAccountProperties =
        await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(
          inviterAccountProperties,
          channelAddress
        )
      if (channelAccountProperties === null) {
        return res
          .status(StatusCode.ClientErrorUnauthorized)
          .send({ message: 'Channel is not accessible', code: MetisErrorCode.MetisError })
      }
      const newInvitation = await chanService.createInvitation(
        channelAccountProperties,
        inviterAccountProperties,
        inviteeAddress,
        inviteePublicKey
      )
      websocket.of('/invite').to(`${inviteeAddress}`).emit('newInvite')
      const inviterAlias = inviterAccountProperties.getCurrentAliasNameOrNull()
      const message = `${inviterAlias} invited you to join a channel`
      const metadata = { isInvitation: 'true' }
      await getPNTokensAndSendPushNotification([inviteeAddress], [], message, 'Invitation', metadata)
      console.log('\n')
      logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
      logger.info('++ INVITATION SENT')
      logger.info(`++ ${newInvitationCounter}`)
      logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n')
      newInvitationCounter = newInvitationCounter + 1
      return res.status(StatusCode.SuccessOK).send(newInvitation)
    } catch (error) {
      logger.error(`${error}`)
      console.log(error)
      res.status(StatusCode.ServerErrorInternal).send({ message: 'Internal Error', code: error.code })
    }
  })

  /**
   * Create a Channel, assigned to the current user
   */
  app.post('/v1/api/channel', async (req, res, next) => {
    console.log('\n\n\n')
    logger.info('======================================================================================')
    logger.info('== Create a Channel, assigned to the current user')
    logger.info("== app.post('/v1/api/channel')(req,res,next)")
    logger.info('======================================================================================\n\n\n')
    const startTime = Date.now()
    const { channelName } = req.body
    const memberAccountProperties = req.user.gravityAccountProperties
    // @TODO Check Funding First!
    if (!gu.isNonEmptyString(channelName)) {
      return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'Need channelName in body' })
    }
    const channelPassphrase = gu.generatePassphrase()
    const channelPassword = gu.generateRandomPassword()
    const channelAccountProperties = await instantiateGravityAccountProperties(channelPassphrase, channelPassword)
    channelAccountProperties.channelName = channelName
    const job = jobs
      .create('channel-creation-confirmation', { channelAccountProperties, memberAccountProperties })
      .priority('high')
      .removeOnComplete(false)
      .save((error) => {
        logger.verbose('---- JobQueue: channel-creation-confirmation.save(error)')
        logger.sensitive(`error= ${error}`)
        if (error) {
          websocket.of('/channels').to(memberAccountProperties.address).emit('channelCreationFailed', job.id)
          throw new Error('channel-creation-confirmation')
        }
        logger.verbose(`job.id= ${job.id}`)
        res.status(StatusCode.SuccessOK).send({
          channelAddress: channelAccountProperties.address,
          channelName: channelAccountProperties.channelName,
          channelPublicKey: channelAccountProperties.publicKey,
          channelAlias: channelAccountProperties.getCurrentAliasNameOrNull(),
          job: {
            id: job.id,
            createdAt: job.created_at,
            href: `/v1/api/job/status?jobId=${job.id}`
          }
        })
        websocket
          .of('/channels')
          .to(memberAccountProperties.address)
          .emit('channelCreated', { job, channelAddress: channelAccountProperties.address })
      })
    job.on('complete', function (result) {
      logger.verbose('---- JobQueue: channel-creation-confirmation.on(complete)')
      const endTime = Date.now()
      const processingTime = `${moment.duration(endTime - startTime).minutes()}:${moment
        .duration(endTime - startTime)
        .seconds()}`
      logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
      logger.info('++ Create a Channel')
      logger.info('++ Processing TIME')
      logger.info(`++ ${processingTime}`)
      logger.info('++ Counter')
      logger.info(`++ ${newChannelCounter}`)
      logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
      newChannelCounter = newChannelCounter + 1
      // const payload = {channelName: result.channelName, account: result.channelAccountProperties.address}
      websocket.of('/channels').to(memberAccountProperties.address).emit('channelSuccessful', {
        jobId: job.id,
        channelName: result.channelAccountProperties.channelName,
        channelAddress: result.channelAccountProperties.address
      })
    })
    job.on('failed attempt', function (errorMessage, doneAttempts) {
      logger.error('****************************************************************')
      logger.error('** JobQueue: channel-creation-confirmation.on(failed attempt))')
      logger.error('****************************************************************')
      logger.error(`channel name= ${channelName}`)
      logger.error(`channel address= ${channelAccountProperties.address}`)
      logger.error(`user address= ${memberAccountProperties.address}`)
      logger.error(`user alias= ${memberAccountProperties.getCurrentAliasNameOrNull()}`)
      logger.error(`error= ${errorMessage}`)
      logger.error(`doneAttempts= ${doneAttempts}`)
      websocket
        .of('/channels')
        .to(memberAccountProperties.address)
        .emit('channelCreationFailed', { jobId: job.id, channelAddress: channelAccountProperties.address })
    })

    job.on('failed', function (errorMessage) {
      logger.error('****************************************************************')
      logger.error('** JobQueue: channel-creation-confirmation.on(failed))')
      logger.error('****************************************************************')
      logger.error(`channel name= ${channelName}`)
      logger.error(`channel address= ${channelAccountProperties.address}`)
      logger.error(`user address= ${memberAccountProperties.address}`)
      logger.error(`user alias= ${memberAccountProperties.getCurrentAliasNameOrNull()}`)
      logger.error(`error= ${errorMessage}`)
      websocket
        .of('/channels')
        .to(memberAccountProperties.address)
        .emit('channelCreationFailed', { jobId: job.id, channelAddress: channelAccountProperties.address })
    })
  })

  /**
   * Get channel records associated with a user
   */
  app.get('/v1/api/channel/info/:channelAddress', async (req, res, next) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info("== Get a channel's messages")
    logger.info('== GET: /v1/api/channel/info/:channelAddress')
    logger.info('======================================================================================\n')
    const { channelAddress } = req.params

    if (!gu.isWellFormedJupiterAddress(channelAddress)) {
      const error = new mError.MetisErrorBadJupiterAddress(`channelAddress: ${channelAddress}`)
      return res.status(StatusCode.ClientErrorBadRequest).send({ message: error.message, code: error.code })
    }

    try {
      const memberAccountProperties = await instantiateGravityAccountProperties(req.user.passphrase, req.user.password)

      const channelAccountProperties =
        await chanService.getChannelAccountPropertiesOrNullFromChannelRecordAssociatedToMember(
          memberAccountProperties,
          channelAddress
        )

      if (!channelAccountProperties) {
        return res
          .status(StatusCode.ServerErrorInternal)
          .send({ message: `channel is not available: ${channelAddress}` })
      }

      const response = {
        channelAddress: channelAccountProperties.address,
        channelPublicKey: channelAccountProperties.publicKey,
        channelName: channelAccountProperties.channelName,
        createdBy: channelAccountProperties.createdBy,
        createdAt: channelAccountProperties.createdAt
      }

      res.send(response)
    } catch (error) {
      logger.error('Error getting messages:')
      logger.error(`${error}`)
      res.status(StatusCode.ServerErrorInternal).send({ message: 'Error getting messages' })
    }
  })
}
