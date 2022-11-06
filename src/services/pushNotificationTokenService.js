const {
  findMutedChannels,
  updateBadgeCounter,
  findOneNotificationAndUpdate,
  findOneNotificationAndRemovePNToken,
  upsertNotificationDocumentWithNewToken
} = require('./notificationService')
// const {BadJupiterAddressError} = require("../errors/metisError");
const { StatusCode } = require('../utils/statusCode')
const gu = require('../utils/gravityUtils')
const logger = require('../utils/logger').default(module)

module.exports = {
  /**
   *
   * @param req
   * @param res
   * @return {Promise<*>}
   */
  addTokenNotification: async (req, res) => {
    try {
      const { token, jupId: userAddress, provider } = req.body
      logger.debug(`[addTokenNotification]->Token: ${token}`)
      if (!gu.isWellFormedJupiterAddress(userAddress)) {
        const message = { message: `JupId is not valid: ${userAddress}` }
        logger.error(`${message}`)
        return res.status(StatusCode.ClientErrorBadRequest).json(message)
      }

      if (!(provider && token)) {
        const message = { message: 'Token, Provider and JupId are required' }
        logger.error(`${message}`)
        return res.status(StatusCode.ClientErrorBadRequest).json(message)
      }

      const notification = await upsertNotificationDocumentWithNewToken(userAddress, provider, token)

      return res.json(notification)
    } catch (error) {
      const message = { message: 'Problem with addTokenNotification' }
      logger.error(`${error}`)

      return res.status(StatusCode.ServerErrorInternal).json(message)
    }
  },
  deleteTokenPushNotification: (req, res) => {
    const { jupId, provider, token } = req.params

    if (!(jupId && provider && token)) {
      const error = {
        success: false,
        message: 'Token, Provider and JupId are required'
      }
      logger.error(`${error}`)
      return res.status(400).json(error)
    }

    const filter = { userAddress: jupId }

    findOneNotificationAndRemovePNToken(filter, provider, token)
      .then(() => res.json({ success: true }))
      .catch((error) => {
        logger.error(`${error}`)
        res.status(500).json({ ok: false, error })
      })
  },
  editMutedChannels: (req, res) => {
    const { address: userAddress } = req.user
    const { channelAddress, isMuted } = req.body

    if (!channelAddress) {
      return res.status(400).json({ message: 'Alias and Channel id are required.' })
    }

    const filter = { userAddress }
    const update = isMuted
      ? { $pull: { mutedChannelAddressList: channelAddress } }
      : { $push: { mutedChannelAddressList: channelAddress } }

    findOneNotificationAndUpdate(filter, update)
      .then((notification) => res.json({ success: true, notification }))
      .catch((error) => {
        logger.error(`${error}`)
        res.status(400).json({ ok: false, error })
      })
  },
  findMutedChannels: (req, res) => {
    const { address: userAddress } = req.user

    if (!userAddress) {
      return res.status(400).json({ message: 'Alias is required.' })
    }

    findMutedChannels(userAddress)
      .then(([response]) => {
        const { mutedChannelAddressList } = response || { mutedChannelAddressList: [] }
        res.json({
          success: true,
          mutedChannelAddressList
        })
      })
      .catch((error) => {
        logger.error(`${error}`)
        res.status(500).json({ ok: false, error })
      })
  },
  setBadgePnCounter: (req, res) => {
    const { userAddress, badge } = req.body

    if (!userAddress) {
      const error = {
        ok: false,
        error: 'bad request',
        message: 'userAddress id are required.'
      }
      logger.error(`${error}`)
      return res.status(400).json(error)
    }

    updateBadgeCounter(userAddress, badge || 0)
      .then((response) => res.json({ success: true, response }))
      .catch((error) => {
        res.status(500).json(error)
      })
  }
}
