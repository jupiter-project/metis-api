const jwt = require('jsonwebtoken');

// ============================
//  Verificar Token
// ============================
const tokenVerify = (req, res, next) => {
  const token = req.get('Authorization');
  const omitedUrls = [
    '/appLogin',
    '/signup',
    '/get_jupiter_account',
    '/jupiter/alias/',
  ];

  const valid = omitedUrls.map(url =>
    url.toLowerCase() === req.url.toLowerCase() ||
    req.url.toLowerCase().startsWith(url.toLowerCase())
  );


  if (valid.length > 0) {
    return next();
  }

  jwt.verify(token, process.env.SESSION_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).json({
        ok: false,
        err,
      });
    }
    req.userInfo = decoded.userInfo;
    next();
  });
};

module.exports = {
  tokenVerify,
};
