const Admin = require('../models/Admin');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Banner = require('../models/Banner');
const Settings = require('../models/Settings');
const slugify = require('slugify');
const fs = require('fs');
const path = require('path');

// ─── AUTH ─────────────────────────────────────────────────────────────────────
exports.getLogin = (req, res) => {
  res.render('admin/login', {
    title: 'Admin Login | Poshaak',
    pageTitle: 'Admin Login',
    layout: false
  });
};

// ─── FORGOT PASSWORD (ADMIN) REMOVED (OTP flow deleted) ───────────────



exports.postLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      req.flash('error_msg', 'Please enter username and password');
      return res.redirect('/admin/login');
    }

    const admin = await Admin.findOne({
      $or: [{ username: username.trim() }, { email: username.trim().toLowerCase() }]
    });

    if (!admin) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/admin/login');
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/admin/login');
    }

    req.session.adminId = admin._id;
    req.session.adminUsername = admin.username;
    req.session.adminRole = admin.role || 'admin';

    req.flash('success_msg', `Welcome back, ${admin.username}!`);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error_msg', 'Login failed. Please try again.');
    res.redirect('/admin/login');
  }
};

exports.getLogout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
};


// ─── DASHBOARD ────────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const [
      totalProducts,
      totalOrders,
      totalCategories,
      recentOrders,
      pendingOrders,
      confirmedOrders,
      packedOrders,
      shippedOrders,
      outForDeliveryOrders,
      deliveredOrders,
      cancelledOrders
    ] = await Promise.all([
      Product.countDocuments({ active: true }),
      Order.countDocuments(),
      Category.countDocuments({ active: true }),
      Order.find().sort({ createdAt: -1 }).limit(5),
      Order.countDocuments({ status: 'Pending' }),
      Order.countDocuments({ status: 'Confirmed' }),
      Order.countDocuments({ status: 'Packed' }),
      Order.countDocuments({ status: 'Shipped' }),
      Order.countDocuments({ status: 'Out for Delivery' }),
      Order.countDocuments({ status: 'Delivered' }),
      Order.countDocuments({ status: 'Cancelled' })
    ]);

    // Revenue from delivered orders
    const deliveredOrdersDocs = await Order.find({ status: 'Delivered' });
    const totalRevenue = deliveredOrdersDocs.reduce((sum, o) => sum + o.totalAmount, 0);

    // Today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({ createdAt: { $gte: today } });

    res.render('admin/dashboard', {
      title: 'Dashboard | Poshaak Admin',
      pageTitle: 'Dashboard',
      adminUsername: req.session.adminUsername,
      totalProducts,
      totalOrders,
      totalCategories,
      totalRevenue,
      todayOrders,
      recentOrders,
      statusCounts: {
        pending: pendingOrders,
        confirmed: confirmedOrders,
        packed: packedOrders,
        shipped: shippedOrders,
        outForDelivery: outForDeliveryOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Server Error');
  }
};

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const { search, category, page = 1 } = req.query;
    const limit = 15;
    const skip = (parseInt(page) - 1) * limit;

    const query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (category) query.category = category;

    const [products, total, categories] = await Promise.all([
      Product.find(query).populate('category').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(query),
      Category.find({ active: true }).sort({ name: 1 })
    ]);

    res.render('admin/products', {
      title: 'Products | Poshaak Admin',
      pageTitle: 'Manage Products',
      adminUsername: req.session.adminUsername,
      products,
      categories,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      query: req.query
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Failed to load products');
    res.redirect('/admin/dashboard');
  }
};

exports.getAddProduct = async (req, res) => {
  try {
    const categories = await Category.find({ active: true }).sort({ name: 1 });
    res.render('admin/product-form', {
      title: 'Add Product | Poshaak Admin',
      pageTitle: 'Add New Product',
      adminUsername: req.session.adminUsername,
      categories,
      product: null,
      isEdit: false
    });
  } catch (err) {
    req.flash('error_msg', 'Failed to load form');
    res.redirect('/admin/products');
  }
};

exports.postAddProduct = async (req, res) => {
  try {
    const {
      name, description, price, discountPrice,
      sku,
      category, stock, fabric, occasion,
      // legacy + new color fields
      color, colors,
      sizes,
      tags,
      featured,
      active,
      productStatus,
      visibilityOnHomepage,
      // scheduled pricing (optional)
      schedulePrice,
      scheduleDiscountPrice,
      scheduleEffectiveAt
    } = req.body;


    // Validation
    if (!name || !description || !price || !category) {
      req.flash('error_msg', 'Please fill all required fields');
      return res.redirect('/admin/products/add');
    }

    // Generate unique slug
    let slug = slugify(name, { lower: true, strict: true });
    const existing = await Product.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    // Handle uploaded images
    const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

    const parsedSizes = sizes
      ? (Array.isArray(sizes) ? sizes : String(sizes).split(',')).map(s => s.trim()).filter(Boolean)
      : [];

    // colors can come from legacy `color` or new `colors` (comma separated or repeated inputs)
    const parsedColors = (() => {
      const inputColors = colors ?? color;
      if (!inputColors) return [];
      if (Array.isArray(inputColors)) return inputColors.map(s => s.trim()).filter(Boolean);
      return String(inputColors).split(',').map(s => s.trim()).filter(Boolean);
    })();

    const parsedTags = tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : [];

    const scheduledPriceChanges = [];
    if ((schedulePrice !== undefined && schedulePrice !== '') || (scheduleEffectiveAt !== undefined && scheduleEffectiveAt !== '')) {

      const eff = scheduleEffectiveAt ? new Date(scheduleEffectiveAt) : null;
      if (!eff || Number.isNaN(eff.getTime())) {
        req.flash('error_msg', 'Invalid schedule effective date');
        return res.redirect('/admin/products/add');
      }
      scheduledPriceChanges.push({
        effectiveAt: eff,
        price: parseFloat(schedulePrice),
        discountPrice: scheduleDiscountPrice ? parseFloat(scheduleDiscountPrice) : null
      });
    }

    const computedSku = (sku || '').toString().trim() || `${slug}-${Date.now().toString().slice(-6)}`;

    const product = new Product({
      name: name.trim(),
      sku: computedSku,
      slug,
      description: description.trim(),
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      category,
      images,
      stock: parseInt(stock) || 0,
      fabric: fabric?.trim() || '',
      occasion: occasion?.trim() || '',
      color: color?.trim?.() || '', // keep legacy field populated
      colors: parsedColors,
      sizes: parsedSizes,
      tags: parsedTags,
      featured: featured === 'on',
      active: active !== 'false',
      productStatus: productStatus || undefined,
      visibilityOnHomepage: visibilityOnHomepage === 'on' || visibilityOnHomepage === true,
      scheduledPriceChanges
    });


    await product.save();
    req.flash('success_msg', `Product "${product.name}" added successfully!`);
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Add product error:', err);
    req.flash('error_msg', 'Failed to add product: ' + err.message);
    res.redirect('/admin/products/add');
  }
};

exports.getEditProduct = async (req, res) => {
  try {
    const [product, categories] = await Promise.all([
      Product.findById(req.params.id).populate('category'),
      Category.find({ active: true }).sort({ name: 1 })
    ]);

    if (!product) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/admin/products');
    }

    res.render('admin/product-form', {
      title: 'Edit Product | Poshaak Admin',
      pageTitle: 'Edit Product',
      adminUsername: req.session.adminUsername,
      product,
      categories,
      isEdit: true
    });
  } catch (err) {
    req.flash('error_msg', 'Failed to load product');
    res.redirect('/admin/products');
  }
};

exports.postEditProduct = async (req, res) => {
  try {
    const {
      name, description, price, discountPrice,
      sku,
      category, stock, fabric, occasion,
      // legacy + new color fields
      color, colors,
      // new arrays
      sizes,
      tags,
      featured,
      active,
      productStatus,
      visibilityOnHomepage,
      // scheduled pricing (optional)
      schedulePrice,
      scheduleDiscountPrice,
      scheduleEffectiveAt,
      removeImages
    } = req.body;


    const product = await Product.findById(req.params.id);
    if (!product) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/admin/products');
    }

    // Handle image removal
    let images = [...product.images];
    if (removeImages) {
      const toRemove = Array.isArray(removeImages) ? removeImages : [removeImages];
      toRemove.forEach(imgPath => {
        const fullPath = path.join(__dirname, '../public', imgPath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        images = images.filter(img => img !== imgPath);
      });
    }

    // Add new uploaded images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(f => `/uploads/${f.filename}`);
      images = [...images, ...newImages];
    }

    const parsedSizes = sizes
      ? (Array.isArray(sizes) ? sizes : String(sizes).split(',')).map(s => s.trim()).filter(Boolean)
      : [];

    const parsedColors = (() => {
      const inputColors = colors ?? color;
      if (!inputColors) return [];
      if (Array.isArray(inputColors)) return inputColors.map(s => s.trim()).filter(Boolean);
      return String(inputColors).split(',').map(s => s.trim()).filter(Boolean);
    })();

    const parsedTags = tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : [];

    const scheduledPriceChanges = [];
    if ((schedulePrice !== undefined && schedulePrice !== '') || (scheduleEffectiveAt !== undefined && scheduleEffectiveAt !== '')) {
      const eff = scheduleEffectiveAt ? new Date(scheduleEffectiveAt) : null;
      if (!eff || Number.isNaN(eff.getTime())) {
        req.flash('error_msg', 'Invalid schedule effective date');
        return res.redirect(`/admin/products/edit/${req.params.id}`);
      }
      scheduledPriceChanges.push({
        effectiveAt: eff,
        price: parseFloat(schedulePrice),
        discountPrice: scheduleDiscountPrice ? parseFloat(scheduleDiscountPrice) : null
      });
    }


    // Update slug if name changed
    let slug = product.slug;
    if (name !== product.name) {
      slug = slugify(name, { lower: true, strict: true });
      const existing = await Product.findOne({ slug, _id: { $ne: product._id } });
      if (existing) slug = `${slug}-${Date.now()}`;
    }

    const updateSku = (sku || '').toString().trim() || product.sku;

    await Product.findByIdAndUpdate(req.params.id, {
      name: name.trim(),
      sku: updateSku,
      slug,
      description: description.trim(),
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      category,
      images,
      stock: parseInt(stock) || 0,
      fabric: fabric?.trim() || '',
      occasion: occasion?.trim() || '',

      // legacy + new fields
      color: color?.trim() || '',
      colors: parsedColors,
      sizes: parsedSizes,
      tags: parsedTags,

      featured: featured === 'on',
      active: active !== 'false',
      productStatus: productStatus || undefined,
      visibilityOnHomepage: visibilityOnHomepage === 'on' || visibilityOnHomepage === true,

      // scheduled pricing
      scheduledPriceChanges: scheduledPriceChanges.length ? scheduledPriceChanges : undefined,

      updatedAt: new Date()
    });


    req.flash('success_msg', 'Product updated successfully!');
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Edit product error:', err);
    req.flash('error_msg', 'Failed to update product: ' + err.message);
    res.redirect(`/admin/products/edit/${req.params.id}`);
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.json({ success: false, message: 'Product not found' });
    }

    // Delete images
    product.images.forEach(imgPath => {
      const fullPath = path.join(__dirname, '../public', imgPath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });

    await Product.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
};

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
    res.render('admin/categories', {
      title: 'Categories | Poshaak Admin',
      pageTitle: 'Manage Categories',
      adminUsername: req.session.adminUsername,
      categories
    });
  } catch (err) {
    req.flash('error_msg', 'Failed to load categories');
    res.redirect('/admin/dashboard');
  }
};

exports.postAddCategory = async (req, res) => {
  try {
    const { name, description, sortOrder, active } = req.body;
    if (!name) {
      req.flash('error_msg', 'Category name is required');
      return res.redirect('/admin/categories');
    }

    let slug = slugify(name, { lower: true, strict: true });
    const existing = await Category.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    const image = req.file ? `/uploads/${req.file.filename}` : '';

    await Category.create({
      name: name.trim(),
      slug,
      description: description?.trim() || '',
      image,
      sortOrder: parseInt(sortOrder) || 0,
      active: active !== 'false'
    });

    req.flash('success_msg', 'Category added successfully!');
    res.redirect('/admin/categories');
  } catch (err) {
    req.flash('error_msg', 'Failed to add category: ' + err.message);
    res.redirect('/admin/categories');
  }
};

exports.postEditCategory = async (req, res) => {
  try {
    const { name, description, sortOrder, active } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) {
      req.flash('error_msg', 'Category not found');
      return res.redirect('/admin/categories');
    }

    const updateData = {
      name: name.trim(),
      description: description?.trim() || '',
      sortOrder: parseInt(sortOrder) || 0,
      active: active === 'true'
    };

    if (req.file) {
      // Delete old image
      if (category.image) {
        const oldPath = path.join(__dirname, '../public', category.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.image = `/uploads/${req.file.filename}`;
    }

    await Category.findByIdAndUpdate(req.params.id, updateData);
    req.flash('success_msg', 'Category updated!');
    res.redirect('/admin/categories');
  } catch (err) {
    req.flash('error_msg', 'Failed to update category');
    res.redirect('/admin/categories');
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const productCount = await Product.countDocuments({ category: req.params.id });
    if (productCount > 0) {
      return res.json({ success: false, message: `Cannot delete: ${productCount} products in this category` });
    }
    const cat = await Category.findByIdAndDelete(req.params.id);
    if (cat?.image) {
      const p = path.join(__dirname, '../public', cat.image);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    return res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
};

// ─── ORDERS ───────────────────────────────────────────────────────────────────
exports.getOrders = async (req, res) => {
  try {
    const { status, search, page = 1 } = req.query;
    const limit = 15;
    const skip = (parseInt(page) - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query)
    ]);

    res.render('admin/orders', {
      title: 'Orders | Poshaak Admin',
      pageTitle: 'Manage Orders',
      adminUsername: req.session.adminUsername,
      orders,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      query: req.query,
      statusList: ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled']
    });
  } catch (err) {
    req.flash('error_msg', 'Failed to load orders');
    res.redirect('/admin/dashboard');
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    if (!order) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/admin/orders');
    }

    res.render('admin/order-detail', {
      title: `Order ${order.orderNumber} | Poshaak Admin`,
      pageTitle: `Order #${order.orderNumber}`,
      adminUsername: req.session.adminUsername,
      order,
      statusList: ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled']
    });
  } catch (err) {
    req.flash('error_msg', 'Failed to load order');
    res.redirect('/admin/orders');
  }
};

exports.updateOrderStatus = async (req, res) => {

  try {
    const { status, note, trackingId, trackingUrl, carrier } = req.body;
    const validStatuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

    if (!validStatuses.includes(status)) {
      req.flash('error_msg', 'Invalid status');
      return res.redirect(`/admin/orders/${req.params.id}`);
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/admin/orders');
    }

    order.status = status;
    order.statusHistory.push({ status, note: note || '' });

    // Assign tracking fields for future Shiprocket/Delhivery integrations
    if (typeof trackingId !== 'undefined') order.tracking.trackingId = (trackingId || '').toString().trim();
    if (typeof trackingUrl !== 'undefined') order.tracking.trackingUrl = (trackingUrl || '').toString().trim();
    if (typeof carrier !== 'undefined') order.tracking.carrier = (carrier || '').toString().trim();
    order.updatedAt = new Date();
    await order.save();

    // Notify admin (must never block order status update)
    try {
      const { notifyAdmin } = require('../scripts/notifyAdmin');
      await notifyAdmin({
        type: 'ORDER_STATUS_UPDATED',
        order,
        products: [],
        lowStockItems: []
      });
    } catch (e) {
      console.error('Admin notification (ORDER_STATUS_UPDATED) failed:', e);
    }

    // Restore stock if cancelled
    if (status === 'Cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
      }
    }

    req.flash('success_msg', `Order status updated to "${status}"`);
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (err) {
    console.error('Update order status error:', err);
    req.flash('error_msg', 'Failed to update status');
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};

// ─── BANNERS ──────────────────────────────────────────────────────────────────
exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ sortOrder: 1 });
    res.render('admin/banners', {
      title: 'Banners | Poshaak Admin',
      pageTitle: 'Manage Banners',
      adminUsername: req.session.adminUsername,
      banners
    });
  } catch (err) {
    req.flash('error_msg', 'Failed to load banners');
    res.redirect('/admin/dashboard');
  }
};

exports.postAddBanner = async (req, res) => {
  try {
    const { title, subtitle, link, buttonText, sortOrder, active } = req.body;
    if (!title || !req.file) {
      req.flash('error_msg', 'Title and image are required');
      return res.redirect('/admin/banners');
    }

    await Banner.create({
      title: title.trim(),
      subtitle: subtitle?.trim() || '',
      image: `/uploads/${req.file.filename}`,
      link: link || '/products',
      buttonText: buttonText || 'Shop Now',
      sortOrder: parseInt(sortOrder) || 0,
      active: active !== 'false'
    });

    req.flash('success_msg', 'Banner added successfully!');
    res.redirect('/admin/banners');
  } catch (err) {
    req.flash('error_msg', 'Failed to add banner: ' + err.message);
    res.redirect('/admin/banners');
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (banner?.image) {
      const p = path.join(__dirname, '../public', banner.image);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    return res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
};

exports.toggleBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.json({ success: false });
    banner.active = !banner.active;
    await banner.save();
    return res.json({ success: true, active: banner.active });
  } catch (err) {
    return res.json({ success: false });
  }
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    res.render('admin/settings', {
      title: 'Settings | Poshaak Admin',
      pageTitle: 'Business Settings',
      adminUsername: req.session.adminUsername,
      settings
    });
  } catch (err) {
    req.flash('error_msg', 'Failed to load settings');
    res.redirect('/admin/dashboard');
  }
};

exports.postSettings = async (req, res) => {
  try {
    // Separate settings update from password change.
    // Password validation should run ONLY when password fields + action are submitted.
    const isPasswordChange = req.body && req.body.action === 'change_password'
      && (req.body.currentPassword || req.body.newPassword || req.body.confirmNewPassword);

    if (isPasswordChange) {
      const { currentPassword, newPassword, confirmNewPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        req.flash('error_msg', 'All password fields are required');
        return res.redirect('/admin/settings');
      }

      if (String(newPassword).length < 8) {
        req.flash('error_msg', 'New password must be at least 8 characters');
        return res.redirect('/admin/settings');
      }

      if (newPassword !== confirmNewPassword) {
        req.flash('error_msg', 'New password confirmation does not match');
        return res.redirect('/admin/settings');
      }

      const admin = await Admin.findById(req.session.adminId);
      if (!admin) {
        req.flash('error_msg', 'Admin not found');
        return res.redirect('/admin/login');
      }

      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) {
        req.flash('error_msg', 'Current password is incorrect');
        return res.redirect('/admin/settings');
      }

      // Hash new password (Admin schema has a pre-save hook, so set and save)
      admin.password = newPassword;
      await admin.save();

      req.flash('success_msg', 'Password updated successfully.');

      // Log out active sessions
      return req.session.destroy(() => {
        res.redirect('/admin/login');
      });


    }

    // Otherwise, business settings update
    const {
      businessName, tagline, phone, whatsapp,
      notificationEmail, notificationWhatsAppPhone,
      email, address, city, state, aboutUs,
      facebook, instagram, shippingCharge, freeShippingAbove, metaDescription,

      // payment settings
      upiId,
      enableUPIPayments,
      paymentBusinessName
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();

    const enableUPI = enableUPIPayments === 'on' || enableUPIPayments === true || enableUPIPayments === 'true';

    const trimmedUpiId = (upiId ?? '').toString().trim();
    const trimmedPaymentBusinessName = (paymentBusinessName ?? '').toString().trim();

    // Validation: UPI fields required only when UPI payments are enabled
    if (enableUPI) {
      if (!trimmedUpiId) {
        req.flash('error_msg', 'Business UPI ID is required when UPI Payments are enabled');
        return res.redirect('/admin/settings');
      }
      if (!trimmedPaymentBusinessName) {
        req.flash('error_msg', 'Payment Business Name is required when UPI Payments are enabled');
        return res.redirect('/admin/settings');
      }
      // Basic sanitation: prevent obviously invalid values
      if (trimmedUpiId.length < 3 || !trimmedUpiId.includes('@')) {
        req.flash('error_msg', 'Please enter a valid Business UPI ID (example: abc@oksbi)');
        return res.redirect('/admin/settings');
      }
    }

    Object.assign(settings, {
      businessName: businessName?.trim() || 'Poshaak',
      tagline: tagline?.trim() || '',
      phone: phone?.trim() || '',
      whatsapp: whatsapp?.trim() || '',
      notificationEmail: notificationEmail?.trim() || '',
      notificationWhatsAppPhone: notificationWhatsAppPhone?.trim() || '',
      email: email?.trim() || '',
      address: address?.trim() || '',
      city: city?.trim() || '',
      state: state?.trim() || '',
      aboutUs: aboutUs?.trim() || '',
      facebook: facebook?.trim() || '',
      instagram: instagram?.trim() || '',
      shippingCharge: parseFloat(shippingCharge) || 0,
      freeShippingAbove: parseFloat(freeShippingAbove) || 999,
      metaDescription: metaDescription?.trim() || '',

      enableUPIPayments: enableUPI,
      upiId: trimmedUpiId,
      paymentBusinessName: trimmedPaymentBusinessName
    });

    if (req.file) {
      if (settings.logo) {
        const old = path.join(__dirname, '../public', settings.logo);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      settings.logo = `/uploads/${req.file.filename}`;
    }

    await settings.save();
    req.flash('success_msg', 'Settings saved successfully!');
    res.redirect('/admin/settings');
  } catch (err) {
    console.error('Settings error:', err);
    req.flash('error_msg', 'Failed to save settings');
    res.redirect('/admin/settings');
  }
};

// ─── UPI PAYMENT MANUAL VERIFICATION ─────────────────────────────────────────
// Approve payment (UPI)
exports.approvePayment = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      req.flash('error_msg', 'Order not found');
      return res.redirect(`/admin/orders/${orderId}`);
    }

    const oldPaymentStatus = order.paymentStatus;

    if (oldPaymentStatus === 'Paid') {
      req.flash('error_msg', 'Payment already approved');
      return res.redirect(`/admin/orders/${orderId}`);
    }

    if (oldPaymentStatus !== 'Payment Verification Pending') {
      req.flash('error_msg', 'Payment cannot be approved in current state');
      return res.redirect(`/admin/orders/${orderId}`);
    }

    order.paymentStatus = 'Paid';
    order.status = 'Confirmed';

    // Stock reduction for UPI orders should only happen when admin approves.
    for (const item of order.items || []) {
      const fresh = await Product.findById(item.product);
      if (!fresh || !fresh.active) {
        req.flash('error_msg', `Product unavailable: "${item.productName}"`);
        return res.redirect(`/admin/orders/${orderId}`);
      }
      if ((fresh.stock || 0) < item.quantity) {
        req.flash('error_msg', `Not enough stock for "${item.productName}". Available: ${fresh.stock}.`);
        return res.redirect(`/admin/orders/${orderId}`);
      }

      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
    }

    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: 'Confirmed', note: 'Payment verified and approved by admin' });
    order.updatedAt = new Date();

    await order.save();

    console.log('[approvePayment]', {
      orderId,
      oldPaymentStatus,
      newPaymentStatus: order.paymentStatus
    });

    req.flash('success_msg', 'Payment approved successfully');
    return res.redirect(`/admin/orders/${orderId}`);
  } catch (err) {
    console.error('[approvePayment] error', err);
    req.flash('error_msg', 'Failed to approve payment');
    return res.redirect(`/admin/orders/${req.params.id}`);
  }
};

// Reject payment (UPI)
exports.rejectPayment = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      req.flash('error_msg', 'Order not found');
      return res.redirect(`/admin/orders/${orderId}`);
    }

    const oldPaymentStatus = order.paymentStatus;

    if (oldPaymentStatus === 'Payment Rejected') {
      req.flash('error_msg', 'Payment already rejected');
      return res.redirect(`/admin/orders/${orderId}`);
    }

    if (oldPaymentStatus !== 'Payment Verification Pending') {
      req.flash('error_msg', 'Payment cannot be rejected in current state');
      return res.redirect(`/admin/orders/${orderId}`);
    }

    order.paymentStatus = 'Payment Rejected';
    order.status = 'Cancelled';

    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: 'Cancelled', note: 'Payment rejected by admin' });
    order.updatedAt = new Date();

    await order.save();

    console.log('[rejectPayment]', {
      orderId,
      oldPaymentStatus,
      newPaymentStatus: order.paymentStatus
    });

    req.flash('success_msg', 'Payment rejected successfully');
    return res.redirect(`/admin/orders/${orderId}`);
  } catch (err) {
    console.error('[rejectPayment] error', err);
    req.flash('error_msg', 'Failed to reject payment');
    return res.redirect(`/admin/orders/${req.params.id}`);
  }
};


