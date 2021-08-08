const multer = require('multer');
const JupiterFSService = require('../services/JupiterFSService');

const upload = multer({ dest: 'v1/api/file' });

module.exports = (app) => {
  app.post('/v1/api/file', JupiterFSService.fileUpload);
  app.get('/v1/api/jim/file', JupiterFSService.getFile);
};
