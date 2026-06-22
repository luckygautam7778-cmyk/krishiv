const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, trim: true },
    productImage: { type: String, default: '' },

    quantity: { type: Number, required: true, min: 1, validate: {
      validator: Number.isInteger,
      message: 'Quantity must be an integer'
    } },

    // Snapshot pricing at time of cart change.
    price: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      enum: ['user', 'guest'],
      required: true
    },

    // For ownerType='user'
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // For ownerType='guest' (persisted identifier stored in cookie)
    guestId: { type: String, default: null, index: true, trim: true },

    items: { type: [cartItemSchema], default: [] },

    // soft state
    status: {
      type: String,
      enum: ['active', 'converted', 'abandoned'],
      default: 'active'
    },

    // Totals are cached to avoid recompute for every render.
    subtotal: { type: Number, default: 0, min: 0 },
    updatedBy: { type: String, enum: ['api', 'checkout'], default: 'api' }
  },
  {
    timestamps: true
  }
);

cartSchema.index({ ownerType: 1, user: 1, status: 1 });
cartSchema.index({ ownerType: 1, guestId: 1, status: 1 });

cartSchema.pre('validate', function (next) {
  if (this.ownerType === 'user') {
    if (!this.user) return next(new Error('user cart must have user reference'));
  }
  if (this.ownerType === 'guest') {
    if (!this.guestId) return next(new Error('guest cart must have guestId'));
  }
  next();
});

cartSchema.methods.recalculateTotals = function () {
  const subtotal = (this.items || []).reduce((sum, it) => sum + (it.lineTotal || 0), 0);
  this.subtotal = subtotal;
  return subtotal;
};

module.exports = mongoose.model('Cart', cartSchema);

