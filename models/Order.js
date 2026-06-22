const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  customer: {
    name: { type: String, required: [true, 'Customer name is required'] },
    phone: { type: String, required: [true, 'Phone number is required'] },
    email: { type: String, default: '' },
    address: { type: String, required: [true, 'Address is required'] },
    city: { type: String, required: [true, 'City is required'] },
    state: { type: String, required: [true, 'State is required'] },
    pincode: { type: String, required: [true, 'Pincode is required'] }
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: { type: String, required: true },
    productImage: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    totalPrice: { type: Number, required: true }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  shippingCharge: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['Online Payment', 'Cash On Delivery', 'UPI'],
    default: 'Online Payment'
  },

  // Payment state for online/COD flows
  // Pending: initiated but not completed/verified
  // Paid: online payment verified successfully
  // Failed: online payment failed/verification failed
  // Refunded: (optional) refunded after paid
  paymentStatus: {
    type: String,
    enum: [
      'Pending',
      'Paid',
      'Failed',
      'Refunded',
      'Payment Verification Pending',
      'Payment Rejected'
    ],
    default: 'Pending'
  },


  // Razorpay integration identifiers (Phase 3)
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },

  // COD charge (Phase 1)
  codFee: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  statusHistory: [{
    status: String,
    updatedAt: { type: Date, default: Date.now },
    note: String
  }],

  // Shiprocket / Delhivery future-ready tracking fields
  tracking: {
    carrier: { type: String, default: '' },
    trackingId: { type: String, default: '' },
    trackingUrl: { type: String, default: '' }
  },
  notes: {
    type: String,
    default: ''
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

// Auto-generate order number before saving
orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    this.orderNumber = `KRS${timestamp}${random}`;
  }
  if (!this.statusHistory || this.statusHistory.length === 0) {
    this.statusHistory = [{ status: this.status }];
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);
