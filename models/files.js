const mongooseClient = require('mongoose');

const filesSchema = mongooseClient.Schema({
  id: String,
  account: String,
  originalname: String,
  mimetype: String,
  url: String,
  size: Number,
  data: String
});

module.exports = mongooseClient.model('Files', filesSchema);
