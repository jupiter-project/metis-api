import {
  findNotificationAndUpdate,
  findMutedChannels,
  updateBadgeCounter,
  findOneNotificationAndUpdate,
  findOneNotificationAndRemovePNToken
} from './notificationService';

const logger = require('../utils/logger')(module);

module.exports = {
  addTokenNotification: (req, res) => {
    const { token, jupId, provider } = req.body;
    logger.debug(`[addTokenNotification]->Token: ${token}`);

    if ( !(jupId && provider && token) ){
      const error = {
        success: false,
        message: 'Token, Provider and JupId are required',
      };
      logger.error(`${error}`);
      return res.status(400).json(error);
    }

    const filter = { userAddress: jupId};

    const update = {
      userAddress: jupId,
      mutedChannelAddressList: [],
      pnAccounts: [
        {
          provider: provider,
          token: token,
          createdAt: new Date(),
          badgeCounter: 0,
        }
      ]
    };

    findNotificationAndUpdate(filter, update, token, provider)
        .then(notificationInfo => res.json({success: true, notificationInfo}))
        .catch((error) => {
          logger.error(`${error}`);
          res.status(400).json({ ok: false, error });
        });
  },
  deleteTokenPushNotification: (req, res) => {
    const { jupId, provider, token } = req.params;

    if ( !(jupId && provider && token) ){
      const error = {
        success: false,
        message: 'Token, Provider and JupId are required',
      };
      logger.error(`${error}`);
      return res.status(400).json(error);
    }

    const filter = { userAddress: jupId };

    findOneNotificationAndRemovePNToken(filter, provider, token)
        .then(() => res.json({success: true}))
        .catch(error => {
          logger.error(`${error}`);
          res.status(500).json({ ok: false, error });
        })
  },
  editMutedChannels: (req, res) => {
    const { userData: { account: userAddress } } = req.user;
    const { channelAddress, isMuted } = req.body;

    if (!channelAddress) {
      return res.status(400).json({message: 'Alias and Channel id are required.'});
    }

    const filter = { userAddress };
    const update = isMuted
      ? { $pull: { mutedChannelAddressList: channelAddress } }
      : { $push: { mutedChannelAddressList: channelAddress } };

    findOneNotificationAndUpdate(filter, update)
      .then(notification => {
        res.json({success: true, notification})
      })
      .catch((error) => {
        logger.error(`${error}`);
        res.status(400).json({ ok: false, error });
      });
  },
  findMutedChannels: (req, res) => {
    const { userData: { account: userAddress } } = req.user;

    if (!userAddress){
      return res.status(400).json({ message: 'Alias is required.' });
    }

    findMutedChannels(userAddress)
      .then(([response]) => {
        console.log('muted channel list -----', response);
        const { mutedChannelAddressList } = response || { mutedChannelAddressList: [] };
        res.json({
          success: true,
          mutedChannelAddressList,
        });
      })
      .catch((error) => {
        logger.error(`${error}`);
        res.status(500).json({ ok: false, error });
      });
  },
  setBadgePnCounter: (req, res) => {
    const { userAddress, badge } = req.body;

    if (!userAddress){
      const error = {
        ok: false,
        error: 'bad request',
        message: 'userAddress id are required.',
      };
      logger.error(`${error}`);
      return res.status(400).json(error);
    }

    updateBadgeCounter(userAddress, badge || 0)
        .then(response => res.json({ success: true, response }))
        .catch(error => {
          res.status(500).json(error)
        });
  },
};
