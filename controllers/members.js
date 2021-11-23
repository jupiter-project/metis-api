import metis from '../config/metis';
import {jupiterAccountService} from "../services/jupiterAccountService";
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";
const logger = require('../utils/logger')(module);

module.exports = (app) => {
  app.get('/v1/api/data/members', async (req, res) => {
    const { channel_record: { account, password, passphrase }} = req.channel;
    const tableData = { account, password, passphrase };

    try{
        const channelProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(passphrase, password);
        const channelPublicKeyList =  await jupiterAccountService.getPublicKeysFromChannelAccount(channelProperties);
        const userPublicKeyList = channelPublicKeyList.map(cpkl => cpkl.userPublicKey);

        const memberList = await metis.getMember({ //TODO we need to get rid of this
            channel: tableData.account,
            account: req.user.account,
            password: tableData.password
        });

        res.send({ ...memberList, channelUserList: userPublicKeyList })
    }catch (error){
        logger.error(`Error getting members: ${error}`);
        res.status(500).send({success: false, error: `${error}`})
    }
  });
};
