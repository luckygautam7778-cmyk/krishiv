/**
 * Protect user routes (customer auth)
 */

module.exports = function requireUser(req, res, next) {
  if (req.session && req.session.userId) return next();

  // If session exists but is missing auth keys, treat as logged out
  req.flash('error_msg', 'Please login to continue');
  return res.redirect('/login');
};


