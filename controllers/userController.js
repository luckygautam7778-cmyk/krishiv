const User = require('../models/User');

// Helpers
function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function normalizeEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}

function normalizePhone(phone) {
  return (phone || '').toString().replace(/\D/g, '');
}

// Customer authentication removed.
// Intentionally left blank to prevent accidental usage.


