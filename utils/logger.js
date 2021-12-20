require('dotenv').config();
const { S3StreamLogger } = require('s3-streamlogger');
const winston = require('winston');
require('winston-mongodb');
const path = require('path');
const { hasJsonStructure } = require('../utils/utils');
const { isJson, isArray } = require('../utils/utils');

const tsFormat = () =>{
  let today = new Date()
  return today.toISOString().split('T')[0]
};

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
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
    sensitive: 5,
    insane: 6
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'white',
    verbose: 'green',
    debug: 'blue',
    sensitive: 'blue',
    insane: 'yellow'
  }
};

// Mongo DB transport
const mongoDbTransport = getMongoDBTransport();
const s3Transport = getS3StreamTransport();
// Transport list Array
const transportList = [];
if (process.env.LOCAL_FILE_DEBUG_LEVEL) {
  const localFileDebugLevel = process.env.LOCAL_FILE_DEBUG_LEVEL;
  transportList.push(
      new winston.transports.File({
        filename: 'metis-api.log',
        level: localFileDebugLevel
      })
  )
}
if (process.env.CONSOLE_DEBUG_LEVEL) {
  const consoleDebugLevel = process.env.CONSOLE_DEBUG_LEVEL;
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
if (s3Transport) {
  transportList.push(s3Transport);
}
if (mongoDbTransport && process.env.NODE_ENV === 'production') {
  transportList.push(mongoDbTransport);
}

const localDevLogger = (callingModule) => {
  const transports = [];
  transports.push(new winston.transports.Console({level:'sensitive', timestamp: tsFormat}));
  return winston.createLogger({
    levels: customLevels.levels,
    format: winston.format.combine(
        // winston.format.timestamp({format: 'HH:mm'}),
        winston.format.printf(({ level, message, label, timestamp }) => {
          const callingModuleName = `${getLabel(callingModule)}`
          const paddedCallingModuleName = callingModuleName.padEnd(45, ' ');
          const output = `${paddedCallingModuleName}|${message}`
          return output
        }),
    ),
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
  if(process.env.NODE_ENV === 'development'){
    return localDevLogger(callingModule);
  } else if( process.env.NODE_ENV === 'staging' ){
    return stagingLogger(callingModule);
  }
  return productionLogger(callingModule);
};
