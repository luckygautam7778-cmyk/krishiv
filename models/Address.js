const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    label: { type: String, default: 'Home', trim: true, maxlength: 30 },

    name: { type: String, required: [true, 'Recipient name is required'], trim: true, minlength: 2 },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian number']
    },

    line1: { type: String, required: [true, 'Address line is required'], trim: true, minlength: 5 },
    city: { type: String, required: [true, 'City is required'], trim: true, minlength: 2 },
    state: { type: String, required: [true, 'State is required'], trim: true, minlength: 2 },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
      match: [/^\d{6}$/, 'Pincode must be a valid 6-digit value']
    }
  },
  { timestamps: true }
);

addressSchema.index({ user: 1, label: 1 });

module.exports = mongoose.model('Address', addressSchema);

