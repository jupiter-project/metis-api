const { jupiterAPIService } = require('../../../services/jupiterAPIService')
const jupiterAccountService = require('../../../services/jupiterAccountService')
const gravityUtils = require('../../../utils/gravityUtils')
// const {Error} = require("../../../errors/metisError");
const { StatusCode } = require('../../../utils/statusCode')
const logger = require('../../../utils/logger')(module)
// const {MetisError} = require("../../../errors/metisError");
const mError = require('../../../errors/metisError')
const bcrypt = require('bcryptjs')

module.exports = (app, jobs, websocket, controllers) => {
  /**
   *
   */
  app.get('/v1/api/accounts/:accountAddress/aliases', controllers.aliasController.v1AliasesGet)

  /**
   * @deprecated
   */
  app.post('/v1/api/create-jupiter-account', async (req, res) => {
    logger.info(`\n\n`)
    logger.info('======================================================================================')
    logger.info('==')
    logger.info('== New Account Generation')
    logger.info('== POST: /v1/api/create-jupiter-account')
    logger.info('==')
    logger.info(`======================================================================================\n\n`)

    try {
      if (!req.body.account_data) {
        const error = new mError.MetisErrorBadRequestParams()
        return res.status(StatusCode.ClientErrorBadRequest).send({ message: 'missing account_data', code: error.code })
      }
      const accountData = req.body.account_data
      const passwordHash = bcrypt.hashSync(accountData.encryption_password, bcrypt.genSaltSync(8), null)
      const passphrase = accountData.passphrase
      const getAccountIdResponse = await jupiterAPIService.getAccountId(passphrase)
      const jupiterAccount = {
        account: getAccountIdResponse.data.accountRS,
        public_key: getAccountIdResponse.data.publicKey,
        alias: getAccountIdResponse.data.alias,
        accounthash: passwordHash,
        jup_account_id: getAccountIdResponse.data.account,
        email: accountData.email,
        firstname: accountData.firstname,
        lastname: accountData.lastname,
        twofa_enabled: accountData.twofa_enabled
      }
      if (getAccountIdResponse.data.accountRS === null) {
        return res.status(StatusCode.ServerErrorInternal).send({
          message: 'There was an error in saving the trasaction record',
          transaction: getAccountIdResponse.data
        })
      } else {
        return res.status(StatusCode.SuccessOK).send({ message: 'Jupiter account created', account: jupiterAccount })
      }
    } catch (error) {
      logger.error(`****************************************************************`)
      logger.error(`** /v1/api/create-jupiter-account.catch(error)`)
      console.log(error)
      if (error instanceof JupiterApiError) {
        return res.status(StatusCode.ServerErrorInternal).send({ message: `Internal Error`, code: error.code })
      }
      return res.status(StatusCode.ServerErrorInternal).send({
        message: `There was an error: ${error.response}`,
        code: error.code
      })
    }
  })

  /**
   * @deprecated
   */
  app.get('/create_passphrase', (req, res) => {
    const seedphrase = gravityUtils.generatePassphrase()
    res.send({
      success: true,
      result: seedphrase,
      message: 'Passphrase generated'
    })
  })
}
