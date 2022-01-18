const mongoose = require('mongoose');

const pnAccountSchema = new mongoose.Schema({
  provider: { type: String, enum: ['android', 'ios'] },
  token: String,
  createdAt: Date,
  badgeCounter: Number,
});

const notificationsSchema = new mongoose.Schema({
  userAddress: String,
  mutedChannelAddressList: [String],
  pnAccounts: [pnAccountSchema],
});

module.exports = mongoose.model('Notifications', notificationsSchema);
