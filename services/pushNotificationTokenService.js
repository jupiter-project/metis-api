import {
  findNotificationAndUpdate, findMutedChannels, findItemsByToken, updateBadgeCounter,
} from './notificationService';

const logger = require('../utils/logger')(module);

module.exports = {
  addTokenNotification: (req, res) => {
    const { body } = req;
    console.log('TOKEN:', body.token);
    if (body && body.alias && body.jupId && body.token) {
      const filter = { alias: body.alias };
      const update = { jupId: body.jupId || '' };
      const updateToken = body.deleteToken
        ? { $pull: { tokenList: body.token } }
        : { $push: { tokenList: body.token } };

      findItemsByToken(body.token)
        .then((tokenList) => {
          if (
            (tokenList && Array.isArray(tokenList))
            && (tokenList.length === 0 || body.deleteToken)
          ) {
            return findNotificationAndUpdate(filter, { ...updateToken, ...update });
          }
          return null;
        })
        .then(tokenList => res.json({ success: true, tokenList }))
        .catch((error) => {
          logger.error(error);
          res.status(400).json({ ok: false, error });
        });
    } else {
      const error = {
        success: false,
        message: 'Alias, Token and JupId are required',
      };
      logger.error(error);
      res.status(400).json(error);
    }
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
