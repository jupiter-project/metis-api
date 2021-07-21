const CloudinaryService = require('../services/cloudinaryService');

module.exports = (app) => {
  app.post('/profile-picture', CloudinaryService.photosUpload);
  app.get('/profile-picture/:id', CloudinaryService.getProfilePicture);
  app.delete('/profile-picture/:accountData', CloudinaryService.deleteProfilePicture);
};
