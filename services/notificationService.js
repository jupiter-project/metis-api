const Notifications = require('../models/notifications');
const gu = require('../utils/gravityUtils');
const mError = require("../errors/metisError");

module.exports = {
  findOneNotificationAndUpdate: (filter, updateData) => {
    if (!filter || !updateData) {
      throw new Error('Filter and data to update are required.');
    }

    const upsertOptions = { upsert: true, new: true, runValidators: true };
    return Notifications.findOneAndUpdate(filter, updateData, upsertOptions);
  },
    /**
     *
     * @param filter
     * @return {*}
     */
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

    upsertNotificationDocumentWithNewToken: async (userAddress, provider, newToken) => {

        if(!userAddress){
            throw new Error('User address is missing');
        }

        if(!provider){
            throw new Error('Provider is missing');
        }

        if(!newToken){
            throw new Error('Token is missing');
        }


        const filter = { userAddress: userAddress};
        const update = {
            userAddress: userAddress,
            mutedChannelAddressList: [],
            pnAccounts: [
                {
                    provider: provider,
                    token: newToken,
                    createdAt: new Date(),
                    badgeCounter: 0,
                }
            ]
        };

        const notification = await Notifications.findOne(filter);
        if(!notification){
            return Notifications.create(update);
        }

        if (!notification.pnAccounts){
            await Notifications.deleteOne(filter);
            return Notifications.create(update);
        }

        const pnAccounts = notification.pnAccounts;
        const tokenExists = pnAccounts.find(pnAccount => pnAccount.token === newToken);
        if(tokenExists) { return notification }

        const newPNAccount = {
            provider,
            token: newToken,
            createdAt: new Date(),
            badgeCounter: 0,
        };

        return Notifications.updateOne(filter, { $push: { pnAccounts: newPNAccount } });
    },

  // findNotificationAndUpdate: (filter, updateData, token, provider) => {
  //   if (!filter || !updateData || !provider) {
  //     throw new Error('Filter and data to update are required.');
  //   }
  //
  //   return Notifications.find(filter)
  //       .lean()
  //       .then(async ([notification]) => {
  //         console.log('[notification]:', notification);
  //
  //         if (!notification){
  //           return Notifications.create(updateData);
  //         }
  //
  //         if (!notification.pnAccounts){
  //           await Notifications.deleteOne(filter);
  //           return Notifications.create(updateData);
  //         }
  //
  //         const tokenAlreadyExist = notification.pnAccounts.find(account => account.token === token);
  //
  //         if (!tokenAlreadyExist){
  //           const newToken = {
  //             provider,
  //             token,
  //             createdAt: new Date(),
  //             badgeCounter: 0,
  //           };
  //           return Notifications.updateOne(filter, { $push: { pnAccounts: [newToken] } });
  //         }
  //
  //         return notification;
  //       });
  // },
    /**
     *
     * @param userAddresses
     * @param mutedUserAddresses
     * @return {*}
     */
  findNotifications: (userAddresses, mutedUserAddresses = []) => {
      if(!gu.isNonEmptyArray(userAddresses)){throw new Error('addressList needs to be an array with values')}
      userAddresses.forEach(userAddress => {
          if(!gu.isWellFormedJupiterAddress(userAddress)) throw new mError.MetisErrorBadJupiterAddress(`userAddress: ${userAddress}`)
          // if(!gu.isWellFormedJupiterAddress(userAddress)){throw new BadJupiterAddressError(userAddress)}
      })

      if(!Array.isArray(mutedUserAddresses)){throw new Error(`mutedUserAddresses needs to be an array`)}
      mutedUserAddresses.forEach(mutedUserAddress => {
          if(!gu.isWellFormedJupiterAddress(mutedUserAddress)) throw new mError.MetisErrorBadJupiterAddress(`mutedUserAddress: ${mutedUserAddress}`)
          // if(!gu.isWellFormedJupiterAddress(mutedUserAddress)){throw new BadJupiterAddressError(mutedUserAddress)}
      })

      // if(mutedUserAddresses && !gu.isWellFormedJupiterAddress(mutedUserAddresses)){ throw new Error(`excludeChannelAdddress needs to be null or valid address`)}
      // if(mutedUserAddresses && !gu.isWellFormedJupiterAddress(mutedUserAddresses)){ throw new Error(`excludeChannelAdddress needs to be null or valid address`)}
    const filter = {
      userAddress: { $in: userAddresses },
      pnAccounts: { $exists: true, $ne: [] },
    };

    if (mutedUserAddresses.length > 0) {
      filter.mutedChannelAddressList = { $nin: mutedUserAddresses };
    }

    return Notifications.find(filter);
  },

    // findNotificationsByAddress: (address) => {
    //     if(!gu.isWellFormedJupiterAddress(address)){throw new BadJupiterAddressError(address)}
    //
    //     const filter = {
    //         userAddress: { $eq: address },
    //         pnAccounts: { $exists: true, $ne: [] },
    //     };
    //
    //     return Notifications.find(filter);
    // },


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

  updateBadgeCounter: (userAddress, badge) => {
    if (!userAddress) {
      throw new Error('User Address are required');
    }

      return Notifications.findOneAndUpdate(
          { userAddress },
          { $set: { "pnAccounts.$[].badgeCounter": badge } },
          { new: true }
      ).lean();
  },
  findMutedChannels: (userAddress) => {
    const filter = { userAddress };
    return Notifications.find(filter)
      .select('mutedChannelAddressList');
  },
};
