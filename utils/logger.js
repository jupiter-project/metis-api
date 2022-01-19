require('dotenv').config();
const { S3StreamLogger } = require('s3-streamlogger');
const SlackHook = require('winston-slack-webhook-transport');
const winston = require('winston');
const path = require('path');
require('winston-mongodb');
const {loggerConf} = require("../config/loggerConf");
const {metisConf} = require("../config/metisConf");
const {mongoConf} = require("../config/mongoConf");
const {appConf} = require("../config/appConf");


/**
 *
 * @param level
 * @return {*}
 */
const levelFilter = (level) => {
    return winston.format((info, opts) => {
        if (info.level != level) { return false; }
        return info;
    })();
}


/**
 *
 * @return {string}
 */
const tsFormat = () =>{
  let today = new Date()
  return today.toISOString().split('T')[0]
};

/**
 *
 * @param callingModule
 * @param level
 * @return {Console}
 */
const initializeConsoleTransport = (callingModule, level = 'sensitive') =>{
    return new winston.transports.Console({
        level:level,
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

/**
 *
 * @param callingModule
 * @return {null|*}
 */
const initializeSlackTransport = (callingModule)=>{
    if(!loggerConf.hasSlackTransport) return null;
    return new SlackHook({
        level: loggerConf.slackTransportLevel,
        webhookUrl: loggerConf.slackHook,
        formatter: info => {
            return {
                text: 'this is a test',
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: 'mrkdwn',
                            text: `*METIS API NOTICE*\n ${info.message} \n server: ${metisConf.appName}`
                        }
                    }
                ]
            }
        }
    })
}

/**
 *
 * @return {null|Stream}
 */
// const initializeS3StreamTransport = () => {
//
//     console.log(`\n`);
//     console.log('=-=-=-=-=-=-=-=-=-=-=-=-= _REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
//     console.log(`loggerConf:`);
//     console.log(loggerConf);
//     console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME_ =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n`)
//
//
//     if(!loggerConf.hasS3Option) return null;
//     // const s3Conf = loggerConf.s3Stream;
//     // const bucket = loggerConf.s3Stream.bucket;
//     if(s3Conf.option !== 1) return null;
//     const s3Stream = new S3StreamLogger({
//         loggerConf.s3Stream.bucket,
//       config: {
//         endpoint: loggerConf.s3Stream.endpoint,
//       },
//       access_key_id: loggerConf.s3Stream.key,
//       secret_access_key: loggerConf.s3Stream.secrect,
//       tags: {
//         type: 'errorLogs',
//         project: 'Metis',
//       },
//       rotate_every: loggerConf.s3Stream.rotateEvery,
//       max_file_size: loggerConf.s3Stream.maxFileSize,
//       upload_every: loggerConf.s3Stream.uploadEvery,
//     });
//     return new winston.transports.Stream({stream: s3Stream});
// };

/**
 *
 * @return {null|winston.transports.MongoDB}
 */
const initializeMongoDBTransport = () => {
  if (!mongoConf.dbUri) return null;
        return new winston.transports.MongoDB({
          level: 'error',
          db: mongoConf.dbUri,
          options: {
            useUnifiedTopology: true,
          },
          collection: 'metis-logs',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),}
    );
};


// new winston.transports.File({
//     filename: 'metis-api.log',
//     level: localFileDebugLevel
// })

const initializeFileTransport = (callingModule, filName, level = 'sensitive', justTheLevel = false) =>{
    const formats = [];
    const format1 = winston.format.printf(({ level, message, label, timestamp }) => {
        const callingModuleName = `${getLabel(callingModule)}`
        return `[${level}][${label}][${timestamp}]${callingModuleName}|${message}`;
    })
    formats.push(format1)
    if(justTheLevel){
        formats.push(levelFilter(level))
    }
    return new winston.transports.File({
        filename: filName,
        level:level,
        colorize: true,
        timestamp: tsFormat,
        format: winston.format.combine(...formats),
    })
}

/**
 *
 * @param callingModule
 * @return {string}
 */
const getLabel = (callingModule) => {
    if(!callingModule) return '';
  const parts = callingModule.filename.split(path.sep);
  return path.join(parts[parts.length - 2], parts.pop());
};

const localDevLogger = (callingModule) => {
    const transports = [];
  // const errorFileTransport =  initializeFileTransport(callingModule, 'metis.log','error', true);
    transports.push(initializeFileTransport(callingModule, 'metis.log','sensitive', false));
    transports.push(initializeFileTransport(callingModule, 'metis.errors','error', true));
    transports.push(initializeConsoleTransport(callingModule, 'sensitive'));
    transports.push(initializeSlackTransport(callingModule))
  return winston.createLogger({
    levels: loggerConf.levels.ids,
    transports: transports,
  });
}

/**
 *
 * @param callingModule
 * @return {*}
 */
const productionLogger = (callingModule) => {
    const transports = [];
    return winston.createLogger({
        levels: loggerConf.levels.ids,
        format: winston.format.combine(
            winston.format.splat(),
            winston.format.timestamp({format: 'MM-DD HH:mm:ss'}),
            winston.format.label({label:'*'}),
            winston.format.align(),
            winston.format.simple(),
            winston.format.printf(({ level, message, label, timestamp }) => {
              const pre = `${label}${timestamp}|${level}|${getLabel(callingModule)}|`
              const output = `${pre}${message}`
              return output
            }),
    ),
    transports: transports,
  });
}

/**
 *
 * @param callingModule
 * @return {*}
 */
const stagingLogger = (callingModule) => {
    const transports = [];
    return winston.createLogger({
        levels: loggerConf.levels.ids,
        format: winston.format.combine(
            winston.format.splat(),
            winston.format.timestamp({format: 'MM-DD HH:mm:ss'}),
            winston.format.label({label:'*'}),
            winston.format.align(),
            winston.format.simple(),
            winston.format.printf(({ level, message, label, timestamp }) => {
              const pre = `${label}${timestamp}|${level}|${getLabel(callingModule)}|`
              const output = `${pre}${message}`
              return output
            }),
        ),
        transports: transports,
    });
}

/**
 *
 * @param callingModule
 * @return {*}
 */
const noLogger = (callingModule) => {
    const transports = [];
    return winston.createLogger({
        levels: loggerConf.levels.ids,
        transports: transports,
    });
}

module.exports = function (callingModule) {
    if(!loggerConf.isEnabled) return noLogger(callingModule);
    if(appConf.nodeEnvrionment === appConf.nodeEnvironmentOptions.development) return localDevLogger(callingModule)
    if( appConf.nodeEnvrionment === appConf.nodeEnvironmentOptions.staging ) return stagingLogger(callingModule)
    return productionLogger(callingModule);
};
