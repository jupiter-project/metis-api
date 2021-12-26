const jwt = require('jsonwebtoken');
const {GravityCrypto} = require("../services/gravityCrypto");
const {StatusCode} = require("../utils/statusCode");
const {instantiateMinimumGravityAccountProperties, instantiateGravityAccountProperties} = require("../gravity/instantiateGravityAccountProperties");
const logger = require('../utils/logger')(module);

// ============================
//  Verificar Token
// ============================
const tokenVerify = (req, res, next) => {
  logger.verbose(`#### tokenVerify(req, res, next)`);
  const token = req.get('Authorization');
  const channelToken = req.get('AuthorizationChannel');
  const noAuthenticationRouteList = [
    '/create_passphrase',
    '/v1/api/create_jupiter_account',
    '/v1/api/appLogin',
    '/v1/api/signup',
    '/v1/api/get_jupiter_account',
    '/v1/api/jupiter/alias/',
    '/v1/api/version',
    '/v1/api/pn/badge_counter',
    '/v1/api/job/status',
    '/api-docs',
    '/jim/v1/api/ping',
    '/metis/v2/api/signup'
  ];
  const routeDoesntNeedAuthentication = noAuthenticationRouteList.filter(url => req.url.toLowerCase().startsWith(url.toLowerCase()));
  if (routeDoesntNeedAuthentication.length > 0 || req.url === '/' || req.url.startsWith('/v1/api/pn/token')) {
    return next();
  }
  if (!token) {
    return res.status(StatusCode.ClientErrorUnauthorized).send({ message: 'Please provide a token' });
  }
  const decodedChannel = channelToken ? jwt.decode(channelToken) : null;
  let updatedToken = token;
  if (token.startsWith('Bearer')) {
    updatedToken = updatedToken.substring(7);
  }
  jwt.verify(updatedToken, process.env.SESSION_SECRET, async (err, decodedToken) => {
    logger.debug('tokenVerify().verify(updatedToken, session, CALLBACK(err, decodedUser))');
    if (err) {
      logger.error(`****************************************************************`);
      logger.error(`** tokenVerify.jwtVerify().error`);
      logger.error(`****************************************************************`);
      console.log(err);
      const errorMessage = `${err}`;
      return res.status(401).send({message: errorMessage});
    }
    req.user = decodedToken;
    const crypto = new GravityCrypto(process.env.ENCRYPT_ALGORITHM, process.env.ENCRYPT_PASSWORD);
    req.user.passphrase = crypto.decrypt(decodedToken.accessKey);
    req.user.password = crypto.decrypt(decodedToken.encryptionKey) ;
    req.user.gravityAccountProperties = await instantiateGravityAccountProperties(
        req.user.passphrase,
        req.user.password
        )
    req.user.address = req.user.gravityAccountProperties.address;
    req.user.publicKey = req.user.gravityAccountProperties.publicKey;
    req.channel = decodedChannel;
    next();
  });
};

module.exports = {
  tokenVerify,
};
