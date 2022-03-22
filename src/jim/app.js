const find = require('find')
const path = require('path')
const logger = require('../../utils/logger')(module)

// Initialize all Jim Routes
logger.info('======================================================================================')
logger.info('== Initializing Jim Routes')
logger.info('======================================================================================')

module.exports = (app, jobs, io) => {
  const fullPath = path.join(__dirname, '/routes')
  find.fileSync(/\.js$/, fullPath).forEach((routerFile) => {
    require(routerFile)(app, jobs, io)
  })
}

// Initialize all Jim jobs
logger.info('======================================================================================')
logger.info('== initializing Jim Jobs')
logger.info('======================================================================================')
const fullPathJobs = path.join(__dirname, '/jobs')

find.fileSync(/\.js$/, fullPathJobs).forEach((filePath) => {
  require(filePath)
})
