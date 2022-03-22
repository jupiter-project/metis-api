// const jwt = require('jsonwebtoken');
// const {GravityCrypto} = require("../services/gravityCrypto");
const { StatusCode } = require('../utils/statusCode')
// const {instantiateMinimumGravityAccountProperties, instantiateGravityAccountProperties} = require("../gravity/instantiateGravityAccountProperties");
const { jupiterAPIService } = require('../services/jupiterAPIService')
const logger = require('../utils/logger')()
const mError = require('../errors/metisError')
const { appConf } = require('../config/appConf')
const { metisConf } = require('../config/metisConf')

module.exports.externalResourcesCheck = async (req, res, next) => {
  // @TODO enable once we get a jupiter.isAlive()
  return next()
  logger.verbose(`#### externalResourcesCheck(req, res, next)`)
  try {
    const jupiterState = await jupiterAPIService.getState()
    logger.info(`++ Jupiter Time: ${jupiterState.data.time}`)

    //@TODO CHECK MONGO
    //CHECK MONGO.
    return next()
  } catch (error) {
    console.log('\n')
    logger.error(`************************* ERROR ***************************************`)
    logger.error(`* ** ExternalResourcesCheck.catch(error)`)
    logger.error(`************************* ERROR ***************************************\n`)
    console.log(error)
    if (error instanceof mError.MetisErrorBadJupiterGateway) {
      //Send The Alert!
      const nodeEnvironment = appConf.nodeEnvrionment
      const notifyEmail = metisConf.email
      const appName = metisConf.appName
      const jupiterServerUrl = metisConf.appJupiterServerUrl
      // adminNotifier.notify(  ,'RED_ALERT' ); Includes Metis Server identification.
      logger.blast(`jupiter is down! jupiterUrl: ${jupiterServerUrl} `)
      return res
        .status(StatusCode.ServerErrorServiceUnavailable)
        .send({ message: 'Service not available', code: error.code })
    }
    return res
      .status(StatusCode.ServerErrorServiceUnavailable)
      .send({ message: 'Service not available', code: error.code })
  }
}
