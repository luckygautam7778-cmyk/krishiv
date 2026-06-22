module.exports = (req, res, next) => {
  const crypto = require('crypto');

  // ─── Fallback diagnostics (run for all requests) ───
  // This will confirm whether CSRF middleware is reached and whether session/cookies persist.
  // Keep payload small: do not log token values.
  console.warn('[CSRF-DIAG][MW_ENTER]', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    sessionID: typeof req.sessionID === 'string' ? req.sessionID : undefined,
    hasCookieHeader: Boolean(req.headers?.cookie),
    cookieHeaderLen: req.headers?.cookie ? req.headers.cookie.length : 0,
    protocol: req.protocol,
    secure: req.secure,
    xForwardedProto: req.get('x-forwarded-proto'),
    hasSessionCsrfToken: Boolean(req.session?.csrfToken)
  });


  // Ensure token exists in session (stable across multi-step checkout)
  if (!req.session) {
    // If session is somehow missing, treat as invalid for unsafe methods
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({ success: false, message: 'Session not initialized.' });
    }
    return next();
  }

  // ─── Temporary diagnostics (Render CSRF-only production debugging) ───
  const isAdminLoginFlow = req.path === '/admin/login' || req.originalUrl === '/admin/login';
  const sessionId = typeof req.sessionID === 'string' ? req.sessionID : undefined;
  const cookiesPresent = {
    cookie: Boolean(req.headers?.cookie),
    cookieHeaderLen: req.headers?.cookie ? req.headers.cookie.length : 0
  };

  if (isAdminLoginFlow) {
    console.warn('[CSRF-DIAG][ENTER]', {
      method: req.method,
      path: req.path,
      sessionID: sessionId,
      hasSessionCsrfToken: Boolean(req.session?.csrfToken),
      cookiesPresent,
      reqProtocol: req.protocol,
      reqSecure: req.secure
    });
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    if (isAdminLoginFlow) {
      console.warn('[CSRF-DIAG][CSRF_GENERATED]', {
        method: req.method,
        path: req.path,
        sessionID: sessionId,
        // do not log token values
        generatedCsrfTokenPresent: Boolean(req.session?.csrfToken)
      });
    }
  }

  res.locals.csrfToken = req.session.csrfToken;


  // Skip validation for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (isAdminLoginFlow) {
      console.warn('[CSRF-DIAG][GET_SKIP_VALIDATION]', {
        method: req.method,
        path: req.path,
        sessionID: sessionId,
        csrfTokenInSession: '[present]'
      });
    }
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
    // Temporary diagnostics for production debugging.
    // NOTE: do not include actual token values.
    if (isAdminLoginFlow) {
      console.warn('[CSRF-DIAG][MISMATCH]', {
        method: req.method,
        path: req.path,
        sessionID: sessionId,
        // do not log token values
        generatedCsrfTokenPresent: Boolean(req.session?.csrfToken),
        submittedCsrfTokenPresent: Boolean(token),
        cookieHeaderPresent: cookiesPresent.cookie,
        cookieHeaderLen: cookiesPresent.cookieHeaderLen,
        // useful for proxy/https troubleshooting
        urlProtocol: req.protocol,
        secureTransport: req.secure
      });
    }

    console.warn('[CSRF] Invalid token on', {
      method: req.method,
      path: req.path,
      hasSession: Boolean(req.session?.csrfToken),
      hasToken: Boolean(token),
      xhr: Boolean(req.xhr),
      accept: req.headers.accept
    });



    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token.' });
    }
    req.flash('error_msg', 'Security validation failed (Invalid CSRF token). Please try again.');
    return res.status(403).redirect(req.get('Referrer') || '/');
  }


  next();
};

