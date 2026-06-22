/**
 * Authentication middleware for admin routes
 */

const isAdmin = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return next();
  }
  req.flash('error_msg', 'Please login to access the admin panel');
  return res.redirect('/admin/login');
};

// Role-based authorization
const requireAdminRole = (...allowedRoles) => {
  return (req, res, next) => {
    const role = req.session?.adminRole;
    if (!role) {
      req.flash('error_msg', 'Unauthorized');
      return res.redirect('/admin/login');
    }
    if (allowedRoles.length === 0) return next();
    if (allowedRoles.includes(role)) return next();
    req.flash('error_msg', 'You do not have permission for this action');
    return res.redirect('/admin/dashboard');
  };
};


const isNotAdmin = (req, res, next) => {
  if (!req.session || !req.session.adminId) {
    return next();
  }
  return res.redirect('/admin/dashboard');
};

module.exports = { isAdmin, isNotAdmin, requireAdminRole };
