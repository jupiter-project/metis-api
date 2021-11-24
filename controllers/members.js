import metis from '../config/metis';
import {jupiterAccountService} from "../services/jupiterAccountService";
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";
import ChannelRecord from "../models/channel";
import {gravity} from "../config/gravity";
import {channelConfig} from "../config/constants";
import {chanService} from "../services/chanService";
const logger = require('../utils/logger')(module);

module.exports = (app) => {
  app.get('/v1/api/:channelAddress/members', async (req, res) => {
      const { user } =  req;
      const { channelAddress } = req.params;

    try{
        const memberAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(user.passphrase, user.password);
        const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress);

        console.log('channel channel channel----->', channelAccountProperties);

        const channelPublicKeyList =  await jupiterAccountService.getPublicKeysFromChannelAccount(channelAccountProperties);
        const userPublicKeyList = channelPublicKeyList.map(cpkl => cpkl.userPublicKey);

        console.log('userPublicKeyList ----->', userPublicKeyList);

        // const memberList = await metis.getMember({ //TODO we need to get rid of this
        //     channel: channelProperties.address,
        //     account: user.account,
        //     password: channelProperties.password
        // });

        const memberList = {};
        res.send({ ...memberList, channelUserList: {} })
    }catch (error){
        logger.error(`Error getting members: ${error}`);
        res.status(500).send({success: false, error: `${error}`})
    }
  });
};
