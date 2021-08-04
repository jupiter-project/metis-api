const JupiterFSService = require('../services/JupiterFSService');

module.exports = (app) => {
  app.post('/v1/api/file', JupiterFSService.fileUpload);
};
