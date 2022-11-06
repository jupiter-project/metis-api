"use strict";
const find = require('find');
const jwt = require('jsonwebtoken');
const { gravity  } = require('./gravity');
const ChannelRecord = require('../models/channel.js');
const logger = require('../utils/logger').default(module);
// This file handles the app's different pages and how they are routed by the system
module.exports = (app)=>{
    // ===============================================================================
    //  API GENERAL ROUTES
    // ===============================================================================
    /**
   * Get alias
   */ app.get('/v1/api/jupiter/alias/:aliasName', async (req, res)=>{
        console.log('');
        logger.info('======================================================================================');
        logger.info('==');
        logger.info('== Validate alias availability');
        logger.info('== GET');
        logger.info('==');
        logger.info('======================================================================================');
        const aliasCheckup = await gravity.getAlias(req.params.aliasName);
        logger.debug('Is alias available', JSON.stringify(aliasCheckup));
        res.send(aliasCheckup);
    });
};
