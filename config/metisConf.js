// const gu = require("../utils/gravityUtils");
if(!process.env.APPNAME) throw new Error('Environment Variable missing: APPNAME');
if(!process.env.VERSION) throw new Error('Environment Variable missing: VERSION');
if(!process.env.APP_ACCOUNT) throw new Error('Environment Variable missing: APP_ACCOUNT');
// if(!gu.isWellFormedPassphrase(process.env.APP_ACCOUNT)) throw new Error('Environment Variable APP_ACCOUNT is not well formed');
if(!process.env.ENCRYPT_PASSWORD) throw new Error('Environment Variable missing: ENCRYPT_PASSWORD');
// if(!gu.isStrongPassword(process.env.ENCRYPT_PASSWORD)) throw new Error('Environment Var  ENCRYPT_PASSWORD is not strong');
if(!process.env.ENCRYPT_ALGORITHM) throw new Error('Environment Variable missing: ENCRYPT_ALGORITHM');
if(!process.env.APP_ACCOUNT_HASH) throw new Error('Environment Variable missing: APP_ACCOUNT_HASH');
if(!process.env.APP_ACCOUNT_ADDRESS) throw new Error('Environment Variable missing: APP_ACCOUNT_ADDRESS');
// if(!gu.isWellFormedJupiterAddress(process.env.APP_ACCOUNT_ADDRESS)) throw new Error('Environment Variable APP_ACCOUNT_ADDRESS is not well formed');
if(!process.env.APP_PUBLIC_KEY) throw new Error('Environment Variable missing: APP_PUBLIC_KEY');
// if(!gu.isWellFormedPublicKey(process.env.APP_PUBLIC_KEY)) throw new Error('Environment Variable APP_PUBLIC_KEY is not well formed');
if(!process.env.APP_ACCOUNT_ID) throw new Error('Environment Variable missing: APP_ACCOUNT_ID');
if(!process.env.JUPITERSERVER) throw new Error('Environment Variable missing: JUPITERSERVER');
if(!process.env.APP_EMAIL) throw new Error('Environment Variable missing: APP_EMAIL');
if(!process.env.JWT_TOKEN_EXPIRATION) throw new Error('Environment Variable missing: JWT_TOKEN_EXPIRATION');
if(!process.env.JWT_PRIVATE_KEY_BASE64) throw new Error('Environment Variable missing: JWT_PRIVATE_KEY_BASE64');
if(!process.env.JUPITER_DEADLINE) throw new Error('Environment Variable missing: JUPITER_DEADLINE');

module.exports.metisConf = {
    appName: process.env.APPNAME,
    appVersion: process.env.VERSION,
    appPassphrase: process.env.APP_ACCOUNT,
    appPassword: process.env.ENCRYPT_PASSWORD,
    appPasswordHash: process.env.APP_ACCOUNT_HASH,
    appPasswordAlgorithm: process.env.ENCRYPT_ALGORITHM,
    appAddress: process.env.APP_ACCOUNT_ADDRESS,
    appPublicKey: process.env.APP_PUBLIC_KEY,
    appAccountId: process.env.APP_ACCOUNT_ID,
    appJupiterServerUrl: process.env.JUPITERSERVER,
    appEmail: process.env.APP_EMAIL,
    jwt: {
        privateKeyBase64: process.env.JWT_PRIVATE_KEY_BASE64,
        expiresIn: process.env.JWT_TOKEN_EXPIRATION
    },
    jupiter: {
        deadline: process.env.JUPITER_DEADLINE
    }
}
