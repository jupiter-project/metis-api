module.exports = {
  metisConfig: {
    evm: 'ev1'
  },
  messagesConfig: {
    maxMessageLength: '260',
    messageRecord: 'v1.metis.message.message-record'
  },
  userConfig: {
    userPublicKey: 'v1.metis.user.public-key',
    userPublicKeyList: 'v1.metis.user.public-key-list',
    metisUserRecord: 'v1.metis.metis-user-record.ev1', //TODO check if this contant is still being used
    userRecord: 'v1.metis.user-record',
    userProfilePicture: 'v1.metis.user-profile-picture.ev1' //TODO check if this contant is still being used
  },
  channelConfig: {
    channelMemberPublicKey: 'v1.metis.channel.member-public-key',
    channelMemberPublicKeyList: 'v1.metis.channel.member-public-key-list',
    channelRecord: 'v1.metis.channel.channel-record',
    channelInviteRecord: 'v1.metis.channel.channel-invite-record',
    channelMember: 'v1.metis.channel.channel-member',
    channelMemberList: 'v1.metis.channel.channel-member-list',
    channelInvitationDeclinedList: 'v1.metis.channel.channel-invitation-declined-list',
    channelInvitationDeclinedRecord: 'v1.metis.channel.channel-invitation-declined-record'
  },
  tableConfig: {
    tableList: 'v1.metis.table.table-list.ev1', //TODO check if this contant is still being used
    channelsTable: 'v1.metis.table.channels.ev1', //TODO check if this contant is still being used
    invitesTable: 'v1.metis.table.invites.ev1', //TODO check if this contant is still being used
    storageTable: 'v1.metis.table.storage.ev1', //TODO check if this contant is still being used
    usersTable: 'v1.metis.table.users.ev1' //TODO check if this contant is still being used
  }
}
