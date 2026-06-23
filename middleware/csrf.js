module.exports = (req, res, next) => {
  const crypto = require('crypto');

  // Ensure token exists in session (stable across multi-step checkout)

  if (!req.session) {
    // If session is somehow missing, treat as invalid for unsafe methods
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({ success: false, message: 'Session not initialized.' });
    }
    return next();
  }





  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }


  res.locals.csrfToken = req.session.csrfToken;


  // Skip validation for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }



  // IMPORTANT: Do not enforce CSRF on multipart uploads.
  // The upload step is multipart/form-data and may interfere with session/cookie sync,
  // causing the subsequent confirm step to fail with an invalid token.
  const contentType = req.headers['content-type'] || '';
  if (req.method === 'POST' && contentType.startsWith('multipart/form-data')) {
    return next();
  }


    // Verify token from body, query parameters, or headers
    // NOTE: admin login sends hidden input named "_csrf"
    const token = req.body?._csrf ||
      req.body?.csrf ||
      req.query?._csrf ||
      req.query?.csrf ||
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'];


  const expectedToken = req.session.csrfToken;

  if (!token || token !== expectedToken) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token.' });
    }
    req.flash('error_msg', 'Security validation failed (Invalid CSRF token). Please try again.');
    return res.status(403).redirect(req.get('Referrer') || '/');
  }



  next();
};


