import {StatusCode} from "../../../utils/statusCode";
import jupiterAPIService from "../../../services/jupiterAPIService";
import gravityUtils from "../../../utils/gravityUtils";
const logger = require('../../../utils/logger')(module);
// const gu = require('../../../utils/gravityUtils');
// const mError = require("../../../errors/metisError");

module.exports = (app, jobs, websocket) => {
    return {
        v1GeneratePassphraseGet: async (req,res)=> {
                const seedphrase = gravityUtils.generatePassphrase();
                res.status(StatusCode.SuccessOK).send({ result: seedphrase, message: 'Passphrase generated' });
        }
    }
}
