require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').MongoStore;
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB and bootstrap admin
connectDB().then(() => {
  const bootstrapAdmin = require('./utils/bootstrapAdmin');
  bootstrapAdmin();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Method override for PUT/DELETE in forms
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// If behind a proxy (e.g., Render), make Express trust proxy headers.
// This ensures secure cookies behave correctly.
app.set('trust proxy', 1);

// Session configuration using connect-mongo
app.use(session({
  secret: process.env.SESSION_SECRET || 'poshaak-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/poshaak',
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));


// Flash messages
app.use(flash());

// CSRF Protection
const csrf = require('./middleware/csrf');
app.use(csrf);

// Global template variables middleware
app.use(async (req, res, next) => {
  try {
    const Settings = require('./models/Settings');
    const Category = require('./models/Category');
    let settings = await Settings.findOne();

    // Customer auth removed. Keep locals.user empty.
    res.locals.user = null;


    if (!settings) {
      settings = await Settings.create({});
    }
    const categories = await Category.find({ active: true }).sort({ sortOrder: 1 });
    res.locals.settings = settings;
    res.locals.categories = categories;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');

    const Cart = require('./models/Cart');
    let cartCount = 0;
    let cartTotal = 0;
    res.locals.cart = [];

    if (req.session?.userId) {
      const cartDoc = await Cart.findOne({ ownerType: 'user', user: req.session.userId, status: 'active' });
      cartCount = (cartDoc?.items || []).reduce((sum, item) => sum + item.quantity, 0);
      cartTotal = (cartDoc?.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
      res.locals.cart = (cartDoc?.items || []).map(it => ({
        productId: it.product,
        name: it.productName,
        price: it.price,
        image: it.productImage,
        quantity: it.quantity
      }));
    } else if (req.session?.guestId) {
      const cartDoc = await Cart.findOne({ ownerType: 'guest', guestId: req.session.guestId, status: 'active' });
      cartCount = (cartDoc?.items || []).reduce((sum, item) => sum + item.quantity, 0);
      cartTotal = (cartDoc?.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
      res.locals.cart = (cartDoc?.items || []).map(it => ({
        productId: it.product,
        name: it.productName,
        price: it.price,
        image: it.productImage,
        quantity: it.quantity
      }));
    }

    res.locals.cartCount = cartCount;
    res.locals.cartTotal = cartTotal;


    res.locals.currentPath = req.path;
    next();
  } catch (err) {
    res.locals.settings = {};
    res.locals.categories = [];
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.cart = req.session.cart || [];
    res.locals.cartCount = 0;
    res.locals.cartTotal = 0;
    res.locals.currentPath = req.path;
    next();
  }
});

// Routes
app.use('/', require('./routes/shop'));
// Customer auth removed
// app.use('/', require('./routes/user'));


app.use('/admin', require('./routes/admin'));

// Public logout confirmation page
app.get('/logout', (req, res) => {
  res.render('logout', {
    title: 'Logged out | Poshaak',
    pageTitle: 'Logged out'
  });
});




// 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Page Not Found | Poshaak',
    pageTitle: 'Page Not Found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).render('500', {
    title: '500 - Server Error | Poshaak',
    pageTitle: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Poshaak server running at http://localhost:${PORT}`);
  console.log(`📦 Admin panel: http://localhost:${PORT}/admin/login`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
