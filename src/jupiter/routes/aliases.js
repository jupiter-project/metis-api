import {jupiterAPIService} from "../../../services/jupiterAPIService";
const {StatusCode} = require("../../../utils/statusCode");
const logger = require('../../../utils/logger')(module);

module.exports = (app, jobs, websocket) => {
    app.get('/v1/api/accounts/:accountAddress/aliases', async (req, res) => {
        console.log('');
        logger.info('======================================================================================');
        logger.info('== Loads Aliases');
        logger.info('== GET: /v1/api/aliases ');
        logger.info('======================================================================================');
        console.log('');
        try {
            const {accountAddress} = req.params
            const response = await jupiterAPIService.getAliases(accountAddress);
            return res.status(StatusCode.SuccessOK).send(response.data);
        } catch (error) {
            console.log(error);
            res.status(500).send({message: 'There was an error getting aliases from jupiter', code: error.code});
        };
    });
};
