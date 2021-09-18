const Notifications = require('../models/notifications');

module.exports = {
  findOneNotificationAndUpdate: (filter, updateData) => {
    if (!filter || !updateData) {
      throw new Error('Filter and data to update are required.');
    }

    const upsertOptions = { upsert: true, new: true, runValidators: true };
    return Notifications.findOneAndUpdate(filter, updateData, upsertOptions);
  },
  incrementBadgeCounter: (filter) => {
    if (!filter) {
      throw new Error('Filter and data to update are required.');
    }

    return Notifications.findOneAndUpdate(
        filter,
        { $inc: { "pnAccounts.$[].badgeCounter": 1 } },
        { new: true }
    ).lean();
  },
  findOneNotificationAndRemovePNToken: (filter, provider, token) => {
    return Notifications.findOne(filter)
        .lean()
        .then(async (notification) => {
          if (!(notification && notification.pnAccounts)){
            return notification;
          }

          const providerToken = notification.pnAccounts.find(account => account.provider === provider && account.token === token);

          if (!providerToken){
              return notification;
          }

          return Notifications.updateOne(filter, { $pull: { pnAccounts: { provider, token } } });
        });
  },
  findNotificationAndUpdate: (filter, updateData, token, provider) => {
    if (!filter || !updateData || !provider) {
      throw new Error('Filter and data to update are required.');
    }

    return Notifications.find(filter)
        .lean()
        .then(async ([notification]) => {
          console.log('[notification]:', notification);

          if (!notification){
            return Notifications.create(updateData);
          }

          if (!notification.pnAccounts){
            await Notifications.deleteOne(filter);
            return Notifications.create(updateData);
          }

          const tokenAlreadyExist = notification.pnAccounts.find(account => account.token === token);

          if (!tokenAlreadyExist){
            const newToken = {
              provider,
              token,
              createdAt: new Date(),
              badgeCounter: 0,
            };
            return Notifications.updateOne(filter, { $push: { pnAccounts: [newToken] } });
          }

          return notification;
        });
  },
  findNotificationsByAddressList: (addressList, excludeChannelId = null) => {
    const filter = {
      userAddress: { $in: addressList },
      pnAccounts: { $exists: true, $ne: [] },
    };

    if (excludeChannelId) {
      filter.mutedChannelIds = { $nin: [excludeChannelId] };
    }

    return Notifications.find(filter);
  },
  /**
   * Returns the notification items filtering by
   * token,
   * @param {string} token
   * @returns {Query<Array<EnforceDocument<unknown, {}>>, Document<any, any>, {}>}
   */
  findNotificationItemsByToken: (token) => {
    const filter = { pnAccounts: { token: token } };
    return Notifications.find(filter).select('pnAccounts');
  },
  updateBadgeCounter: (alias, badge) => {
    if (!alias) {
      throw new Error('Alias are required');
    }
    return Notifications.updateOne({ alias }, { badgeCounter: badge || 0 });
  },
  findMutedChannels: (userAddress) => {
    const filter = { userAddress };
    return Notifications.find(filter)
      .select('mutedChannelIds');
  },
};
