const { cloudinaryConfig } = require('../config/cloudinaryConf');
const { gravity } = require('../config/gravity');

module.exports = {
  photosUpload: (req, res) => {
    const { base64Image, accountData } = req.body;

    if (!(base64Image && accountData)) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }
    const userAccount = JSON.parse(gravity.decrypt(accountData));

    cloudinaryConfig.uploader.upload(base64Image, {
      public_id: userAccount.account,
      upload_preset: 'dev_setups',
    })
      .then((uploadResponse) => {
        const addressBreakdown = userAccount.account.split('-');
        const accountPropertyParams = {
          passphrase: userAccount.passphrase,
          recipient: userAccount.account,
          property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
          value: uploadResponse.secure_url,
          feeNQT: 100,
        };

        gravity.setAcountProperty(accountPropertyParams);
        return uploadResponse;
      })
      .then(uploadResponse => res.json({ url: uploadResponse.secure_url }))
      .catch((error) => {
        console.error('[photosUpload]:', error);
        return res.status(500).json({ msg: 'Something went wrong', error });
      });
  },
  getProfilePicture: async (req, res) => {
    const { jupAccount } = req.params;
    const userProperties = await gravity.getAccountProperties({ recipient: jupAccount });
    const profilePicture = userProperties.properties.find(property => property.property.includes('profile_picture'));
    res.send(profilePicture || null);
  },
  deleteProfilePicture: async (req, res) => {
    const { accountData } = req.params;

    if (!accountData) {
      return res.status(400).json({ msg: 'Missing parameters required.' });
    }

    try {
      const userAccount = JSON.parse(gravity.decrypt(accountData));
      const addressBreakdown = userAccount.account.split('-');
      const accountPropertyParams = {
        recipient: userAccount.account,
        property: `profile_picture-${addressBreakdown[addressBreakdown.length - 1]}`,
        passphrase: userAccount.passphrase,
        feeNQT: 100,
        deadline: 60,
      };
      await gravity.deleteAccountProperty(accountPropertyParams);
      await cloudinaryConfig.uploader.destroy(userAccount.account);
      res.send({ msg: 'successfully deleted' });
    } catch (error) {
      return res.status(500).json({ msg: 'Something went wrong', error });
    }
  },
};
