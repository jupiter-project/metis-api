require('dotenv').load();
const {redisClient} = require('../services/redisService');
const kue = require('kue');
const {metisConf} = require("../config/metisConf");
const logger = require('../utils/logger')(module);
// const queue = kue.createQueue({
//     redis: {
//        createClientFactory: ()=>{
//            return redisClient
//        }
//     },
// });
const queue = kue.createQueue({
    redis: {
        host: metisConf.redis.host,
        port: metisConf.redis.port,
        auth: metisConf.redis.password,
    },
});
kue.app.listen(metisConf.jobQueue.port, () => {
    logger.info(`Job queue server running on port ${metisConf.jobQueue.port}`);
});

module.exports = {
    jobQueue: queue,
    kue: kue
}
