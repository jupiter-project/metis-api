const jwt = require('jsonwebtoken');
const {GravityCrypto} = require("../services/gravityCrypto");
const {StatusCode} = require("../utils/statusCode");
const {instantiateMinimumGravityAccountProperties, instantiateGravityAccountProperties} = require("../gravity/instantiateGravityAccountProperties");
const {jupiterAPIService} = require("../services/jupiterAPIService");
const logger = require('../utils/logger')();
const mError = require("../errors/metisError");

module.exports.externalResourcesCheck =  async (req, res, next) => {
    logger.verbose(`#### externalResourcesCheck(req, res, next)`);
    try {
        // const jupiterState = await jupiterAPIService.getState();
        // logger.info(`++ Jupiter Time: ${jupiterState.data.time}`);
        return next();
    } catch(error){
        console.log('\n')
        logger.error(`************************* ERROR ***************************************`);
        logger.error(`* ** ExternalResourcesCheck.catch(error)`);
        logger.error(`************************* ERROR ***************************************\n`);
        console.log(error);
        if( error instanceof mError.MetisErrorBadJupiterGateway){
            //Send The Alert!
            const nodeEnvironment = process.env.NODE_ENV;
            const notifyEmail = process.env.EMAIL;
            const appName = process.env.APPNAME;
            const jupiterServerUrl = process.env.JUPITERSERVER;
            // adminNotifier.notify(  ,'RED_ALERT' ); Includes Metis Server identification.
            logger.blast(`jupiter is down! jupiterUrl: ${jupiterServerUrl} `)
            return res.status(StatusCode.ServerErrorServiceUnavailable).send({ message: 'Service not available', code: error.code });
        }
        return res.status(StatusCode.ServerErrorServiceUnavailable).send({ message: 'Service not available', code: error.code });
    }

};
