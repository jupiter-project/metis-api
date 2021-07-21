const Notifications = require('../models/notifications');

module.exports = {
  findNotificationAndUpdate: (filter, updateData) => {
    if (!filter || !updateData) {
      throw new Error('Filter and dat to update are required.');
    }

    const upsertOptions = { upsert: true, new: true, runValidators: true };
    return Notifications.findOneAndUpdate(filter, updateData, upsertOptions);
  },
  findNotificationInfoByAliasOrJupId: (members, channelId = null) => {
    const filter = {
      $or: [
        { alias: { $in: members } },
        { jupId: { $in: members } },
      ],
      tokenList: { $exists: true, $ne: [] },
    };

    if (channelId) {
      filter.mutedChannels = { $nin: [channelId] };
    }

    return Notifications.find(filter);
  },
  findItemsByToken: (token) => {
    const filter = { tokenList: { $in: [token] } };
    return Notifications.find(filter)
      .select('tokenList');
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
