const jwt = require('jsonwebtoken')
const { GravityCrypto } = require('../services/gravityCrypto')
const { StatusCode } = require('../utils/statusCode')
const { instantiateGravityAccountProperties } = require('../gravity/instantiateGravityAccountProperties')
const { metisConf } = require('../config/metisConf')
const logger = require('../utils/logger').default(module)

/**
 *
 * @param req
 * @param res
 * @param next
 * @return {*}
 */
const tokenVerify = (req, res, next) => {
  logger.verbose('#### tokenVerify(req, res, next)')
  const token = req.get('Authorization')
  const noAuthenticationRouteList = [
    '/create_passphrase',
    '/v1/api/create-jupiter-account',
    '/v1/api/appLogin',
    '/v2/api/login',
    '/v1/api/signup',
    '/metis/v2/api/signup',
    '/v1/api/get-jupiter-account',
    '/v1/api/jupiter/alias/',
    '/v1/api/version',
    '/v1/api/pn/badge-counter',
    '/v1/api/job/status',
    '/api-docs',
    '/jim/v1/api/ping',
    '/v1/api/crypto'
  ]

  // app.get('/v1/api/accounts/:accountAddress/aliases', async (req, res) => {
  const routeDoesntNeedAuthentication = noAuthenticationRouteList.filter((route) =>
    req.url.toLowerCase().startsWith(route.toLowerCase())
  )
  const regex = /^\/v1\/api\/accounts\/.+\/aliases$/
  if (regex.test(req.url.toLowerCase()) && req.method === 'GET') {
    logger.info('No Auth needed for getting aliases')
    return next()
  }
  if (routeDoesntNeedAuthentication.length > 0 || req.url === '/' || req.url.startsWith('/v1/api/pn/token')) {
    logger.debug('No Authentication Needed.')
    logger.info('Testing URL = ' + req.url)
    return next()
  }
  if (!token) {
    return res.status(StatusCode.ClientErrorUnauthorized).send({ message: 'Please provide a token' })
  }
  const _token = token.startsWith('Bearer') ? token.substring(7) : token
  const jwtPrivateKeyBase64String = metisConf.jwt.privateKeyBase64
  const privateKeyBuffer = Buffer.from(jwtPrivateKeyBase64String, 'base64')
  try {
    jwt.verify(_token, privateKeyBuffer, async (error, decodedToken) => {
      logger.debug('tokenVerify().verify(updatedToken, session, CALLBACK(err, decodedUser))')
      if (error) {
        logger.error('****************************************************************')
        logger.error('** tokenVerify.jwtVerify().callback(error)')
        logger.error('****************************************************************')
        console.log(error)
        return res.status(StatusCode.ClientErrorUnauthorized).send({ message: 'Not authorized to access' })
        // return next()
      }
      try {
        const metisCrypto = new GravityCrypto(metisConf.appPasswordAlgorithm, privateKeyBuffer)
        const jwtContent = metisCrypto.decryptAndParseGCM(decodedToken.data)
        req.user = {}
        req.user.gravityAccountProperties = await instantiateGravityAccountProperties(
          jwtContent.passphrase,
          jwtContent.password
        )

        // @TODO remove the following...
        req.user.address = req.user.gravityAccountProperties.address
        req.user.publicKey = req.user.gravityAccountProperties.publicKey
        req.user.passphrase = req.user.gravityAccountProperties.passphrase
        req.user.password = req.user.gravityAccountProperties.password
        return next()
      } catch (error) {
        logger.error('****************************************************************')
        logger.error('** tokenVerify.jwtVerify().callback().catch(error)')
        logger.error('****************************************************************')
        console.log(error)

        return res.status(StatusCode.ClientErrorUnauthorized).send({ message: 'Not authorized to access' })
        // return next();
      }
    })
  } catch (error) {
    console.log('\n')
    logger.error('************************* ERROR ***************************************')
    logger.error('* ** tokenVerify().catch(error)')
    logger.error('************************* ERROR ***************************************\n')
    console.log(error)
    res.status(StatusCode.ClientErrorUnauthorized).send({ message: 'Not authorized to access', code: error.code })
    // return next();
  }
}

module.exports = {
  tokenVerify
}
