const find = require('find');
const logger = require('../../utils/logger')(module);

// Initialize all Jim Routes
logger.info('======================================================================================');
logger.info('== Initializing Jim Routes');
logger.info(`======================================================================================`);

module.exports = (app, jobs, io) => {
    find.fileSync(/\.js$/, `${__dirname}/routes`).forEach((routerFile) => {
        require(routerFile)(app,jobs,io);
    });
}

// Initialize all Jim jobs
logger.info('======================================================================================');
logger.info('== initializing Jim Jobs');
logger.info(`======================================================================================`);

find.fileSync(/\.js$/, `${__dirname}/jobs`).forEach((filePath) => {
    require(filePath);
});

