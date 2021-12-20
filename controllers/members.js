import {instantiateMinimumGravityAccountProperties} from "../gravity/instantiateGravityAccountProperties";
import {chanService} from "../services/chanService";
import {StatusCode} from "../utils/statusCode";

const gu = require('../utils/gravityUtils');
const logger = require('../utils/logger')(module);

module.exports = (app) => {
    /**
     * GET Channel Members
     */
    app.get('/v1/api/:channelAddress/members', async (req, res) => {
        console.log('\n\n\n');
        logger.info('======================================================================================');
        logger.info('== Get Channel Members');
        logger.info('======================================================================================\n\n\n');
        const {user} = req;
        const {channelAddress} = req.params;

        try {
            if (!gu.isWellFormedJupiterAddress(channelAddress)) {
                logger.error(`The ChannelAddress is Invalid: ${channelAddress}`)
                return res.status(StatusCode.ClientErrorBadRequest).send({message: `The channelAddress is invalid`})
            }
            const memberAccountProperties = await instantiateMinimumGravityAccountProperties(user.passphrase, user.password, user.address);
            // const memberAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);
            const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress);
            if (!channelAccountProperties) {
                return res.status(StatusCode.ServerErrorInternal).send({message: `The channel is not available: ${channelAddress}`})
            }
            const channelMembers = await chanService.getChannelMembers(channelAccountProperties)
            return res.send(channelMembers);
        } catch (error) {
            logger.error(`Error getting members`);
            console.log(error);
            return res.status(StatusCode.ServerErrorInternal).send({message: `Error getting members`})
        }
    });
};
