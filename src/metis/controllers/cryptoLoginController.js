const {
  createMessage,
  decrypt,
  decryptKey,
  encrypt,
  enums,
  generateKey,
  Message,
  PartialConfig,
  PublicKey,
  readKey,
  readMessage,
  readPrivateKey,
  WebStream
} = require('openpgp')
const { StatusCode } = require('../../../utils/statusCode')
const { jupiterAPIService } = require('../../../services/jupiterAPIService')
const mError = require('../../../errors/metisError')
require('jsonwebtoken')
const { instantiateGravityAccountProperties } = require('../../../gravity/instantiateGravityAccountProperties')
const gu = require('../../../utils/gravityUtils')
const { MetisErrorCode } = require('../../../utils/metisErrorCode')
const bcrypt = require('bcrypt-nodejs')
const moment = require('moment')
const { blockchainAccountVerificationService } = require('../../gravity/services/blockchainAccountVerificationService')
const { metisConf } = require('../../../config/metisConf')
const { GravityCrypto } = require('../../../services/gravityCrypto')
const jwt = require('jsonwebtoken')
const logger = require('../../../utils/logger')(module)
let counter = 1

const createJob = (jobs, newAccountProperties, newAccountAlias, res, websocket, subscriberId, next = () => {}) => {
  const startTime = Date.now()
  const namespace = '/sign-up'
  const room = `sign-up-${newAccountAlias}`
  const job = jobs
    .create('MetisJobRegisterJupiterAccount', {
      userAccountProperties: newAccountProperties,
      userAlias: newAccountAlias
    })
    .priority('high')
    .removeOnComplete(false)
    .save((error) => {
      logger.verbose('---- JobQueue: user-registration.save()')
      if (error) {
        logger.error('****************************************************************')
        logger.error('** job.catch(error)')
        logger.error('****************************************************************')
        logger.error(`${error}`)
        res.status(StatusCode.ServerErrorInternal).send({
          verified: true,
          message: 'Internal Error',
          jobId: job.id,
          code: MetisErrorCode.MetisError
        })
        return next()
      }
      logger.debug(`job.id= ${job.id}`)
      logger.debug(`job.created_at= ${job.created_at}`)
      const jobInfo = {
        id: job.id,
        createdAt: job.created_at,
        href: `/v1/api/job/status?jobId=${job.id}`
      }

      res.status(StatusCode.SuccessAccepted).send({
        verified: true,
        job: jobInfo,
        address: newAccountProperties.address
      })
      return next()
    })

  let contador = 0
  let complete = false

  if (!complete) {
    setInterval(() => {
      contador += 1
      websocket.of(namespace).to(room).emit('signUpProcess', {
        process: contador
      })
    }, 1500)
  }

  /**
   *
   */
  job.on('complete', function () {
    logger.verbose('---- job.on(complete(result))')
    logger.verbose(`alias= ${newAccountAlias}`)
    complete = true
    const endTime = Date.now()
    const processingTime = `${moment.duration(endTime - startTime).minutes()}:${moment
      .duration(endTime - startTime)
      .seconds()}`
    console.log('')
    logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
    logger.info('++ SIGNUP COMPLETE. Sending Websocket Event')
    logger.info('++ Processing TIME')
    logger.info(`++ ${processingTime}`)
    logger.info('++ Counter:')
    logger.info(`++ ${counter})`)
    logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n\n\n')
    counter = counter + 1

    const jwtPrivateKeyBase64String = metisConf.jwt.privateKeyBase64
    const privateKeyBuffer = Buffer.from(jwtPrivateKeyBase64String, 'base64')
    const jwtCrypto = new GravityCrypto(metisConf.appPasswordAlgorithm, privateKeyBuffer)
    const jwtContent = {
      passphrase: newAccountProperties.passphrase,
      password: newAccountProperties.password,
      address: newAccountProperties.address,
      publicKey: newAccountProperties.publicKey
    }
    const metisEncryptedJwtContent = jwtCrypto.encryptJsonGCM(jwtContent)
    const jwtPayload = {
      data: metisEncryptedJwtContent
    }
    const token = jwt.sign(jwtPayload, privateKeyBuffer, { expiresIn: metisConf.jwt.expiresIn })
    websocket.of(namespace).to(room).emit('signUpSuccessful', {
      createdAt: job.created_at,
      token,
      address: newAccountProperties.address,
      alias: newAccountAlias
    })
  })
  job.on('failed attempt', function (errorMessage, doneAttempts) {
    logger.error('***********************************************************************************')
    logger.error('** job.on(failed_attempt())')
    logger.error('***********************************************************************************')
    logger.error(`errorMessage= ${errorMessage}`)
    logger.error(`doneAttempts= ${doneAttempts}`)
    websocket
      .of(namespace)
      .to(room)
      .emit('signUpFailedAttempt', { message: `${errorMessage}` })
  })
  job.on('failed', function (errorMessage) {
    logger.error('***********************************************************************************')
    logger.error('** job.on(failed())')
    logger.error('***********************************************************************************')
    logger.error(`errorMessage= ${errorMessage}`)
    websocket
      .of(namespace)
      .to(room)
      .emit('signUpFailed', { message: `${errorMessage}` })
  })
}

module.exports = (app, jobs, websocket) => {
  return {
    loadAccount: async (req, res, next) => {
      const { blockchainAccountAddress } = req.params

      if (!blockchainAccountAddress) {
        return res.status(StatusCode.ClientErrorBadRequest).send({
          message: 'missing blockchainAccountAddress',
          code: MetisErrorCode.MetisErrorBadRequestParams
        })
      }
      const challengeDigest = blockchainAccountVerificationService.generateChallenge(blockchainAccountAddress)
      jupiterAPIService
        .getAlias(blockchainAccountAddress)
        .then((resp) => {
          return res.status(StatusCode.SuccessOK).send({
            account: resp.data,
            challenge: challengeDigest,
            blockchainAccountAddress
          })
        })
        .catch(async (error) => {
          if (error instanceof mError.MetisErrorUnknownAlias) {
            return res.status(StatusCode.ClientErrorNotFound).send({ challenge: challengeDigest })
          }
          return res.status(StatusCode.ServerErrorInternal).send({
            message: 'No account found',
            code: MetisErrorCode.MetisErrorFailedUserAuthentication
          })
        })
    },
    createAccount: async (req, res, next) => {
      const { passphrase, password, blockchainAccountAddress } = req.body

      if (!blockchainAccountAddress) {
        return res.status(StatusCode.ClientErrorBadRequest).send({
          message: 'Missing Blockchain account',
          code: StatusCode.ClientErrorBadRequest
        })
      }

      if (!passphrase || !password) {
        return res.status(StatusCode.ClientErrorBadRequest).send({
          message: 'Missing parameters',
          code: StatusCode.ClientErrorBadRequest
        })
      }

      const newAccountProperties = await instantiateGravityAccountProperties(passphrase, password)
      const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress
      gu.ipLogger(newAccountProperties.address, blockchainAccountAddress, ipAddress)
      createJob(jobs, newAccountProperties, blockchainAccountAddress, res, websocket, next)
    },

    generateKeyPairs: async (req, res, nexts) => {
      console.log('\n\n')
      logger.info('======================================================================================')
      logger.info('== POST: /v1/api/generate-keys ')
      logger.info('======================================================================================\n\n')
      // const ipLogger = function (jupAddress, alias, req) {
      const { address, passphrase } = req.body
      const { privateKey, publicKey } = await generateKey({
        userIDs: [{ name: address }],
        passphrase,
        type: 'rsa',
        rsaBits: 2048,
        curve: 'ed25519',
        config: {
          showVersion: true,
          preferredHashAlgorithm: enums.hash.sha256,
          preferredSymmetricAlgorithm: enums.symmetric.aes128,
          preferredCompressionAlgorithm: enums.compression.zlib
        }
      })

      res.json({ privateKey, publicKey })
    },

    createMsg: async (req, res) => {
      const { text } = req.body
      const data = await createMessage({ text })

      res.json(data)
    },

    encryptMessage: async (req, res) => {
      const { message, publicKeys } = req.body

      const data = await encrypt({
        message,
        encryptionKeys: publicKeys
      })

      res.json(data)
    },

    decryptMessage: async (req, res) => {
      const { armoredMessage, passphrase, privateKeyArmored } = req.body

      const privateKey = await this.decryptPrivateKey(passphrase, privateKeyArmored, {
        preferredHashAlgorithm: enums.hash.sha256,
        preferredSymmetricAlgorithm: enums.symmetric.aes128
      })
      const encryptedMessage = await this.readMsg(armoredMessage)
      const { data: decryptedMessage } = await decrypt({
        message: encryptedMessage,
        decryptionKeys: privateKey
      })

      const data = await decryptedMessage

      res.json(data)
    },

    decryptPrivateKey: async (req, res) => {
      const { passphrase, privateKeyArmored, config } = req.body

      const privateKey = await readPrivateKey({ armoredKey: privateKeyArmored, config })
      const data = await decryptKey({
        privateKey,
        passphrase
      })
      res.json(data)
    },

    read: async (req, res) => {
      const { armoredKey } = req.body
      const data = await readKey({ armoredKey })
      res.json(data)
    },

    readMsg: async (req, res) => {
      const { encryptedMessage } = req.body
      const data = await readMessage({
        armoredMessage: encryptedMessage
      })
      res.json(data)
    }
  }
}
