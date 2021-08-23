const JupiterFSService = require('../services/JupiterFSService');

module.exports = (app) => {
  app.post('/v1/api/file', JupiterFSService.fileUpload);
  app.post('/v1/api/channel/profile', JupiterFSService.fileUpload);
  app.get('/v1/api/channel/profile', JupiterFSService.channelProfileUpload);
};
