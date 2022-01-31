const { join } = require('path');
const {appConf} = require("./appConf");

const IS_PRODUCTION = appConf.isProduction;
// const IS_PRODUCTION = (appConf.nodeEnvironmentOptions.production === appConf.nodeEnvrionment);
// const IS_PRODUCTION = ['qa', 'staging', 'production'].includes(process.env.NODE_ENV);

const getApnOptions = () => ({
  pfx: Buffer.from(process.env.P12_CERT, 'base64'),
  // pfx: join(__dirname, '../certificates', 'apn.p12'),
  passphrase: process.env.APN_PASSPHRASE,
  production: IS_PRODUCTION,
});

module.exports = {
  APN_OPTIONS: getApnOptions(),
  IS_PRODUCTION,
};
