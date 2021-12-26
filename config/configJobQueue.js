require('dotenv').load();

const kue = require('kue');
const logger = require('../utils/logger')(module);

// Loads job queue modules and variables
// @TODO redis needs a password!!!!
const jobs = kue.createQueue({
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
        auth: process.env.REDIS_PASSWORD || undefined,
    },
});


kue.app.listen(4001, () => {
    logger.info('Job queue server running on port 4001');
});

module.exports = {
    jobQueue: jobs,
    kue: kue
}
