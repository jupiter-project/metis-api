const {createClient} = require('redis');
const {metisConf} = require("../config/metisConf");
const logger = require('../utils/logger')(module);
const redisClient = createClient({
    url: `redis://default:${metisConf.redis.password}222@${metisConf.redis.host}:${metisConf.redis.port}`
})
redisClient.on('error', (error) => {
    console.log('\n')
    logger.error(`************************* ERROR ***************************************`);
    logger.error(`* ** redisClient.catch(error)`);
    logger.error(`************************* ERROR ***************************************\n`);
    logger.error(`error= ${error}`)
    throw error;
});
redisClient.on('connect', ()=> {
    // RedisConnected
    console.log(`\n`);
    logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--`);
    logger.info(` RedisConnected`);
    logger.info(`-__-__-__-__-__-__-__-__-__-__-__-__-__-__-__--\n`);
});
module.exports.redisClient = redisClient;
