const { blockchainAccountVerificationService } = require('../../gravity/services/blockchainAccountVerificationService')
const { StatusCode } = require('../../../utils/statusCode')
const { MetisErrorCode } = require('../../../utils/metisErrorCode')
const gu = require('../../../utils/gravityUtils')
const { jupiterAPIService } = require('../../../services/jupiterAPIService')
const jwt = require('jsonwebtoken')
const { metisConf } = require('../../../config/metisConf')
const { GravityCrypto } = require('../../../services/gravityCrypto')
const mError = require("../../../errors/metisError");
const logger = require('../../../utils/logger')(module)

module.exports = (app, jobs, websocket, controllers) => {
  app.get('/v1/api/crypto/create-challenge/:blockchainAccountAddress', (req, res) => {
    const { blockchainAccountAddress } = req.params

    if (!blockchainAccountAddress) {
      return res.status(StatusCode.ClientErrorBadRequest).send({
        message: 'missing blockchainAccountAddress',
        code: StatusCode.ClientErrorBadRequest
      })
    }

    try {
      const challengeDigest = blockchainAccountVerificationService.generateChallenge(blockchainAccountAddress)
      return res.status(StatusCode.SuccessOK).send({ challengeDigest })
    } catch (error) {
      return res.status(StatusCode.ServerErrorInternal).send({
        message: 'Theres a problem getting the challenge',
        code: MetisErrorCode.MetisErrorFailedUserAuthentication
      })
    }
  })

  app.post('/v1/api/crypto/verify-signature', async (req, res, next) => {
    const { challengeDigest, signature, password, passphrase, publicKey, blockchainAccountAddress } = req.body

    if (!challengeDigest || !signature) {
      return res.status(StatusCode.ClientErrorBadRequest).send({
        message: 'challengeDigest and signature are required',
        code: StatusCode.ClientErrorNotFound
      })
    }

    if (!publicKey) {
      return res.status(StatusCode.ClientErrorBadRequest).send({
        message: 'Public key incorrect or missing',
        code: StatusCode.ClientErrorBadRequest
      })
    }

    if (!password || !passphrase) {
      return res.status(StatusCode.ClientErrorBadRequest).send({
        message: 'Password or passphrase are incorrect or missing',
        code: StatusCode.ClientErrorBadRequest
      })
    }

    if (!gu.isWellFormedPassphrase(passphrase)) {
      return res.status(StatusCode.ClientErrorBadRequest).send({
        message: 'Passphrase is not well formed',
        code: StatusCode.ClientErrorBadRequest
      })
    }

    const isVerified = blockchainAccountVerificationService.isVerified(challengeDigest, signature)
    req.verified = isVerified
    if (!isVerified) {
      return res.status(StatusCode.ServerErrorInternal).send({
        message: 'Signature not valid',
        code: MetisErrorCode.MetisErrorFailedUserAuthentication
      })
    }

    try {
      const { accountRS } = await jupiterAPIService.getAlias(blockchainAccountAddress)
      if (accountRS) {
        const jwtPrivateKeyBase64String = metisConf.jwt.privateKeyBase64
        const privateKeyBuffer = Buffer.from(jwtPrivateKeyBase64String, 'base64')
        const jwtCrypto = new GravityCrypto(metisConf.appPasswordAlgorithm, privateKeyBuffer)
        const jwtContent = {
          passphrase: passphrase,
          password: password,
          address: accountRS,
          publicKey: publicKey
        }
        const metisEncryptedJwtContent = jwtCrypto.encryptJsonGCM(jwtContent)
        const jwtPayload = {
          data: metisEncryptedJwtContent
        }
        const token = jwt.sign(jwtPayload, privateKeyBuffer, { expiresIn: metisConf.jwt.expiresIn })
        return res.status(StatusCode.SuccessOK).send({ token })
      }
    } catch (error) {
      logger.error(`****************************************************************`)
      logger.error(`** verify-signature().catch(error)`)
      logger.error(`****************************************************************`)
      logger.error(`error= ${error}`)

      if (error instanceof mError.MetisErrorUnknownAlias) {
        logger.debug('Creating new account...')
        controllers.cryptoLoginController.createAccount(req, res, next)
      } else {
        return res.status(StatusCode.ServerErrorInternal).send({
          message: 'Theres a problem with crypto login',
          code: MetisErrorCode.MetisErrorFailedUserAuthentication
        })
      }
    }
  })

  app.get('/v1/api/crypto/get-account/:blockchainAccountAddress', controllers.cryptoLoginController.loadAccount)

  app.post('/v1/api/crypto/create/account', controllers.cryptoLoginController.createAccount)
}
