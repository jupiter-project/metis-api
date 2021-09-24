const CloudinaryService = require('../services/cloudinaryService');

module.exports = (app) => {
  app.post('/v1/api/profile-picture', CloudinaryService.photosUpload);
  app.get('/v1/api/profile-picture/:id', CloudinaryService.getProfilePicture);
  app.delete('/v1/api/profile-picture', CloudinaryService.deleteProfilePicture);
};
