const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Banner title is required'],
    trim: true
  },
  subtitle: {
    type: String,
    trim: true,
    default: ''
  },
  image: {
    type: String,
    required: [true, 'Banner image is required']
  },
  link: {
    type: String,
    default: '/products'
  },
  buttonText: {
    type: String,
    default: 'Shop Now'
  },
  active: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Banner', bannerSchema);
