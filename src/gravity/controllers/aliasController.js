import {StatusCode} from "../../../utils/statusCode";
import jupiterAPIService from "../../../services/jupiterAPIService";
const logger = require('../../../utils/logger')(module);
// const gu = require('../../../utils/gravityUtils');
// const mError = require("../../../errors/metisError");

module.exports = (app, jobs, websocket) => {
    return {
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
