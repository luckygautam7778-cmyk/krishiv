const path = require('path');
const fs = require('fs');
const UpiQrCode = require('../models/UpiQrCode');

// Upload single UPI QR code image; replace previous.
exports.getQrCode = async (req, res) => {
  try {
    const qr = await UpiQrCode.findOne().sort({ updatedAt: -1 });

    // Admin page render
    if (req.accepts('html')) {
      return res.render('admin/upi-qr', {
        title: 'UPI QR Management | Poshaak Admin',
        pageTitle: 'UPI QR Management',
        adminUsername: req.session?.adminUsername,
        qrCode: qr?.qrCode || null,
        updatedAt: qr?.updatedAt || null
      });
    }

    // JSON fallback (for any potential async usage)
    res.json({
      success: true,
      qrCode: qr?.qrCode || null,
      updatedAt: qr?.updatedAt || null
    });
  } catch (err) {
    console.error('[GET QR CODE] error', err);
    res.status(500).json({ success: false, message: 'Failed to load QR code' });
  }
};


exports.postQrCode = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      req.flash('error_msg', 'Please upload a QR code image');
      return res.redirect('/admin/dashboard');
    }

    // Store as a browser-accessible public URL path.
    // multer.file.path is an absolute filesystem path like:
    //   .../public/uploads/<file>
    // We convert it to:
    //   /uploads/<file>
    let newQrPath = file.path ? file.path : file.filename;
    if (typeof newQrPath === 'string' && newQrPath.includes(path.join('public', 'uploads'))) {
      const idx = newQrPath.indexOf(path.join('public', 'uploads'));
      newQrPath = newQrPath.slice(idx).replace(new RegExp('^public\\\\uploads\\\\?'), '').replace(/\\/g, '/');
      // result is like: <filename>, then prefix /uploads
      newQrPath = `/uploads/${path.basename(newQrPath)}`;
    } else if (typeof newQrPath === 'string' && newQrPath.includes('/public/uploads/')) {
      newQrPath = `/uploads/${newQrPath.split('/public/uploads/').pop()}`;
    } else {
      // If multer is configured differently, fall back to original value.
      newQrPath = file.path ? file.path : file.filename;
      if (typeof newQrPath === 'string' && newQrPath.includes('/public/')) {
        newQrPath = newQrPath.split('/public/').pop();
        newQrPath = `/${newQrPath}`;
      }
    }


    // Replace previous: store only one latest record.
    const old = await UpiQrCode.findOne().sort({ updatedAt: -1 });

    if (old?.qrCode && typeof old.qrCode === 'string' && old.qrCode !== newQrPath) {
      // Best-effort delete old file if it is a local path.
      // (If old.qrCode is a URL, ignore.)
      try {
        const looksLikeLocal = old.qrCode.includes('public/uploads') || old.qrCode.startsWith('/uploads/');
        if (looksLikeLocal) {
          const oldLocalPath = old.qrCode.startsWith('/uploads/')
            ? path.join(__dirname, '../public', old.qrCode)
            : old.qrCode;
          if (fs.existsSync(oldLocalPath) && fs.statSync(oldLocalPath).isFile()) {
            fs.unlinkSync(oldLocalPath);
          }
        }
      } catch (e) {
        console.error('[postQrCode] failed to delete old qr file:', e);
      }
    }

    // Keep only one record.
    await UpiQrCode.findOneAndUpdate(
      {},
      { qrCode: newQrPath, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    console.log('[postQrCode] uploaded', {
      stored: newQrPath,
      originalname: file.originalname,
      mimetype: file.mimetype
    });

    req.flash('success_msg', 'UPI QR code updated successfully');
    return res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('[postQrCode] error', err);
    req.flash('error_msg', 'Failed to update UPI QR code');
    return res.redirect('/admin/dashboard');
  }
};

