import {instantiateGravityAccountProperties} from "../gravity/instantiateGravityAccountProperties";

const gu = require('../utils/gravityUtils');
import metis from '../config/metis';
import {jupiterAccountService} from "../services/jupiterAccountService";
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";
import ChannelRecord from "../models/channel";
import {gravity} from "../config/gravity";
import {channelConfig} from "../config/constants";
import {chanService} from "../services/chanService";
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
            res.status(500).send({success: false, error: `${error}`})
        }

        const memberAccountProperties = await instantiateGravityAccountProperties(user.passphrase, user.password);
        const channelAccountProperties = await chanService.getChannelAccountPropertiesOrNull(memberAccountProperties, channelAddress);

        // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
        // console.log('channelAccountProperties');
        // console.log(channelAccountProperties);
        // console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')

        const channelMembers = await jupiterAccountService.getChannelMembers(channelAccountProperties)

        // console.log(channelMembers);

        // const channelPublicKeyList =  await jupiterAccountService.getPublicKeysFromChannelAccount(channelAccountProperties);
        // const userPublicKeyList = channelPublicKeyList.map(cpkl => cpkl.userPublicKey);

        // console.log('userPublicKeyList ----->', userPublicKeyList);

        // const memberList = await metis.getMember({ //TODO we need to get rid of this
        //     channel: channelProperties.address,
        //     account: user.account,
        //     password: channelProperties.password
        // });

        // const memberList = {};
        res.send(channelMembers);
        // res.send({ ...memberList, channelUserList: {}, publicKeys: userPublicKeyList })
    }catch (error){
        logger.error(`Error getting members: ${error}`);
        res.status(500).send({success: false, error: `${error}`})
    }
  });


    // /**
    //  * Get Channel Members
    //  */
    // app.get('/v1/api/channel/members', async (req,res) => {
    //     console.log('');
    //     logger.info('======================================================================================');
    //     logger.info('== Get Channel Members');
    //     logger.info('== GET: /v1/api/channel/members');
    //     logger.info('======================================================================================');
    //     console.log('');
    //
    //     const memberAccountProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
    //         req.user.passphrase,
    //         req.user.password
    //     )
    //
    //     const allMemberChannels = await jupiterAccountService.getMemberChannels(memberAccountProperties);
    //
    //     const listOfChannels = allMemberChannels.reduce((reduced, channelAccountProperties) =>{
    //         reduced.push({
    //             channelAddress: channelAccountProperties.address,
    //             channelName: channelAccountProperties.channelName});
    //         return reduced;
    //     }, [])
    //
    //     console.log('ChannelList ----->', listOfChannels);
    //
    //     res.send(listOfChannels);
    //     console.log('');
    //     logger.info('- Get member Channels');
    //     logger.info('- GET: /v1/api/channels');
    //     logger.info('^======================================================================================^');
    // })
};
