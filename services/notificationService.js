const Notifications = require('../models/notifications');

module.exports = {
  incrementBadgeCounter: (filter) => {
    if (!filter) {
      throw new Error('Filter and dat to update are required.');
    }

    return Notifications.findOneAndUpdate(
        filter,
        { $inc: { "pnAccounts.$[].badgeCounter": 1 } },
        { new: true }
    ).lean();
  },
  findNotificationAndUpdate: (filter, updateData, token, provider) => {
    if (!filter || !updateData || !token || !provider) {
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
        })
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
  findMutedChannels: (alias) => {
    const filter = { alias };
    return Notifications.find(filter)
      .select('mutedChannels');
  },
};
