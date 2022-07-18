// const gu = require("../utils/gravityUtils");
const mError = require('../errors/metisError')
if (!process.env.MONGO_DB_URI) throw new mError.MetisErrorBadEnvironmentVariable('', 'MONGO_DB_URI')
// if(!process.env.MONGO_HOST) throw new mError.MetisErrorBadEnvironmentVariable('','MONGO_HOST');
// if(!process.env.MONGO_PORT) throw new mError.MetisErrorBadEnvironmentVariable('','MONGO_PORT');
// if(!process.env.MONGO_DB_NAME) throw new mError.MetisErrorBadEnvironmentVariable('','MONGO_DB_NAME');
// if(!process.env.MONGO_CONNECTION_FORMAT) throw new mError.MetisErrorBadEnvironmentVariable('','MONGO_CONNECTION_FORMAT');
// if(!process.env.MONGO_USER) throw new mError.MetisErrorBadEnvironmentVariable('','MONGO_USER');
// if(!process.env.MONGO_PASSWORD) throw new mError.MetisErrorBadEnvironmentVariable('','MONGO_PASSWORD');
// if(!process.env.MONGO_QUERY_STRING) throw new mError.MetisErrorBadEnvironmentVariable('','MONGO_QUERY_STRING');

module.exports.mongoConf = {
  dbUri: process.env.MONGO_DB_URI
  // host: process.env.MONGO_HOST,
  // port: process.env.MONGO_PORT,
  // name: process.env.MONGO_DB_NAME,
  // connectionFormat: process.env.MONGO_CONNECTION_FORMAT,
  // user: process.env.MONGO_USER,
  // password: process.env.MONGO_PASSWORD,
  // queryString: process.env.MONGO_QUERY_STRING,
}
