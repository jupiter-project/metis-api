require('dotenv').config();
const { S3StreamLogger } = require('s3-streamlogger');
const SlackHook = require('winston-slack-webhook-transport');
const winston = require('winston');
const path = require('path');
require('winston-mongodb');


const tsFormat = () =>{
  let today = new Date()
  return today.toISOString().split('T')[0]
};

const initializeConsoleTransport = (callingModule) =>{
    return new winston.transports.Console({
        level:'sensitive',
        colorize: true,
        timestamp: tsFormat,
        format: winston.format.combine(
            winston.format.printf(({ level, message, label, timestamp }) => {
              const callingModuleName = `${getLabel(callingModule)}`
              const paddedCallingModuleName = callingModuleName.padEnd(45, ' ');
              const output = `${paddedCallingModuleName}|${message}`
              return output
            }),
        ),
    })
}

const initializeSlackTransport = (callingModule)=>{
    const slackHookUrl = process.env.SLACK_HOOK;
    if(!slackHookUrl) return null;
    const debugLevel = process.env.SLACK_DEBUG_LEVEL;
    if(!debugLevel) return null;
    // console.log(slackHookUrl)
    return new SlackHook({
        level: debugLevel,
        webhookUrl: slackHookUrl,
        formatter: info => {
            return {
                text: 'this is a test',
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: 'mrkdwn',
                            text: `*METIS API NOTICE*\n ${info.message} \n server: ${process.env.APPNAME}`
                        }
                    }
                ]
            }
        }
    })

}

const getS3StreamTransport = () => {
  if (
    !!process.env.S3_STREAM_ENDPOINT
    && !!process.env.S3_STREAM_KEY
    && !!process.env.S3_STREAM_SECRET_KEY
  ) {
    const bucket = process.env.NODE_ENV === 'production'
      ? process.env.S3_STREAM_BUCKET_PROD
      : process.env.S3_STREAM_BUCKET_DEV;

    const s3Stream = new S3StreamLogger({
      bucket,
      config: {
        endpoint: process.env.S3_STREAM_ENDPOINT,
      },
      access_key_id: process.env.S3_STREAM_KEY,
      secret_access_key: process.env.S3_STREAM_SECRET_KEY,
      tags: {
        type: 'errorLogs',
        project: 'Metis',
      },
      rotate_every: 3600000, // each hour (default)
      max_file_size: 5120000, // 5mb
      upload_every: 20000, // 20 seconds (default)
    });

    // AWS transport files
    return new winston.transports.Stream({
      stream: s3Stream,
    });
  }
  return null;
};

const getMongoDBTransport = () => {
  if (process.env.URL_DB) {
    return new winston.transports.MongoDB({
      level: 'error',
      db: process.env.URL_DB,
      options: {
        useUnifiedTopology: true,
      },
      collection: 'metis-logs',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    });
  }
  return null;
};

const getLabel = (callingModule) => {
    if(!callingModule) return '';
  const parts = callingModule.filename.split(path.sep);
  return path.join(parts[parts.length - 2], parts.pop());
};


const generatePadding = (numberOfSpaces) => {
  if (numberOfSpaces>0){
    return Array(numberOfSpaces).join(' ');
  }
  return '';
}

const customLevels = {
  levels: {
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


const mongoDbTransport = getMongoDBTransport();
const s3Transport = getS3StreamTransport();
const transportList = [];
if (s3Transport) transportList.push(s3Transport)
if (mongoDbTransport && process.env.NODE_ENV === 'production') transportList.push(mongoDbTransport)

if (process.env.LOCAL_DEBUG_LEVEL) {
  const localFileDebugLevel = process.env.LOCAL_DEBUG_LEVEL;
  transportList.push(
      new winston.transports.File({
        filename: 'metis-api.log',
        level: localFileDebugLevel
      })
  )
}
if (process.env.LOCAL_DEBUG_LEVEL) {
  const consoleDebugLevel = process.env.LOCAL_DEBUG_LEVEL;
  transportList.push(
      new winston.transports.Console({
        level: consoleDebugLevel
      })
  )
} else {
  transportList.push(
      new winston.transports.Console({
        level: 'debug',
        timestamp: tsFormat
      })
  )
}

const localDevLogger = (callingModule) => {
  const transports = [];
  transports.push(initializeConsoleTransport(callingModule));
  const slackTransport = initializeSlackTransport(callingModule);
  if(slackTransport){
      transports.push(slackTransport)
  }
  return winston.createLogger({
    levels: customLevels.levels,
    transports: transports,
  });
}

const productionLogger = (callingModule) => {
  const PADDING_DEFAULT = 48;
  return winston.createLogger({
    levels: customLevels.levels,
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.timestamp({format: 'MM-DD HH:mm:ss'}),
        winston.format.label({label:'*'}),
        winston.format.align(),
        winston.format.simple(),
        winston.format.printf(({ level, message, label, timestamp }) => {
          const pre = `${label}${timestamp}|${level}|${getLabel(callingModule)}|`
          const spacing = (pre.length > PADDING_DEFAULT)? 0 : PADDING_DEFAULT - pre.length
          const padding = generatePadding(spacing);
          const output = `${pre}${padding}${message}`
          return output
        }),
    ),
    transports: transportList,
  });
}

const stagingLogger = (callingModule) => {
  const PADDING_DEFAULT = 48;
  return winston.createLogger({
    levels: customLevels.levels,
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.timestamp({format: 'MM-DD HH:mm:ss'}),
        winston.format.label({label:'*'}),
        winston.format.align(),
        winston.format.simple(),
        winston.format.printf(({ level, message, label, timestamp }) => {

          const pre = `${label}${timestamp}|${level}|${getLabel(callingModule)}|`
          const spacing = (pre.length > PADDING_DEFAULT)? 0 : PADDING_DEFAULT - pre.length
          const padding = generatePadding(spacing);
          const output = `${pre}${padding}${message}`

          return output
        }),
    ),
    transports: transportList,
  });
}


module.exports = function (callingModule) {
  if(process.env.NODE_ENV === 'development') return localDevLogger(callingModule)
  if( process.env.NODE_ENV === 'staging' ) return stagingLogger(callingModule)
  return productionLogger(callingModule);
};
