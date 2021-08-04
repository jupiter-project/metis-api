import controller from '../config/controller';
import metis from '../config/metis';

const _ = require('lodash');
const device = require('express-device');
const logger = require('../utils/logger')(module);

module.exports = (app) => {
  app.use(device.capture());
  app.get('/v1/api/data/members', async (req, res) => {
    const tableData = {
      account: req.headers.channeladdress,
      password: req.headers.channelkey,
    };
    let memberList = null;
    try {
      memberList = await metis.getMember({
        channel: tableData.account,
        account: req.user.account,
        password: tableData.password,
      });
    } catch (error) {
      logger.error(error);
    }

    res.send(memberList);
  });

  app.post('/v1/api/data/members', async (req, res) => {
    logger.info(req.body);
    const { account, alias } = req.user;
    const tableData = {
      account: req.body.channeladdress,
      password: req.body.channelkey,
    };

    logger.info(tableData);
    let response = null;

    try {
      response = await metis.addToMemberList({
        channel: tableData.account,
        password: tableData.password,
        account,
        alias,
      });
    } catch (error) {
      logger.error(error);
    }

    res.send(response);
  });
};
