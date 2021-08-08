const jwt = require('jsonwebtoken');

// ============================
//  Verificar Token
// ============================
const tokenVerify = (req, res, next) => {
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
    '/v1/api/jim/file'
  ];
  const valid = omittedUrls.filter(url => req.url.toLowerCase().startsWith(url.toLowerCase()));

  if (valid.length > 0 || req.url === '/') {
    return next();
  }
  const decodedChannel = channelToken ? jwt.decode(channelToken) : null;

  jwt.verify(token, process.env.SESSION_SECRET, (err, decodedUser) => {
    if (err) {
      console.log(err);
      return res.status(401).json({
        ok: false,
        err,
      });
    }
    req.user = decodedUser;
    req.channel = decodedChannel;
    next();
  });
};

module.exports = {
  tokenVerify,
};
