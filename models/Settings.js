const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  businessName: { type: String, default: 'Poshaak' },
  tagline: { type: String, default: 'Traditional Elegance, Modern Grace' },
  phone: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  email: { type: String, default: '' },

  // Admin notifications (for order + alerts)
  notificationEmail: { type: String, default: '' },
  // digits only e.g. 919876543210
  notificationWhatsAppPhone: { type: String, default: '' },

  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  aboutUs: { type: String, default: '' },
  facebook: { type: String, default: '' },
  instagram: { type: String, default: '' },
  logo: { type: String, default: '' },
  shippingCharge: { type: Number, default: 0 },
  freeShippingAbove: { type: Number, default: 999 },

  // Razorpay credentials (Phase 3)
  razorpayKeyId: { type: String, default: '' },
  razorpaySecret: { type: String, default: '' },

  // WhatsApp business identifiers (notifications)
  businessWhatsAppNumber: { type: String, default: '' },
  businessEmail: { type: String, default: '' },

  // UPI configuration
  // Must be configured by admin. Keep blank on fresh install.
  upiId: { type: String, default: '' },

  // When enabled, checkout UI and UPI data are expected to be valid.
  enableUPIPayments: { type: Boolean, default: false },

  // Receiver / payment branding name shown alongside UPI.
  paymentBusinessName: { type: String, default: '' },

  // COD configuration (Phase 1)
  enableCOD: { type: Boolean, default: true },
  codFeeAmount: { type: Number, default: 40 },
  metaDescription: {
    type: String,
    default: 'Poshaak - Premium Traditional Indian Clothing. Shop authentic Lehengas, Sarees, Salwar Suits and more.'
  },
  updatedAt: { type: Date, default: Date.now }
});

settingsSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Settings', settingsSchema);
