import bcrypt from 'bcrypt-nodejs';
import {StatusCode} from "../../../utils/statusCode";
import {jupiterAPIService} from "../../../services/jupiterAPIService";
import {gravityUtils} from "../../../utils/gravityUtils";
const logger = require('../../../utils/logger')(module);
const gu = require('../../../utils/gravityUtils');
const mError = require("../../../errors/metisError");

module.exports = (app, jobs, websocket) => {
    return {
        /**
         * @deprecated Dont use this anymore!
         * @param req
         * @param res
         * @return {Promise<*>}
         */
        v1GenerateAccountPost: async (req,res)=> {
            logger.verbose(`#### v1GenerateAccountPost: async (req,res)`);
            try {
                if (!req.body.account_data) {
                    const error = new mError.MetisErrorBadRequestParams();
                    return res.status(StatusCode.ClientErrorBadRequest).send({message: 'missing account_data', code: error.code});
                }
                const accountData = req.body.account_data;

                console.log(`\n`);
                console.log('=-=-=-=-=-=-=-=-=-=-=-=-= _REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
                console.log(`accountData:`);
                console.log(accountData);
                console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME_ =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n`)


                if(!gu.isWellFormedPassphrase(accountData.passphrase)) throw new mError.MetisErrorBadJupiterPassphrase(`accountData.passphrase`)
                if(!accountData.encryption_password) throw new mError.MetisError(`accountData.encryption_password is missing`);
                // const accountData = req.body.account_data;
                const passwordHash = bcrypt.hashSync(accountData.encryption_password, bcrypt.genSaltSync(8), null);
                const passphrase = accountData.passphrase;
                const getAccountIdResponse = await jupiterAPIService.getAccountId(passphrase);
                const jupiterAccount = {
                    account: getAccountIdResponse.data.accountRS,
                    public_key: getAccountIdResponse.data.publicKey,
                    alias: getAccountIdResponse.data.alias,
                    accounthash: passwordHash,
                    jup_account_id: getAccountIdResponse.data.account,
                    email: accountData.email,
                    firstname: accountData.firstname,
                    lastname: accountData.lastname,
                    twofa_enabled: accountData.twofa_enabled,
                };
                if (getAccountIdResponse.data.accountRS === null) {
                    return res.status(StatusCode.ServerErrorInternal).send({
                        message: 'There was an error in generating the account',
                        transaction: getAccountIdResponse.data
                    });
                }
                return res.status(StatusCode.SuccessOK).send({message: 'Jupiter account created', account: jupiterAccount});
            } catch (error) {
                console.log('\n')
                logger.error(`************************* ERROR ***************************************`);
                logger.error(`* ** fuv1GenerateAccountPost: async (req,res).catch(error)`);
                logger.error(`************************* ERROR ***************************************\n`);
                logger.error(`error= ${error}`)
                console.log(error)
                if (error instanceof mError.JupiterApiError) {
                    return res.status(StatusCode.ServerErrorInternal).send({message: `Internal Error`, code: error.code});
                }
                return res.status(StatusCode.ServerErrorInternal).send({message: `There was an error: ${error.response}`, code: error.code});
            }
        }
    }
}

