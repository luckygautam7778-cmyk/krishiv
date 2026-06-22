function normalizeWhatsAppNumber(input) {
  const raw = (input ?? '').toString();
  const digits = raw.replace(/\D/g, '');
  return digits;
}

function isValidInternationalOrIndianWhatsApp(input) {
  const digits = normalizeWhatsAppNumber(input);
  // Basic validation: 10 digits (common India) OR 12-15 digits (international)
  if (!digits) return false;
  if (digits.length === 10) return true; // likely Indian local number if provided without country code
  if (digits.length >= 12 && digits.length <= 15) return true;
  // allow longer only if starts with country code and typical ranges
  return false;
}

function toWaMeLink(phoneDigits, message) {
  const digits = normalizeWhatsAppNumber(phoneDigits);
  if (!digits) return '';
  const text = encodeURIComponent(message || 'Hello');
  return `https://wa.me/${digits}?text=${text}`;
}

module.exports = {
  normalizeWhatsAppNumber,
  isValidInternationalOrIndianWhatsApp,
  toWaMeLink
};

