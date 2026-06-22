const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin, isNotAdmin, requireAdminRole } = require('../middleware/auth');


const upload = require('../middleware/upload');
const uploadQr = require('../middleware/uploadQr');
const upiQrCodeController = require('../controllers/upiQrCodeController');


// ─── AUTH ─────────────────────────────────────────────────────────────────────
router.get('/login', isNotAdmin, adminController.getLogin);
router.post('/login', isNotAdmin, adminController.postLogin);
router.get('/logout', adminController.getLogout);

// Admin forgot-password routes removed (OTP flow deleted)




// ─── DASHBOARD ────────────────────────────────────────────────────────────────
router.get('/', isAdmin, (req, res) => res.redirect('/admin/dashboard'));
router.get('/dashboard', isAdmin, requireAdminRole('admin','superadmin'), adminController.getDashboard);


// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
router.get('/products', isAdmin, requireAdminRole('admin','superadmin'), adminController.getProducts);

router.get('/products/add', isAdmin, requireAdminRole('admin','superadmin'), adminController.getAddProduct);

router.post('/products/add', isAdmin, requireAdminRole('admin','superadmin'), upload.array('images', 6), adminController.postAddProduct);

router.get('/products/edit/:id', isAdmin, requireAdminRole('admin','superadmin'), adminController.getEditProduct);

router.post('/products/edit/:id', isAdmin, requireAdminRole('admin','superadmin'), upload.array('images', 6), adminController.postEditProduct);

router.delete('/products/:id', isAdmin, requireAdminRole('admin','superadmin'), adminController.deleteProduct);


// ─── CATEGORIES ───────────────────────────────────────────────────────────────
router.get('/categories', isAdmin, adminController.getCategories);
router.post('/categories/add', isAdmin, upload.single('image'), adminController.postAddCategory);
router.post('/categories/edit/:id', isAdmin, upload.single('image'), adminController.postEditCategory);
router.delete('/categories/:id', isAdmin, adminController.deleteCategory);

// ─── ORDERS ───────────────────────────────────────────────────────────────────
router.get('/orders', isAdmin, adminController.getOrders);
router.get('/orders/:id', isAdmin, adminController.getOrderDetail);
router.post('/orders/:id/status', isAdmin, adminController.updateOrderStatus);

// ─── UPI PAYMENT VERIFICATION (Manual) ───────────────────────────────────
router.post('/orders/:id/approve-payment', isAdmin, adminController.approvePayment);
router.post('/orders/:id/reject-payment', isAdmin, adminController.rejectPayment);

// ─── UPI QR CODE UPLOAD (Single QR, replaces previous) ───────────────────
router.get('/upi-qr', isAdmin, upiQrCodeController.getQrCode);
router.post('/upi-qr', isAdmin, uploadQr.single('qrCode'), upiQrCodeController.postQrCode);

// ─── BANNERS ──────────────────────────────────────────────────────────────────


router.get('/banners', isAdmin, adminController.getBanners);
router.post('/banners/add', isAdmin, upload.single('image'), adminController.postAddBanner);
router.delete('/banners/:id', isAdmin, adminController.deleteBanner);
router.post('/banners/:id/toggle', isAdmin, adminController.toggleBanner);

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
router.get('/settings', isAdmin, adminController.getSettings);
router.post('/settings', isAdmin, upload.single('logo'), adminController.postSettings);

module.exports = router;
