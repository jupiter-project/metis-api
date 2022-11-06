/* eslint-disable no-undef */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: ()=>_default
});
require("dotenv/config.js");
const _path = require("path");
const _winston = require("winston");
require("winston-mongodb");
const _appConf = require("../config/appConf");
const _loggerConf = require("../config/loggerConf");
/**
 *
 * @param level
 * @return {*}
 */ const includeOnlyOneLevel = (level)=>{
    return (0, _winston.format)((info, opts)=>{
        // if(!levels.includes(info.level)) return false
        if (info.level !== level) return false;
        return info;
    })();
};
const includeAllExceptOneLevel = (levelToExclude)=>{
    return (0, _winston.format)((info, opts)=>{
        if (info.level === levelToExclude) return false;
        return info;
    })();
};
/**
 *
 * @return {string}
 */ const tsFormat = ()=>{
    const today = new Date();
    return today.toISOString().split('T')[0];
};
const LEVEL_FILTER_TYPE = {
    includeOnlyOne: 'includeOnlyOne',
    includeAllExceptOne: 'includeAllExceptOne',
    none: ''
};
/**
 *
 * @param callingModule
 * @param level
 * @return {Console}
 */ const initializeConsoleTransport = (callingModule, level = _loggerConf.loggerConf.levels.names.error, levelFilterType = '')=>{
    const formats = [];
    formats.push(_winston.format.timestamp({
        format: 'YYYY-MM-DD-HHmmss'
    }));
    if (levelFilterType === 'includeOnlyOne') {
        formats.push(includeOnlyOneLevel(level));
    } else if (levelFilterType === 'includeAllExceptOne') {
        formats.push(includeAllExceptOneLevel(level));
    }
    formats.push(_winston.format.printf((info)=>{
        const callingModuleName = `${getLabel(callingModule)}`;
        const paddedCallingModuleName = callingModuleName.padEnd(45, ' ');
        const paddedLevel = info.level.padEnd(10);
        return `${info.timestamp}|${paddedLevel}|${paddedCallingModuleName}|${info.message}`;
    }));
    return new _winston.transports.Console({
        level,
        colorize: true,
        format: _winston.format.combine(...formats)
    });
};
const initializeFileTransport = (callingModule = '', fileName, level = _loggerConf.loggerConf.levels.names.error, levelFilterType = '')=>{
    const formats = [];
    formats.push(_winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }));
    if (levelFilterType === 'includeOnlyOne') {
        formats.push(includeOnlyOneLevel(level));
    } else if (levelFilterType === 'includeAllExceptOne') {
        formats.push(includeAllExceptOneLevel(level));
    }
    formats.push(_winston.format.printf((info)=>{
        let callingModuleName = `${getLabel(callingModule)}`;
        callingModuleName = callingModuleName.padEnd(45, ' ');
        return `[${info.timestamp}][${info.level}]${callingModuleName}|${info.message}`;
    }));
    return new _winston.transports.File({
        filename: fileName,
        level,
        colorize: true,
        timestamp: tsFormat,
        format: _winston.format.combine(...formats)
    });
};
/**
 *
 * @param callingModule
 * @return {string}
 */ const getLabel = (callingModule)=>{
    if (!callingModule) return '';
    const parts = callingModule.filename.split(_path.sep);
    return (0, _path.join)(parts[parts.length - 2], parts.pop());
};
/**
 *
 * @param callingModule
 * @return {*}
 */ const serverDevLogger = (callingModule)=>{
    const transports = [];
    transports.push(initializeFileTransport(callingModule, _loggerConf.loggerConf.errorLogFilePath, _loggerConf.loggerConf.levels.names.error, LEVEL_FILTER_TYPE.includeOnlyOne));
    transports.push(initializeFileTransport(callingModule, _loggerConf.loggerConf.combinedLogFilePath, _loggerConf.loggerConf.defaultLevel, LEVEL_FILTER_TYPE.none));
    transports.push(initializeConsoleTransport(callingModule, _loggerConf.loggerConf.defaultLevel, LEVEL_FILTER_TYPE.none));
    return (0, _winston.createLogger)({
        levels: _loggerConf.loggerConf.levels.ids,
        transports
    });
};
const localDevLogger = (callingModule)=>{
    const transports = [];
    transports.push(initializeConsoleTransport(callingModule, _loggerConf.loggerConf.defaultLevel, LEVEL_FILTER_TYPE.none));
    return (0, _winston.createLogger)({
        levels: _loggerConf.loggerConf.levels.ids,
        transports
    });
};
/**
 *
 * @param callingModule
 * @return {*}
 */ const productionLogger = (callingModule)=>{
    const transports = [];
    transports.push(initializeFileTransport(callingModule, _loggerConf.loggerConf.errorLogFilePath, _loggerConf.loggerConf.levels.names.error, LEVEL_FILTER_TYPE.includeOnlyOne));
    transports.push(initializeFileTransport(callingModule, _loggerConf.loggerConf.combinedLogFilePath, _loggerConf.loggerConf.defaultLevel, LEVEL_FILTER_TYPE.none));
    transports.push(initializeConsoleTransport(callingModule, _loggerConf.loggerConf.defaultLevel, LEVEL_FILTER_TYPE.none));
    return (0, _winston.createLogger)({
        levels: _loggerConf.loggerConf.levels.ids,
        transports
    });
};
/**
 *
 * @param callingModule
 * @return {*}
 */ const noLogger = ()=>{
    const transports = [];
    return (0, _winston.createLogger)({
        levels: _loggerConf.loggerConf.levels.ids,
        transports
    });
};
function _default(callingModule) {
    if (!_loggerConf.loggerConf.isEnabled) return noLogger();
    if (_appConf.appConf.nodeEnvrionment === _appConf.appConf.nodeEnvironmentOptions.localDev) return localDevLogger(callingModule);
    if (_appConf.appConf.nodeEnvrionment === _appConf.appConf.nodeEnvironmentOptions.serverDev) return serverDevLogger(callingModule);
    if (_appConf.appConf.nodeEnvrionment === _appConf.appConf.nodeEnvironmentOptions.qa) return serverDevLogger(callingModule);
    if (_appConf.appConf.nodeEnvrionment === _appConf.appConf.nodeEnvironmentOptions.production) return productionLogger(callingModule);
    return noLogger(callingModule);
}
