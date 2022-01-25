import {jupiterAPIService} from "../../../services/jupiterAPIService";
import jupiterAccountService from "../../../services/jupiterAccountService";
import gravityUtils from "../../../utils/gravityUtils";
// import {Error} from "../../../errors/metisError";
const {StatusCode} = require("../../../utils/statusCode");
const logger = require('../../../utils/logger')(module);
// import {MetisError} from "../../../errors/metisError";
const mError = require('../../../errors/metisError');
const bcrypt = require("bcrypt-nodejs");

module.exports = (app, jobs, websocket, controllers) => {

    app.get('/v1/api/recent-transactions', (req, res, next) => {
        const address = req.user.gravityAccountProperties.address;
        res.redirect(`/v1/api/accounts/${address}/accounting/transactions`);
    })
    app.get('/v1/api/accounts/:address/accounting/transactions', controllers.financeController.v1AccountingTransactionsGet);

    app.get('/v1/api/balance', (req,res,next)=>{
        const address = req.user.gravityAccountProperties.address;
        res.redirect(`/v1/api/accounts/${address}/accounting/balance`);
    });
    app.get('/v1/api/accounts/:address/accounting/balance', controllers.financeController.v1BalanceGet);

    app.post('/v1/api/transfer-money', (req,res,next)=>{
        const address = req.user.gravityAccountProperties.address;
        res.redirect(`/v1/api/accounts/${address}/accounting/send`);
    });
    app.post('/v1/api/accounts/:address/accounting/send', controllers.financeController.v1TransferPost);

    app.get('/v1/api/accounts/:accountAddress/aliases', controllers.aliasController.v1AliasesGet);

    app.get('/create_passphrase', (req,res,next)=>{
        res.redirect(`/v1/api/generate-passphrase`);
    });
    app.get('/v1/api/generate-passphrase', controllers.defaultController.v1GeneratePassphraseGet);


}
