const axios = require('axios')
const { gravity } = require('../config/gravity')
const controller = require('../config/controller')
const User = require('../models/user')
const { JupiterAPIService } = require('../services/jupiterAPIService')
const { FeeManager, feeManagerSingleton } = require('../services/FeeManager')
const { FundingManager, fundingManagerSingleton } = require('../services/fundingManager')
const { ApplicationAccountProperties } = require('../gravity/applicationAccountProperties')
const { instantiateGravityAccountProperties } = require('../gravity/instantiateGravityAccountProperties')

const logger = require('../utils/logger')(module)

module.exports = (app, passport) => {
  let page
  const connection = process.env.SOCKET_SERVER

  app.get('/v1/api/balance', (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('==')
    logger.info('== Get Balance')
    logger.info('== GET: ')
    logger.info('==')
    logger.info('======================================================================================')
    console.log('')

    const { user } = req

    if (!user.address) {
      return res.status(400).send({ message: 'User account not provided' })
    }

    const TRANSFER_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding)
    const ACCOUNT_CREATION_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction)
    const STANDARD_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction)
    const MINIMUM_TABLE_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table)
    const MINIMUM_APP_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user)
    const MONEY_DECIMALS = process.env.JUPITER_MONEY_DECIMALS
    const DEADLINE = process.env.JUPITER_DEADLINE

    //@TODO ApplicationAccountProperties class is obsolete. We need to switch to FeeManger and FundingManger
    const appAccountProperties = new ApplicationAccountProperties(
      DEADLINE,
      STANDARD_FEE,
      ACCOUNT_CREATION_FEE,
      TRANSFER_FEE,
      MINIMUM_TABLE_BALANCE,
      MINIMUM_APP_BALANCE,
      MONEY_DECIMALS
    )
    const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties)
    jupiterAPIService
      .getBalance(user.address)
      .then((response) => {
        if (response && response.data.unconfirmedBalanceNQT) {
          return res.status(200).send({ balance: response.data.unconfirmedBalanceNQT / 100000000 })
        }
        return res.status(500).send({ message: 'Balance not available' })
      })
      .catch((error) => {
        logger.error(`${error}`)
        return res.status(500).send({ message: 'Something went wrong', error: `${error}` })
      })
  })

  app.get('/v1/api/recent-transactions', (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('==')
    logger.info('== Recent Transactions')
    logger.info('== GET: ')
    logger.info('==')
    logger.info('======================================================================================')
    console.log('')

    const { user } = req

    if (!user.address) {
      return res.status(400).send({ message: 'User account not provided' })
    }

    const TRANSFER_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding)
    const ACCOUNT_CREATION_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction)
    const STANDARD_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction)
    const MINIMUM_TABLE_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table)
    const MINIMUM_APP_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user)
    const MONEY_DECIMALS = process.env.JUPITER_MONEY_DECIMALS
    const DEADLINE = process.env.JUPITER_DEADLINE

    const appAccountProperties = new ApplicationAccountProperties(
      DEADLINE,
      STANDARD_FEE,
      ACCOUNT_CREATION_FEE,
      TRANSFER_FEE,
      MINIMUM_TABLE_BALANCE,
      MINIMUM_APP_BALANCE,
      MONEY_DECIMALS
    )
    const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties)
    const params = {
      requestType: 'getBlockchainTransactions',
      account: user.address,
      type: 0, // TODO FIGURE OUT WHY TYPE IS STRING
      subtype: 0,
      firstIndex: 0,
      lastIndex: 9
    }

    //TODO make the "get" function static in order to avoid generating all unnecessary properties
    jupiterAPIService
      .get(params)
      .then((response) => {
        //TODO remove this line once filter by type = 0, subtype = 0
        const transactions = response.data.transactions.filter((txn) => txn.type === 0)
        return res.status(200).send({ transactions })
      })
      .catch((error) => {
        logger.error(`${error}`)
        return res.status(500).send({ message: 'Something went wrong', error: `${error}` })
      })
  })

  app.post('/v1/api/transfer-money', async (req, res) => {
    console.log('')
    logger.info('======================================================================================')
    logger.info('==')
    logger.info('== Transfer Money')
    logger.info('== POST: /v1/api/transfer-money')
    logger.info('==')
    logger.info('======================================================================================')
    console.log('')

    const { user } = req
    let { recipient, amount } = req.body

    if (!recipient.toLowerCase().includes('jup-')) {
      const aliasResponse = await gravity.getAlias(recipient)
      recipient = aliasResponse.accountRS
    }

    const TRANSFER_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding)
    const ACCOUNT_CREATION_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction)
    const STANDARD_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction)
    const MINIMUM_TABLE_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table)
    const MINIMUM_APP_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user)
    const MONEY_DECIMALS = process.env.JUPITER_MONEY_DECIMALS
    const DEADLINE = process.env.JUPITER_DEADLINE

    const appAccountProperties = new ApplicationAccountProperties(
      DEADLINE,
      STANDARD_FEE,
      ACCOUNT_CREATION_FEE,
      TRANSFER_FEE,
      MINIMUM_TABLE_BALANCE,
      MINIMUM_APP_BALANCE,
      MONEY_DECIMALS
    )
    const jupiterAPIService = new JupiterAPIService(process.env.JUPITERSERVER, appAccountProperties)
    const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction)
    // const fromJupAccount = { address: user.address, passphrase: user.passphrase };
    const fromJupAccount = await instantiateGravityAccountProperties(user.passphrase, user.password)
    const toJupiterAccount = { address: recipient }

    //TODO make the "transferMoney" function static in order to avoid generating all unnecessary properties
    jupiterAPIService
      .transferMoney(fromJupAccount, toJupiterAccount, +amount, fee)
      .then(() => res.status(200).send({ message: 'Transfer successfully executed' }))
      .catch((error) => {
        logger.error('Error with the transfer' + `${error}`)
        res
          .status(500)
          .send({ message: 'There was an issue transferring money, please try again later', error: `${error}` })
      })
  })
}
