const JupiterFSService = require('../services/JimService');

module.exports = (app, _, __, websocket) => {
  app.post('/v1/api/user/jim/login', JupiterFSService.jimSignin);
  app.post('/v1/api/user/jim/channel/login', JupiterFSService.jimChannelSignIn);
  app.post('/v1/api/file', JupiterFSService.fileUpload);

  app.post('/v1/api/channel/profile', JupiterFSService.channelProfileUpload);
  app.get('/v1/api/channel/profile/:channelAddress', JupiterFSService.channelProfileDisplay);
  app.delete('/v1/api/channel/profile', JupiterFSService.deleteChannelProfile);

  app.post('/v1/api/user/profile', JupiterFSService.userProfileUpload);
  app.get('/v1/api/user/profile', JupiterFSService.userProfileDisplay);
  app.delete('/v1/api/user/profile', JupiterFSService.deleteUserProfile);
};
