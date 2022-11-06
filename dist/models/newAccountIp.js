"use strict";
const mongoose = require('mongoose');
const newAccountIpSchema = new mongoose.Schema({
    ipAddress: String,
    jupAddress: String,
    alias: String,
    timestamp: Date
});
module.exports = mongoose.model('NewAccountIp', newAccountIpSchema);
