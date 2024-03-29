const mError = require('../../../errors/metisError')
const { chanService } = require('../../../services/chanService')
const { jupiterAccountService } = require('../../../services/jupiterAccountService')
const gu = require('../../../utils/gravityUtils')
const { StatusCode } = require('../../../utils/statusCode')
const logger = require('../../../utils/logger')(module)

module.exports = (app, jobs, websocket) => {
  /**
   *
   */
  app.put('/v1/api/users/:userAddress/e2e-public-keys', async (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('== Add Publickey')
    logger.info('== PUT: /v1/api/public-keys')
    logger.info('======================================================================================')
    console.log('')
    try {
      const { e2ePublicKey } = req.body
      const userAddress = req.params.userAddress
      if (!e2ePublicKey) {
        const error = new mError.MetisErrorBadJupiterPublicKey(`userPublicKey: ${e2ePublicKey}`)
        logger.error(`${error}`)
        return res
          .status(StatusCode.ClientErrorBadRequest)
          .send({ message: 'User public key is required', code: error.code })
      }
      const userProperties = req.user.gravityAccountProperties
      if (!(userProperties.address === userAddress)) {
        logger.error(
          `The userAddress is not the same as currently logged in user userAddress: ${userAddress}, currently: ${userProperties.address}`
        )
        return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'bad user address' })
      }

      await jupiterAccountService.addE2EPublicKeyToJupiterAccount(e2ePublicKey, userProperties)
      await chanService.updateAllMemberChannelsWithNewE2EPublicKey(e2ePublicKey, userProperties)

      res.status(StatusCode.SuccessOK).send({ message: 'Public key was successfully added' })
    } catch (error) {
      if (error instanceof mError.MetisErrorPublicKeyExists) {
        return res.status(StatusCode.SuccessAlreadyReported).send({ message: 'Publickey was already entered' })
      }
      console.log('\n')
      logger.error(`************************* ERROR ***************************************`)
      logger.error(`* ** PUT: /v1/api/publicKey catch(error)`)
      logger.error(`************************* ERROR ***************************************\n`)
      console.log(error)
      res.status(StatusCode.ServerErrorInternal).send({ message: `Problem adding publicKey` })
    }
  })

  app.get('/v1/api/users/:userAddress/e2e-public-keys', async (req, res) => {
    res.status(StatusCode.ClientErrorImATeapot).send({ message: 'NEEDS TO BE IMPLEMENTED' })
  })
}
