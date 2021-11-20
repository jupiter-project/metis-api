const jwt = require('jsonwebtoken');
const {GravityCrypto} = require("../services/gravityCrypto");
const logger = require('../utils/logger')(module);

// ============================
//  Verificar Token
// ============================
const tokenVerify = (req, res, next) => {
  logger.debug(`tokenVerify(), URL:  ${req.url}`);
  const token = req.get('Authorization');
  const channelToken = req.get('AuthorizationChannel');
  const omittedUrls = [
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
  ];
  const valid = omittedUrls.filter(url => req.url.toLowerCase().startsWith(url.toLowerCase()));

  if (valid.length > 0 || req.url === '/' || req.url.startsWith('/v1/api/pn/token')) {
    return next();
  }

  if (!token) {
    return res.status(403).send({ success: false, message: 'Please provide a token' });
  }
  const decodedChannel = channelToken ? jwt.decode(channelToken) : null;

  let updatedToken = token;
  if (token.startsWith('Bearer')) {
    updatedToken = updatedToken.substring(7);
  }

  jwt.verify(updatedToken, process.env.SESSION_SECRET, (err, decodedUser) => {
    logger.debug('tokenVerify().verify()');
    if (err) {
      console.log(err);
      return res.status(401).json({
        ok: false,
        err,
      });
    }

    req.user = decodedUser;

    const crypto = new GravityCrypto(process.env.ENCRYPT_ALGORITHM, process.env.ENCRYPT_PASSWORD);
    const { passphrase, password } = crypto.decryptAndParseOrNull(decodedUser.accountData);

    req.user.passphrase = passphrase;
    req.user.password = password;
    req.channel = decodedChannel;
    next();
  });
};

module.exports = {
  tokenVerify,
};
