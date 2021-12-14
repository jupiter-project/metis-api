import {instantiateGravityAccountProperties} from "../gravity/instantiateGravityAccountProperties";
import {jupiterAccountService} from "../services/jupiterAccountService";
import {chanService} from "../services/chanService";
import {StatusCode} from "../utils/statusCode";
const gu = require('../utils/gravityUtils');
const logger = require('../utils/logger')(module);

module.exports = (app) => {

    /**
     * GET Channel Members
     */
    app.get('/v1/api/:channelAddress/members', async (req, res) => {
      const { user } =  req;
      const { channelAddress } = req.params;

    try{
        if(!gu.isWellFormedJupiterAddress(channelAddress)){
            return res.status(500).send({error: `${error}`})
        }
        const memberAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);
        const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress);
        if(!channelAccountProperties){
            return res.status(500).send({message:'channel is not available'})
        }
        const channelMembers = await jupiterAccountService.getChannelMembers(channelAccountProperties)

        return res.send(channelMembers);
    }catch (error){
        logger.error(`Error getting members`);
        console.log(error);
        return res.status(StatusCode.ServerErrorInternal).send({message: `Error getting members`})
    }
  });
};
