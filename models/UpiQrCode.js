const mongoose = require('mongoose');

const upiQrCodeSchema = new mongoose.Schema({
  qrCode: {
    type: String,
    default: ''
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

upiQrCodeSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UpiQrCode', upiQrCodeSchema);

