require('dotenv').config()
const winston = require('winston')
const path = require('path')
require('winston-mongodb')
const { loggerConf } = require('../config/loggerConf')
const { appConf } = require('../config/appConf')

/**
 *
 * @param level
 * @return {*}
 */
const includeOnlyOneLevel = (level) => {
  return winston.format((info, opts) => {
    // if(!levels.includes(info.level)) return false
    if (info.level !== level) return false
    return info
  })()
}

const includeAllExceptOneLevel = (levelToExclude) => {
  return winston.format((info, opts) => {
    if (info.level === levelToExclude) return false
    return info
  })()
}

/**
 *
 * @return {string}
 */
const tsFormat = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

const LEVEL_FILTER_TYPE = {
  includeOnlyOne: 'includeOnlyOne',
  includeAllExceptOne: 'includeAllExceptOne',
  none: ''
}

/**
 *
 * @param callingModule
 * @param level
 * @return {Console}
 */
const initializeConsoleTransport = (callingModule, level = loggerConf.levels.names.error, levelFilterType = '') => {
  const formats = []
  formats.push(winston.format.timestamp({ format: 'YYYY-MM-DD-HHmmss' }))
  if (levelFilterType === 'includeOnlyOne') {
    formats.push(includeOnlyOneLevel(level))
  } else if (levelFilterType === 'includeAllExceptOne') {
    formats.push(includeAllExceptOneLevel(level))
  }
  formats.push(
    winston.format.printf((info) => {
      const callingModuleName = `${getLabel(callingModule)}`
      const paddedCallingModuleName = callingModuleName.padEnd(45, ' ')
      const paddedLevel = info.level.padEnd(10)
      return `${info.timestamp}|${paddedLevel}|${paddedCallingModuleName}|${info.message}`
    })
  )

  return new winston.transports.Console({
    level: level,
    colorize: true,
    format: winston.format.combine(...formats)
  })
}

const initializeFileTransport = (
  callingModule = '',
  fileName,
  level = loggerConf.levels.names.error,
  levelFilterType = ''
) => {
  const formats = []
  formats.push(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }))
  if (levelFilterType === 'includeOnlyOne') {
    formats.push(includeOnlyOneLevel(level))
  } else if (levelFilterType === 'includeAllExceptOne') {
    formats.push(includeAllExceptOneLevel(level))
  }
  formats.push(
    winston.format.printf((info) => {
      let callingModuleName = `${getLabel(callingModule)}`
      callingModuleName = callingModuleName.padEnd(45, ' ')
      return `[${info.timestamp}][${info.level}]${callingModuleName}|${info.message}`
    })
  )

  return new winston.transports.File({
    filename: fileName,
    level: level,
    colorize: true,
    timestamp: tsFormat,
    format: winston.format.combine(...formats)
  })
}

/**
 *
 * @param callingModule
 * @return {string}
 */
const getLabel = (callingModule) => {
  if (!callingModule) return ''
  const parts = callingModule.filename.split(path.sep)
  return path.join(parts[parts.length - 2], parts.pop())
}

/**
 *
 * @param callingModule
 * @return {*}
 */
const serverDevLogger = (callingModule) => {
  const transports = []
  transports.push(
    initializeFileTransport(
      callingModule,
      loggerConf.errorLogFilePath,
      loggerConf.levels.names.error,
      LEVEL_FILTER_TYPE.includeOnlyOne
    )
  )
  transports.push(
    initializeFileTransport(
      callingModule,
      loggerConf.combinedLogFilePath,
      loggerConf.defaultLevel,
      LEVEL_FILTER_TYPE.none
    )
  )
  transports.push(initializeConsoleTransport(callingModule, loggerConf.defaultLevel, LEVEL_FILTER_TYPE.none))
  return winston.createLogger({
    levels: loggerConf.levels.ids,
    transports: transports
  })
}

const localDevLogger = (callingModule) => {
  const transports = []
  transports.push(initializeConsoleTransport(callingModule, loggerConf.defaultLevel, LEVEL_FILTER_TYPE.none))
  return winston.createLogger({
    levels: loggerConf.levels.ids,
    transports: transports
  })
}

/**
 *
 * @param callingModule
 * @return {*}
 */
const productionLogger = (callingModule) => {
  const transports = []
  transports.push(
    initializeFileTransport(
      callingModule,
      loggerConf.errorLogFilePath,
      loggerConf.levels.names.error,
      LEVEL_FILTER_TYPE.includeOnlyOne
    )
  )
  transports.push(
    initializeFileTransport(
      callingModule,
      loggerConf.combinedLogFilePath,
      loggerConf.defaultLevel,
      LEVEL_FILTER_TYPE.none
    )
  )
  transports.push(initializeConsoleTransport(callingModule, loggerConf.defaultLevel, LEVEL_FILTER_TYPE.none))
  return winston.createLogger({
    levels: loggerConf.levels.ids,
    transports: transports
  })
}

/**
 *
 * @param callingModule
 * @return {*}
 */
const noLogger = () => {
  const transports = []
  return winston.createLogger({
    levels: loggerConf.levels.ids,
    transports: transports
  })
}

module.exports = function (callingModule) {
  if (!loggerConf.isEnabled) return noLogger()
  if (appConf.nodeEnvrionment === appConf.nodeEnvironmentOptions.localDev) return localDevLogger(callingModule)
  if (appConf.nodeEnvrionment === appConf.nodeEnvironmentOptions.serverDev) return serverDevLogger(callingModule)
  if (appConf.nodeEnvrionment === appConf.nodeEnvironmentOptions.qa) return serverDevLogger(callingModule)
  if (appConf.nodeEnvrionment === appConf.nodeEnvironmentOptions.production) return productionLogger(callingModule)
  return noLogger(callingModule)
}
