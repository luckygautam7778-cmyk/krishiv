const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['ORDER_CREATED', 'ORDER_STATUS_UPDATED', 'LOW_STOCK_ALERT'],
    required: true
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },

  payload: {
    orderNumber: { type: String, default: '' },
    customerName: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    totalAmount: { type: Number, default: 0 },
    orderStatus: { type: String, default: '' },

    // optional extras
    products: { type: Array, default: [] },
    lowStockItems: { type: Array, default: [] }
  },

  email: {
    to: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'skipped'],
      default: 'pending'
    },
    failureReason: { type: String, default: '' }
  },

  whatsapp: {
    to: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'skipped'],
      default: 'pending'
    },
    failureReason: { type: String, default: '' }
  },

  overallStatus: {
    type: String,
    enum: ['pending', 'partial', 'sent', 'failed'],
    default: 'pending'
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);

