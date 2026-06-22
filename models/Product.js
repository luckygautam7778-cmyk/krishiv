const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  discountPrice: {
    type: Number,
    min: [0, 'Discount price cannot be negative'],
    default: null
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  images: [{
    type: String
  }],
  stock: {
    type: Number,
    default: 10,
    min: [0, 'Stock cannot be negative']
  },
  featured: {
    type: Boolean,
    default: false
  },
  fabric: {
    type: String,
    trim: true
  },
  occasion: {
    type: String,
    trim: true
  },
  // Legacy single color (kept for backward compatibility; migrated to `colors`)
  color: {
    type: String,
    trim: true,
    default: ''
  },

  // Multi-color support (editable from admin)
  colors: [{
    type: String,
    trim: true
  }],

  // Multi-size support (editable from admin)
  sizes: [{
    type: String,
    trim: true
  }],

  tags: [{
    type: String,
    trim: true
  }],

  // Availability derived from stock; still persisted for admin visibility
  availability: {
    type: String,
    enum: ['InStock', 'LimitedStock', 'OutOfStock'],
    default: 'InStock'
  },

  // Product visibility/state in store
  productStatus: {
    type: String,
    enum: ['Draft', 'Active', 'Out of Stock', 'Archived', 'Hidden'],
    default: 'Active'
  },

  // Homepage visibility controls
  visibilityOnHomepage: {
    type: Boolean,
    default: true
  },

  // Deprecated boolean used by existing code paths
  active: {
    type: Boolean,
    default: true
  },

  // Optional scheduled price changes
  scheduledPriceChanges: [{
    effectiveAt: { type: Date, required: true },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: null, min: 0 }
  }],

  views: {
    type: Number,
    default: 0
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

// Virtual for discount percentage
productSchema.virtual('discountPercent').get(function () {
  if (this.discountPrice && this.price > this.discountPrice) {
    return Math.round(((this.price - this.discountPrice) / this.price) * 100);
  }
  return 0;
});

// Virtual for effective price (discounted if available)
productSchema.virtual('effectivePrice').get(function () {
  return this.discountPrice && this.discountPrice < this.price
    ? this.discountPrice
    : this.price;
});

// Helper to ensure backward compatibility for legacy docs
productSchema.methods.migrateLegacyFields = function () {
  // If old `color` exists but `colors` is empty, migrate.
  if ((!this.colors || this.colors.length === 0) && this.color) {
    const normalized = this.color
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    this.colors = normalized.length ? normalized : [this.color.trim()];
  }

  // Ensure status/availability fields exist on old docs.
  if (!this.availability) {
    const stock = this.stock ?? 0;
    this.availability = stock <= 0 ? 'OutOfStock' : stock <= 5 ? 'LimitedStock' : 'InStock';
  }

  if (!this.productStatus) {
    const stock = this.stock ?? 0;
    this.productStatus = stock <= 0 ? 'Out of Stock' : 'Active';
  }

  if (typeof this.visibilityOnHomepage !== 'boolean') {
    this.visibilityOnHomepage = true;
  }
};

// Derived update: availability + productStatus (based on stock)
productSchema.methods.deriveStockState = function (limitedThreshold = 5) {
  const stock = this.stock ?? 0;

  let availability = 'InStock';
  if (stock <= 0) availability = 'OutOfStock';
  else if (stock <= limitedThreshold) availability = 'LimitedStock';

  this.availability = availability;

  // Only auto-force for non-admin-controlled statuses.
  // Admin can set Draft/Archived/Hidden manually.
  if (this.productStatus === 'Active' || !this.productStatus) {
    this.productStatus = availability === 'OutOfStock' ? 'Out of Stock' : 'Active';
  } else if (this.productStatus === 'Out of Stock') {
    // If it comes back to stock, move to Active
    if (availability !== 'OutOfStock') this.productStatus = 'Active';
  }
};

// Apply scheduled price changes if effectiveAt has passed
productSchema.methods.applyScheduledPriceChanges = async function () {
  if (!this.scheduledPriceChanges || this.scheduledPriceChanges.length === 0) return;

  const now = new Date();
  const due = this.scheduledPriceChanges.filter(ch => ch.effectiveAt && ch.effectiveAt <= now);
  if (due.length === 0) return;

  // Use the latest effective change
  due.sort((a, b) => a.effectiveAt - b.effectiveAt);
  const latest = due[due.length - 1];

  this.price = latest.price;
  this.discountPrice = (typeof latest.discountPrice === 'number') ? latest.discountPrice : null;

  // Remove applied changes
  this.scheduledPriceChanges = this.scheduledPriceChanges.filter(ch => !(ch.effectiveAt && ch.effectiveAt <= now));
};


productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Update updatedAt on save + migrate legacy fields and derive stock state
productSchema.pre('save', function (next) {
  try {
    this.updatedAt = Date.now();
    this.migrateLegacyFields?.();
    this.deriveStockState?.(5);
    next();
  } catch (e) {
    next(e);
  }
});


module.exports = mongoose.model('Product', productSchema);
