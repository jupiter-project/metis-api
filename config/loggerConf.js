// dotenv loads all the variables from your .env file into process.env as string
const mError = require("../errors/metisError");
const dotenvUtils = require("../utils/dovenvUtils");
const NODE_ENV_OPTIONS = {
    PRODUCTION: 'production',
    SERVER_DEV: 'development',
    LOCAL_DEV: 'development'
}
const conf = {};

conf.levels = {
    names: {
        blast: 'blast',
        info: 'info',
        warn: 'warn',
        error: 'error',
        debug: 'debug',
        verbose: 'verbose',
        sensitive: 'sensitive',
        insane: 'insane'
    },
    ids: {
        blast: 1,
        info: 2,
        warn: 3,
        error: 4,
        debug: 5,
        verbose: 6,
        sensitive: 7,
        insane: 8
    },
    colors: {
        blast: 'red',
        error: 'red',
        warn: 'yellow',
        info: 'white',
        verbose: 'green',
        debug: 'blue',
        sensitive: 'blue',
        insane: 'yellow'
    }
};
if(!process.env.NODE_ENV) throw new mError.MetisErrorBadEnvironmentVariable('','NODE_ENV');
conf.nodeEnvrionment = process.env.NODE_ENV;
// if(!process.env.LOGGING_ENABLED) throw new mError.MetisErrorBadEnvironmentVariable('Needs to be 0 or 1','LOGGING_ENABLED');
conf.isEnabled = dotenvUtils.convertToBooleanOrFail(process.env.LOGGING_ENABLED);
if(!process.env.LOGGING_DEFAULT_LEVEL) throw new mError.MetisErrorBadEnvironmentVariable('','LOGGING_DEFAULT_LEVEL');
conf.defaultLevel =  process.env.LOGGING_DEFAULT_LEVEL;
if(conf.nodeEnvrionment === NODE_ENV_OPTIONS.PRODUCTION){
    if([conf.levels.name.insane, conf.levels.name.sensitive].includes(conf.defaultLevel)){
        throw new mError.MetisErrorBadEnvironmentVariable(`Production cannot have level ${conf.defaultLevel}`);
    }
}
conf.hasSlackTransport = false;
if(process.env.LOGGING_SLACK_TRANSPORT_LEVEL && process.env.LOGGING_SLACK_HOOK){
    conf.slackTransportLevel = process.env.LOGGING_SLACK_TRANSPORT_LEVEL;
    conf.slackHook = process.env.LOGGING_SLACK_HOOK;
    conf.hasSlackTransport = true;
}
conf.hasS3Option = dotenvUtils.convertToBooleanOrFail(process.env.S3_OPTION);
if(conf.hasS3Option){
    s3 = {};
    if(!process.env.S3_ENDPOINT) throw new Error(`Environment variable not configured properly: S3_ENDPOINT`)
    if(!process.env.S3_STREAM_KEY) throw new Error(`Environment variable not configured properly: S3_STREAM_KEY`)
    if(!process.env.S3_STREAM_SECRET_KEY) throw new Error(`Environment variable not configured properly: S3_STREAM_SECRET_KEY`)
    s3.endpoint = process.env.S3_ENDPOINT
    s3.key = process.env.S3_STREAM_KEY
    s3.secrect = process.env.S3_STREAM_SECRET_KEY
    if(conf.nodeEnvrionment === NODE_ENV_OPTIONS.PRODUCTION){
        if(!process.env.S3_BUCKET_PROD) throw new Error(`Environment variable not configured properly: S3_BUCKET_PROD`)
        s3.bucket = process.env.S3_BUCKET_PROD;
    } else {
        if(!process.env.S3_BUCKET_DEV) throw new Error(`Environment variable not configured properly: S3_BUCKET_DEV`)
        s3.bucket = process.env.S3_BUCKET_DEV;
    }
    s3.rotateEvery = 3600000// each hour (default)
    s3.maxFileSize = 5120000 // 5mb
    s3.uploadEvery = 20000 // 20 seconds (default)
    conf.hasS3Option = true;
    conf.s3Stream = s3;
}
module.exports.loggerConf = conf;
