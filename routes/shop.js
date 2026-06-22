const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const cartController = require('../controllers/cartController');
const orderController = require('../controllers/orderController');
const upload = require('../middleware/upload');

// ─── SHOP PAGES ───────────────────────────────────────────────────────────────
router.get('/', shopController.getHome);

router.get('/products', shopController.getProducts);
router.get('/products/:slug', shopController.getProductDetail);
router.get('/about', shopController.getAbout);
router.get('/contact', shopController.getContact);
router.post('/contact', shopController.postContact);

// ─── CART ─────────────────────────────────────────────────────────────────────
const requireLoginForCart = require('../middleware/requireLoginForCart');
router.get('/cart', requireLoginForCart, cartController.getCart);
router.post('/cart/add', requireLoginForCart, cartController.addToCart);
router.post('/cart/update', requireLoginForCart, cartController.updateCart);
router.post('/cart/remove', requireLoginForCart, cartController.removeFromCart);
router.post('/cart/clear', requireLoginForCart, cartController.clearCart);


// ─── CHECKOUT & ORDERS ────────────────────────────────────────────────────────
router.get('/checkout', orderController.getCheckout);

// New multi-step checkout flow
router.post('/checkout/init', orderController.checkoutInit);

router.post('/checkout/upload-payment', (req, res, next) => {
  console.log('[UPLOAD PAYMENT] route hit', { ip: req.ip, userId: req.session?.userId });
  next();
}, upload.single('paymentScreenshot'), orderController.uploadPaymentScreenshot);

router.post('/checkout/confirm', (req, res, next) => {
  console.log('[CONFIRM ORDER] route hit', { ip: req.ip, userId: req.session?.userId });
  next();
}, orderController.confirmOrder);


// Backward-compat (will redirect to new flow)
router.post('/checkout', (req, res) => res.redirect('/checkout'));

router.get('/order-success/:id', shopController.getOrderSuccess);


// Customer pages (order history + tracking)
router.get('/orders', shopController.getOrderHistory);
router.get('/track/:orderNumber', shopController.getTrackingByOrderNumber);

module.exports = router;
