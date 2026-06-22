const Product = require('../models/Product');
const Category = require('../models/Category');
const Banner = require('../models/Banner');
const Order = require('../models/Order');
const Settings = require('../models/Settings');

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
exports.getHome = async (req, res) => {
  try {
    const [banners, featuredProducts, categories, settings] = await Promise.all([
      Banner.find({ active: true }).sort({ sortOrder: 1 }).limit(5),
      Product.find({ active: true, featured: true, images: { $exists: true, $ne: [], $not: { $size: 0 } } })
        .populate('category')
        .limit(8)
        .sort({ createdAt: -1 }),

      Category.find({ active: true }).sort({ sortOrder: 1 }).limit(8),
      Settings.findOne()
    ]);

    const newArrivals = await Product.find({
      active: true,
      images: { $exists: true, $ne: [], $not: { $size: 0 } }
    })
      .populate('category')
      .sort({ createdAt: -1 })
      .limit(8);


    res.render('index', {
      title: `${settings?.businessName || 'Poshaak'} - Traditional Indian Poshak`,
      pageTitle: 'Home',
      banners,
      featuredProducts,
      categories,
      newArrivals,
      settings
    });
  } catch (err) {
    console.error('Home page error:', err);
    res.status(500).render('500', { title: 'Error', pageTitle: 'Error', error: err.message });
  }
};

// ─── PRODUCT LISTING ──────────────────────────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const { search, category, sort, minPrice, maxPrice, page = 1 } = req.query;
    const limit = 12;
    const skip = (parseInt(page) - 1) * limit;

    // Build query
    const query = { active: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { fabric: { $regex: search, $options: 'i' } },
        { occasion: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      const cat = await Category.findOne({ slug: category });
      if (cat) query.category = cat._id;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Sort options
    let sortOption = { createdAt: -1 };
    if (sort === 'price-asc') sortOption = { price: 1 };
    else if (sort === 'price-desc') sortOption = { price: -1 };
    else if (sort === 'name-asc') sortOption = { name: 1 };
    else if (sort === 'popular') sortOption = { views: -1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };

    const [products, total, categories] = await Promise.all([
      Product.find(query).populate('category').sort(sortOption).skip(skip).limit(limit),
      Product.countDocuments(query),
      Category.find({ active: true }).sort({ sortOrder: 1 })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.render('products', {
      title: 'Shop All Products | Poshaak',
      pageTitle: search ? `Search: "${search}"` : (category ? categories.find(c => c.slug === category)?.name || 'Products' : 'All Products'),
      products,
      categories,
      total,
      totalPages,
      currentPage: parseInt(page),
      query: req.query
    });
  } catch (err) {
    console.error('Products page error:', err);
    res.status(500).render('500', { title: 'Error', pageTitle: 'Error', error: err.message });
  }
};

// ─── PRODUCT DETAIL ───────────────────────────────────────────────────────────
exports.getProductDetail = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, active: true }).populate('category');
    if (!product) {
      return res.status(404).render('404', { title: '404 | Poshaak', pageTitle: 'Product Not Found' });
    }

    // Increment views
    await Product.findByIdAndUpdate(product._id, { $inc: { views: 1 } });

    // Related products
    const related = await Product.find({
      category: product.category._id,
      active: true,
      _id: { $ne: product._id }
    }).populate('category').limit(4);

    res.render('product-detail', {
      title: `${product.name} | Poshaak`,
      pageTitle: product.name,
      product,
      related
    });
  } catch (err) {
    console.error('Product detail error:', err);
    res.status(500).render('500', { title: 'Error', pageTitle: 'Error', error: err.message });
  }
};

// ─── ABOUT PAGE ───────────────────────────────────────────────────────────────
exports.getAbout = async (req, res) => {
  try {
    res.render('about', {
      title: 'About Us | Poshaak',
      pageTitle: 'About Us'
    });
  } catch (err) {
    res.status(500).render('500', { title: 'Error', pageTitle: 'Error', error: err.message });
  }
};

// ─── CONTACT PAGE ─────────────────────────────────────────────────────────────
exports.getContact = async (req, res) => {
  try {
    res.render('contact', {
      title: 'Contact Us | Poshaak',
      pageTitle: 'Contact Us'
    });
  } catch (err) {
    res.status(500).render('500', { title: 'Error', pageTitle: 'Error', error: err.message });
  }
};

exports.postContact = async (req, res) => {
  try {
    const { name, phone, email, message } = req.body;
    if (!name || !phone || !message) {
      req.flash('error_msg', 'Please fill in all required fields');
      return res.redirect('/contact');
    }
    // In production, integrate email service here
    req.flash('success_msg', 'Thank you! We will contact you shortly.');
    res.redirect('/contact');
  } catch (err) {
    req.flash('error_msg', 'Something went wrong. Please try again.');
    res.redirect('/contact');
  }
};

// ─── ORDER SUCCESS ────────────────────────────────────────────────────────────
exports.getOrderSuccess = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    if (!order) return res.redirect('/');

    res.render('order-success', {
      title: 'Order Placed | Poshaak',
      pageTitle: 'Order Confirmed!',
      order
    });
  } catch (err) {
    res.redirect('/');
  }
};

// ─── CUSTOMER ORDER HISTORY & TRACKING ────────────────────────────────────────
exports.getOrderHistory = async (req, res) => {
  try {
    const phone = (req.query.phone || '').toString().trim();
    const query = phone ? { 'customer.phone': phone } : {};

    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(50);

    return res.render('order-history', {
      title: 'Order History | Poshaak',
      pageTitle: 'Your Orders',
      orders,
      phone
    });
  } catch (err) {
    return res.redirect('/');
  }
};

exports.getTrackingByOrderNumber = async (req, res) => {
  try {
    const orderNumber = (req.params.orderNumber || '').toString().trim();
    const order = await Order.findOne({ orderNumber });

    if (!order) {
      return res.render('tracking', {
        title: 'Tracking | Poshaak',
        pageTitle: 'Tracking',
        notFound: true,
        order: null
      });
    }

    return res.render('tracking', {
      title: 'Tracking | Poshaak',
      pageTitle: `Tracking: #${order.orderNumber}`,
      order,
      notFound: false
    });
  } catch (err) {
    return res.redirect('/');
  }
};

