#!/usr/bin/env node

require('dotenv').config({path: '../.env'});
require('babel-register')({
    presets: ['react'],
});
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
// const AccountRegistration  = require('../services/accountRegistrationService');
const {gravityUtils} = require("../utils/gravityUtils");
const { jupiterApiService } = require('../services/jupiterAPIService');
const { applicationAccountProperties, ApplicationAccountProperties} = require('../gravity/applicationAccountProperties');
const { JupiterAccountProperties } = require('../gravity/jupiterAccountProperties');
const {jupiterAxios} = require("../config/axiosConf");
const logger = require('../utils/logger');
const gravity = require("../config/gravity");
const {JupiterAccountService} = require("../services/jupiterAccountService");
const argv = yargs(hideBin(process.argv)).argv

let account = argv.account

let applicationGravityAccountProperties = new ApplicationAccountProperties();


const jupiterAccountService = new JupiterAccountService(
    jupiterApiService,
    applicationAccountProperties,
    tableService,
    jupiterTransactionsService);

jupiterAccountService.fetchAccountStatement(
    this.applicationAccountProperties.address,
    this.applicationAccountProperties.passphrase,
    this.applicationAccountProperties.password,
    'metis-account',
    'app'
));

console.log(`the account is : ${account}`)







