const { jupiterAPIService } = require('../../../services/jupiterAPIService')
const { StatusCode } = require('../../../utils/statusCode')
const logger = require('../../../utils/logger')(module)

module.exports = (app, jobs, websocket) => {
  app.get('/v1/api/version', (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('==')
    logger.info('== Get Version')
    logger.info('== GET: /v1/api/version')
    logger.info('==')
    logger.info('======================================================================================')
    console.log('')
    jupiterAPIService
      .getBlockchainStatus()
      .then((response) => {
        const version = [
          { name: 'Metis App Version', version: '1.1.2' },
          { name: 'Metis Server Version', version: process.env.VERSION },
          {
            name: 'Jupiter Network',
            version: response.data.isTestnet ? 'testnet' : 'prod'
          },
          { name: 'Jupiter Version', version: response.data.version }
        ]
        console.log(`\n`)
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
        logger.info(`++ version`)
        logger.info(`++ ${JSON.stringify(version)}`)
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n')
        res.status(StatusCode.SuccessOK).send(version)
      })
      .catch((error) => {
        console.log(error)
        res.status(StatusCode.ServerErrorInternal).send({
          message: 'There was an error getting jupiter version',
          code: error.code
        })
      })
  })
}
