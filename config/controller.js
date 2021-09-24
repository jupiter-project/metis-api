const isTwoFactorAuthenticationEnabled = req => req.user.record.twofa_enabled === true;
const isTwoFactorAuthenticationCompleted = req => req.user.record.twofa_completed === true;
const istwoFactorAuthenticationPassed = req => req.session.twofa_pass === true;
const isMobileDevice = req => req.device && req.device.type && req.device.type === 'phone';
const isUserAdmin = req => req.user && req.user.record && (req.user.record.admin === true);

module.exports = {
  // ===============================================================================
  // LOGIN VERIFICATION AND TWO FACTOR CHECKUP MIDDLEWARE
  // ===============================================================================
  isAppAdmin: (req, res, next) => {
    if (req.isAuthenticated() && !isUserAdmin(req)) {
      // console.log('Admin account');
      req.flash('loginMessage', 'Invalid Access');
      res.redirect('/');
    } else if (req.isAuthenticated()
      && isTwoFactorAuthenticationEnabled(req) 
      && !isTwoFactorAuthenticationCompleted(req)
    ) {
      res.redirect('/2fa_setup');
    } else if (req.isAuthenticated() && 
      isTwoFactorAuthenticationEnabled(req) && 
      isTwoFactorAuthenticationCompleted(req) && 
      !istwoFactorAuthenticationPassed(req)
    ) {
      // console.log('Needs to verify 2FA')
      res.redirect('/2fa_checkup');
    } else if (req.isAuthenticated()) {
      return next();
    } else {
      res.redirect('/home');
    }
    return null;
  },

  isLoggedIn: (req, res, next) => {
    // If user is autenticated in the session, carry on
    // console.log('User',req.user ? req.user.record.admin: null);
    if (req.isAuthenticated() && isUserAdmin(req)) {
      // req.flash('loginMessage','Regular account access only');
      res.redirect('/admin');
    } else if (req.isAuthenticated() && 
      isTwoFactorAuthenticationEnabled(req) && 
      !isTwoFactorAuthenticationCompleted(req)) {
      // console.log('Needs to verify 2FA')
      res.redirect('/2fa_setup');
    } else if (req.isAuthenticated() && 
      isTwoFactorAuthenticationEnabled(req) && 
      isTwoFactorAuthenticationCompleted(req) && 
      !istwoFactorAuthenticationPassed(req)) {
      // console.log('Needs to verify 2FA')
      res.redirect('/2fa_checkup');
    } else if (req.isAuthenticated()) {
      return next();
    } else if (isMobileDevice()) {
      return next();
    } else {
      // console.log('Needs to log');
      res.redirect('/home');
    }
    return null;
  },

  onlyLoggedIn: (req, res, next) => {
    // If user is autenticated in the session, carry on
    if (req.isAuthenticated()) {
      return next();
    }
    // console.log('Needs to log');
    res.redirect('/home');
    return null;
  },
  isLoggedInIndex: (req, res, next) => {
    // If user is autenticated in the session, carry on
    if (req.isAuthenticated() && isUserAdmin()) {
      // req.flash('loginMessage','Regular account access only');
      res.redirect('/admin');
    } else if (req.isAuthenticated() && isTwoFactorAuthenticationEnabled(req)
      && !isTwoFactorAuthenticationCompleted(req)) {
      res.redirect('/2fa_setup');
    } else if (req.isAuthenticated() && 
      isTwoFactorAuthenticationEnabled(req) && 
      isTwoFactorAuthenticationCompleted(req) && 
      !istwoFactorAuthenticationPassed(req)) {
      res.redirect('/2fa_checkup');
    } else if (req.isAuthenticated()) {
      return next();
    } else {
      res.redirect('/home');
    }
    return null;
  },
};
