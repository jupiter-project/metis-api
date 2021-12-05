const jwt = require('jsonwebtoken');
const {GravityCrypto} = require("../services/gravityCrypto");
const logger = require('../utils/logger')(module);

// ============================
//  Verificar Token
// ============================
const tokenVerify = (req, res, next) => {
  logger.verbose(`###################################################################################`);
  logger.verbose(`## tokenVerify(req, res, next)`);
  logger.verbose(`## `);

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
    logger.debug('tokenVerify().verify(updatedToken, session, CALLBACK(err, decodedUser))');
    if (err) {
      logger.error(`****************************************************************`);
      logger.error(`** tokenVerify.jwtVerify().error`);
      console.log(err);
      const errorMessage = `${err}`;

      return res.status(401).send(errorMessage);
    }

    req.user = decodedUser;
    const crypto = new GravityCrypto(process.env.ENCRYPT_ALGORITHM, process.env.ENCRYPT_PASSWORD);
    // const decryptedAccountData = crypto.decryptAndParse(decodedUser.accountData);
    req.user.passphrase = crypto.decrypt(decodedUser.accessKey);
    req.user.password = crypto.decrypt(decodedUser.encryptionKey) ;
    req.user.address = crypto.decrypt(decodedUser.account);
    req.user.publicKey = decodedUser.publicKey;
    req.channel = decodedChannel;

    // req.user.passphrase = decryptedAccountData.passphrase;
    // req.user.password = decryptedAccountData.encryptionPassword;
    // req.user.address = decryptedAccountData.account;
    // req.user.publicKey = decryptedAccountData.publicKey;
    // req.user.decryptedAccountData = decryptedAccountData
    // req.channel = decodedChannel;

    next();
  });
};

module.exports = {
  tokenVerify,
};
