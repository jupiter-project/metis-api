module.exports = {
  messagesConfig: {
    maxMessageLength: '260',
    messageRecord: 'v1.metis.message.message-record'
  },
  userConfig:{
    userPublicKey: 'v1.metis.user.public-key',
    userPublicKeyList: 'v1.metis.user.public-key-list'
  },
  channelConfig:{
    channelMemberPublicKey: 'v1.metis.channel.member-public-key',
    channelMemberPublicKeyList: 'v1.metis.channel.member-public-key-list',
    channelRecord: 'v1.metis.channel.channel-record',
    channelInviteRecord: 'v1.metis.channel.channel-invite-record',
    channelMember: 'v1.metis.channel.channel-member',
    channelMemberList: 'v1.metis.channel.channel-member-list',
    channelInvitationDeclinedList: 'v1.metis.channel.channel-invitation-declined-list',
    channelInvitationDeclinedRecord: 'v1.metis.channel.channel-invitation-declined-record'
  },
  tableConfig:{
    tableList: 'v1.metis.table.table-list',
    channelsTable: 'v1.metis.table.channels',
    invitesTable: 'v1.metis.table.invites',
    storageTable: 'v1.metis.table.storage',
    usersTable: 'v1.metis.table.users',
  },
};
