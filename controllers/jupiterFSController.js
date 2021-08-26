const JupiterFSService = require('../services/JupiterFSService');

module.exports = (app) => {
  app.post('/v1/api/file', JupiterFSService.fileUpload);
  app.post('/v1/api/channel/profile', JupiterFSService.channelProfileUpload);
  app.get('/v1/api/channel/profile', JupiterFSService.channelProfileDisplay);
  app.delete('/v1/api/channel/profile', JupiterFSService.channelProfileDelete);
};
