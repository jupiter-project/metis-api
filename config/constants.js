module.exports = {
  messagesConfig: {
    maxMessageLength: '260',
  },
  userConfig:{
    userPublicKey: 'v1.metis.user.public-key',
    userPublicKeyList: 'v1.metis.user.public-key-list'
  },
  channelConfig:{
    channelUsers: 'v1.metis.channel.public-key',
    channelUserList: 'v1.metis.channel.public-key.list',
    channelRecord: 'v1.metis.channel.channel-record',
    channelInviteRecord: 'v1.metis.channel.channel-invite-record',
  },
  tableConfig:{
    tableList: 'v1.metis.table.table-list',
    channelsTable: 'v1.metis.table.channels',
    invitesTable: 'v1.metis.table.invites',
    storageTable: 'v1.metis.table.storage',
    usersTable: 'v1.metis.table.users',
  },
};
