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
      logger.error(error);
      return res.status(400).json(error);
    }

    const filter = { userAddress: jupId};

    const update = {
      userAddress: jupId,
      mutedChannelIds: [],
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
          logger.error(error);
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
      logger.error(error);
      return res.status(400).json(error);
    }

    const filter = { userAddress: jupId };

    findOneNotificationAndRemovePNToken(filter, provider, token)
        .then(() => res.json({success: true}))
        .catch(error => {
          logger.error(error);
          res.status(500).json({ ok: false, error });
        })
  },
  editMutedChannels: (req, res) => {
    const { userAddress, channelId, isMuted } = req.body;

    if (!(userAddress && channelId)) {
      const error = {
        ok: false,
        error: 'bad request',
        message: 'Alias and Channel id are required.',
      };
      logger.error(error);
      return res.status(400).json(error);
    }

    const filter = { userAddress };
    const update = isMuted
      ? { $pull: { mutedChannelIds: channelId } }
      : { $push: { mutedChannelIds: channelId } };

    findOneNotificationAndUpdate(filter, update)
      .then(notification => res.json({ success: true, notification }))
      .catch((error) => {
        logger.error(error);
        res.status(400).json({ ok: false, error });
      });
  },
  findMutedChannels: (req, res) => {
    const { userAddress } = req.params;

    if (!userAddress){
      const error = {
        ok: false,
        error: 'bad request',
        message: 'Alias is required.',
      };
      logger.error(error);
      return res.status(400).json(error);
    }

    findMutedChannels(userAddress)
      .then(([response]) => {
        const { mutedChannelIds } = response || { mutedChannelIds: [] };
        res.json({
          success: true,
          mutedChannelIds,
        });
      })
      .catch((error) => {
        logger.error(error);
        res.status(500).json({ ok: false, error });
      });
  },
  setBadgePnCounter: (req, res) => {
    const { alias, badge } = req.body;
    if (alias) {
      updateBadgeCounter(alias, badge || 0)
        .then(response => res.json({ success: true, response }));
    } else {
      const error = {
        ok: false,
        error: 'bad request',
        message: 'Alias id are required.',
      };
      logger.error(error);
      res.status(400).json(error);
    }
  },
};
