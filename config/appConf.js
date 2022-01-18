// const gu = require("../utils/gravityUtils");
const mError = require("../errors/metisError");
const conf = {};
if(!process.env.NODE_ENV) throw new mError.MetisErrorBadEnvironmentVariable('','NODE_ENV');
// if(!process.env.NODE_OPTIONS) throw new mError.MetisErrorBadEnvironmentVariable('','NODE_OPTIONS');
// if(!process.env.NODE_RUN_SCRIPT) throw new mError.MetisErrorBadEnvironmentVariable('','NODE_RUN_SCRIPT');
if(!process.env.EMAIL) throw new mError.MetisErrorBadEnvironmentVariable('','EMAIL');
if(!process.env.APP_PORT) throw new mError.MetisErrorBadEnvironmentVariable('','APP_PORT');
conf.nodeEnvironmentOptions = {
    development: 'development',
    staging: 'staging',
    production: 'production',
    qa: 'qa',
}
// conf.nodeOptions = process.env.NODE_OPTIONS;
// conf.nodeRunScript = process.env.NODE_RUN_SCRIPT;
conf.email = process.env.EMAIL;
conf.port = process.env.APP_PORT;
conf.nodeEnvrionment = process.env.NODE_ENV;
if(!Object.values(conf.nodeEnvironmentOptions).includes(conf.nodeEnvrionment)){
    throw new mError.MetisErrorBadEnvironmentVariable(`Value is not valid ${conf.nodeEnvrionment}`,'NODE_ENV');
}
module.exports.appConf = conf;
