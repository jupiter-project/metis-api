const { join } = require('path');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const getApnOptions = () => ({
  pfx: join(__dirname, '../certificates', 'apn.p12'),
  passphrase: process.env.APN_PASSPHRASE,
  production: IS_PRODUCTION,
});

module.exports = {
  APN_OPTIONS: getApnOptions(),
  IS_PRODUCTION,
};
