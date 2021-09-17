import {
  findNotificationAndUpdate, findMutedChannels, updateBadgeCounter,
} from './notificationService';

const logger = require('../utils/logger')(module);

module.exports = {
  addTokenNotification: (req, res) => {
    const { token, jupId, provider } = req.body;
    logger.debug(`[addTokenNotification]->Token: ${token}`);

    if ( !( jupId && token && provider) ){
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
  editMutedChannels: (req, res) => {
    const { body } = req;
    if (body && body.alias && body.channelId) {
      const filter = { alias: body.alias };
      const update = body.isMuted
        ? { $pull: { mutedChannels: body.channelId } }
        : { $push: { mutedChannels: body.channelId } };

      findNotificationAndUpdate(filter, update)
        .then(notification => res.json({ success: true, notification }))
        .catch((error) => {
          logger.error(error);
          res.status(400).json({ ok: false, error });
        });
    } else {
      const error = {
        ok: false,
        error: 'bad request',
        message: 'Alias and Channel id are required.',
      };
      logger.error(error);
      res.status(400).json(error);
    }
  },
  findMutedChannels: (req, res) => {
    const { alias } = req.params;
    if (alias) {
      findMutedChannels(alias)
        .then(([response]) => {
          const { mutedChannels } = response || { mutedChannels: [] };
          res.json({
            success: true,
            mutedChannels,
          });
        })
        .catch((error) => {
          logger.error(error);
          res.status(400).json({ ok: false, error });
        });
    } else {
      const error = {
        ok: false,
        error: 'bad request',
        message: 'Alias is required.',
      };
      logger.error(error);
      res.status(400).json(error);
    }
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
