const mongoose = require('mongoose');

const checkoutIdempotencySchema = new mongoose.Schema({
  // Unique key created by the server for a given checkout attempt.
  // Used to prevent duplicate order creation.
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Signature of the draft for which this key was issued.
  // Helps prevent reusing a key for a different request.
  signature: {
    type: String,
    default: ''
  },

  // Link to created order when completed.
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },

  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Pending'
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

checkoutIdempotencySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CheckoutIdempotency', checkoutIdempotencySchema);

