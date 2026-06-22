/**
 * Optional auth helper for cart routes.
 * - If user is logged in, cart uses ownerType='user'
 * - If not, we allow guest carts (ownerType='guest')
 *
 * We still ensure that a guestId exists so cart persists across refreshes.
 */

const crypto = require('crypto');

function getOrCreateGuestId(req) {
  if (req.session?.guestId) return req.session.guestId;
  if (!req.session) return null;
  const id = crypto.randomUUID();
  req.session.guestId = id;
  return id;
}

module.exports = function requireLoginForCart(req, res, next) {
  // Auth is intentionally removed: carts are allowed for guests.
  // We only ensure that a stable guestId exists so the cart can persist.
  try {
    if (req.session?.userId) {
      return next();
    }

    const guestId = getOrCreateGuestId(req);
    if (!guestId) {
      // Do not redirect to /login anymore.
      return res.status(500).json({ success: false, message: 'Unable to initialize cart' });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to initialize cart' });
  }
};


