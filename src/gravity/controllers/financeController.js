import {StatusCode} from "../../../utils/statusCode";
import {JupiterAPIService, jupiterAPIService} from "../../../services/jupiterAPIService";
import {FeeManager, feeManagerSingleton} from "../../../services/FeeManager";
import {FundingManager, fundingManagerSingleton} from "../../../services/fundingManager";
import {
    ApplicationAccountProperties,
    metisApplicationAccountProperties
} from "../../../gravity/applicationAccountProperties";
import {instantiateGravityAccountProperties} from "../../../gravity/instantiateGravityAccountProperties";
import jupiterAccountService from "../../../services/jupiterAccountService";
import {jupiterTransactionsService} from "../../../services/jupiterTransactionsService";
import {transactionConstants} from "../constants/transactionContants";
const logger = require('../../../utils/logger')(module);
// const gu = require('../../../utils/gravityUtils');
// const mError = require("../../../errors/metisError");

module.exports = (app, jobs, websocket) => {
    return {

        v1AccountingTransactionsGet: async(req,res) => {
            const userAccountProperties = req.user.gravityAccountProperties;
            try {
                const transactions = await jupiterTransactionsService.fetchTransactions(
                    userAccountProperties.address,
                    transactionConstants.type.payment.value, //type=0
                    null,
                    null,
                    true,
                    0,
                    9,
                )
                return res.status(StatusCode.SuccessOK).send({transactions});
            }catch(error){
                console.log('\n')
                logger.error(`************************* ERROR ***************************************`);
                logger.error(`* ** v1AccountingTransactionsGet().catch(error)`);
                logger.error(`************************* ERROR ***************************************\n`);
                logger.error(`error= ${error}`);
                console.log(error);
                return res.status(StatusCode.ServerErrorInternal).send({message: error.message, code: error.code});
            }
        },

        v1TransferPost: async(req,res) => {
            try {
                const fromAccountProperties = req.user.gravityAccountProperties;
                let {recipient: recipientAliasOrAddress, amount} = req.body;
                const recipientAccountInfo = await jupiterAccountService.fetchAccountInfoFromAliasOrAddress(recipientAliasOrAddress);
                const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
                const toJupiterAccount = {address: recipientAccountInfo.address};
                const transferMoneyResponse = await jupiterAPIService.transferMoney(fromAccountProperties, toJupiterAccount, +amount, fee);
                return res.status(StatusCode.SuccessOK).send({message: 'Transfer successfully executed'});
            } catch (error ) {
                console.log('\n')
                logger.error(`************************* ERROR ***************************************`);
                logger.error(`* ** v1TransferPost().catch(error)`);
                logger.error(`************************* ERROR ***************************************\n`);
                logger.error(`error= ${error}`)
                return res.status(StatusCode.ServerErrorInternal).send({message: 'Transfer failed', error: `${error}`, code: error.code});
            }
        },

        v1BalanceGet: async (req,res) => {
            logger.verbose(`#### v1BalanceGet()`);
            try {
                const userAccountProperties = req.user.gravityAccountProperties;
                const getBalanceResponse = await jupiterAPIService.getBalance(userAccountProperties.address);
                if (getBalanceResponse && getBalanceResponse.data.unconfirmedBalanceNQT) {
                    return res.status(StatusCode.SuccessOK).send({balance: (response.data.unconfirmedBalanceNQT / 100000000)});
                }
                return res.status(StatusCode.ServerErrorInternal).send({message: 'Balance not available'});
            } catch(error){
                console.log('\n')
                logger.error(`************************* ERROR ***************************************`);
                logger.error(`* ** v1BalanceGet().catch(error)`);
                logger.error(`************************* ERROR ***************************************\n`);
                logger.error(`error= ${error}`);
                return res.status(StatusCode.ServerErrorInternal).send({message: 'Something went wrong', error: `${error}` });
            }
        },

        v1AliasesGet: async (req, res) => {
            console.log('');
            logger.info('======================================================================================');
            logger.info('== v1AliasesGet()');
            logger.info('======================================================================================');
            console.log('');
            try {
                const {accountAddress} = req.params
                const response = await jupiterAPIService.getAliases(accountAddress);
                return res.status(StatusCode.SuccessOK).send(response.data);
            } catch (error) {
                logger.error(`${error}`);
                res.status(StatusCode.ServerErrorInternal).send({
                    message: 'There was an error getting aliases from jupiter',
                    code: error.code
                });
            }
        }
    }
}
