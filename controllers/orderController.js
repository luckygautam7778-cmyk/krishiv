const Order = require('../models/Order');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const CheckoutIdempotency = require('../models/CheckoutIdempotency');


// ─── GET CHECKOUT ─────────────────────────────────────────────────────────────
exports.getCheckout = async (req, res) => {
  try {
  const cartDoc = await (async () => {
      const Cart = require('../models/Cart');
      const cartOwner = req.session?.userId
        ? { ownerType: 'user', user: req.session.userId, guestId: null }
        : { ownerType: 'guest', user: null, guestId: req.session?.guestId };

      const cartQuery = cartOwner.ownerType === 'user'
        ? { ownerType: 'user', user: cartOwner.user, status: 'active' }
        : { ownerType: 'guest', guestId: cartOwner.guestId, status: 'active' };

      if (cartQuery.ownerType === 'guest' && !cartQuery.guestId) return null;
      return await Cart.findOne(cartQuery);
    })();

    const cart = (cartDoc?.items || []).map(it => ({
      productId: it.product,
      name: it.productName,
      image: it.productImage,
      price: it.price,
      quantity: it.quantity
    }));

    if (cart.length === 0) {
      req.flash('error_msg', 'Your cart is empty');
      return res.redirect('/cart');
    }

    const settings = await Settings.findOne();
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal >= (settings?.freeShippingAbove || 999) ? 0 : (settings?.shippingCharge || 0);
    const total = subtotal + shipping;

    // Active admin-uploaded UPI QR (if any). Do not show placeholder.
    const activeQrDoc = await (async () => {
      try {
        const UpiQrCode = require('../models/UpiQrCode');
        return await UpiQrCode.findOne().sort({ updatedAt: -1 });
      } catch (e) {
        return null;
      }
    })();

    const activeUpiQrUrl = activeQrDoc?.qrCode || null;

    const checkoutDraft = req.session?.checkoutDraft || null;

    res.render('checkout', {
      title: 'Checkout | Krishiv',
      pageTitle: 'Checkout',
      cart,
      subtotal,
      shipping,
      total,
      settings,
      checkoutDraft,
      activeUpiQrUrl
    });

  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).render('500', { title: 'Error', pageTitle: 'Error', error: err.message });
  }
};


// ─── CHECKOUT HELPERS ─────────────────────────────────────────────────────────
const validateCheckoutFields = ({ name, phone, address, city, state, pincode }) => {
  const errors = [];
  if (!name || String(name).trim().length < 2) errors.push('Please enter your full name');
  if (!phone || !/^[6-9]\d{9}$/.test(String(phone).trim())) errors.push('Please enter a valid 10-digit Indian mobile number');
  if (!address || String(address).trim().length < 10) errors.push('Please enter your full address');
  if (!city || String(city).trim().length < 2) errors.push('Please enter your city');
  if (!state || String(state).trim().length < 2) errors.push('Please enter your state');
  if (!pincode || !/^\d{6}$/.test(String(pincode).trim())) errors.push('Please enter a valid 6-digit pincode');
  return errors;
};

const getCartOwner = (req) => {
  if (req.session?.userId) return { ownerType: 'user', user: req.session.userId, guestId: null };
  if (!req.session) {
    return { ownerType: 'guest', user: null, guestId: 'temp-guest-id' };
  }
  if (!req.session.guestId) {
    const crypto = require('crypto');
    req.session.guestId = crypto.randomUUID();
  }
  return { ownerType: 'guest', user: null, guestId: req.session.guestId };
};

const getActiveCartDoc = async (req) => {
  const Cart = require('../models/Cart');
  const cartOwner = getCartOwner(req);

  const cartQuery = cartOwner.ownerType === 'user'
    ? { ownerType: 'user', user: cartOwner.user, status: 'active' }
    : { ownerType: 'guest', guestId: cartOwner.guestId, status: 'active' };

  if (cartQuery.ownerType === 'guest' && !cartQuery.guestId) return null;

  return await Cart.findOne(cartQuery);
};

const cartToViewItems = (cartDoc) => {
  return (cartDoc?.items || []).map(it => ({
    productId: it.product,
    name: it.productName,
    image: it.productImage,
    price: it.price,
    quantity: it.quantity
  }));
};

// ─── BUY NOW INIT ────────────────────────────────────────────────────────────
exports.checkoutInit = async (req, res) => {
  try {
    console.log('[TRACE] START checkoutInit', {
      method: req.method,
      originalUrl: req.originalUrl,
      body: req.body,
      sessionCheckoutDraft: req.session?.checkoutDraft
    });

    const paymentMethod = typeof req.body?.paymentMethod === 'string' ? req.body.paymentMethod.trim() : '';

    if (paymentMethod === 'Cash On Delivery') {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
      const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
      const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
      const city = typeof req.body.city === 'string' ? req.body.city.trim() : '';
      const state = typeof req.body.state === 'string' ? req.body.state.trim() : '';
      const pincode = typeof req.body.pincode === 'string' ? req.body.pincode.trim() : '';
      const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

      const errors = validateCheckoutFields({ name, phone, address, city, state, pincode });
      if (errors.length) {
        req.flash('error_msg', errors.join(', '));
        return res.redirect('/checkout');
      }

      const cartDoc = await getActiveCartDoc(req);
      const cart = cartToViewItems(cartDoc);

      if (!cartDoc || !cart || cart.length === 0) {
        req.flash('error_msg', 'Your cart is empty');
        return res.redirect('/cart');
      }

      // Check stock and deduct it
      for (const item of cart) {
        const fresh = await Product.findById(item.productId);
        if (!fresh || !fresh.active) {
          req.flash('error_msg', `Product unavailable: "${item.name}"`);
          return res.redirect('/checkout');
        }
        if (fresh.stock < item.quantity) {
          req.flash('error_msg', `Not enough stock for "${item.name}". Available: ${fresh.stock}.`);
          return res.redirect('/checkout');
        }
      }

      // Deduct stock
      for (const item of cart) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });

        // Low stock alert (non-blocking)
        try {
          const updated = await Product.findById(item.productId);
          const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 5);
          if (updated && typeof updated.stock === 'number' && updated.stock <= threshold) {
            const { notifyAdmin } = require('../scripts/notifyAdmin');
            await notifyAdmin({
              type: 'LOW_STOCK_ALERT',
              order: null,
              lowStockItems: [{ name: updated.name, sku: updated.sku, stock: updated.stock }]
            });
          }
        } catch (e) {
          console.error('LOW_STOCK_ALERT failed:', e);
        }
      }

      const settings = await Settings.findOne();
      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shipping = subtotal >= (settings?.freeShippingAbove || 999) ? 0 : (settings?.shippingCharge || 0);
      const baseTotal = subtotal + shipping;
      const codFee = settings?.enableCOD ? Number(settings?.codFeeAmount ?? 40) : 0;
      const totalAmount = baseTotal + codFee;

      const items = cart.map(item => ({
        product: item.productId,
        productName: item.name,
        productImage: item.image,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.price * item.quantity
      }));

      const order = new Order({
        customer: {
          name,
          phone,
          email,
          address,
          city,
          state,
          pincode
        },
        items,
        subtotal,
        shippingCharge: shipping,
        totalAmount,
        codFee,
        paymentMethod: 'Cash On Delivery',
        paymentStatus: 'Pending',
        payment: { screenshotPath: null },
        notes,
        statusHistory: [{ status: 'Pending' }]
      });

      await order.save();

      // Notify admin for COD order
      try {
        const { notifyAdmin } = require('../scripts/notifyAdmin');
        await notifyAdmin({
          type: 'ORDER_CREATED',
          order,
          products: items.map(i => ({ name: i.productName, sku: '', stock: null })),
          paymentScreenshot: null
        });
      } catch (e) {
        console.error('Admin notification (ORDER_CREATED) failed:', e);
      }

      // Clear cart
      cartDoc.items = [];
      cartDoc.recalculateTotals();
      await cartDoc.save();

      // Clear session keys
      req.session.checkoutDraft = null;
      req.session.checkoutIdempotency = null;

      return res.redirect(`/order-success/${order._id}`);
    }

    // ─── ONLINE PAYMENT FLOW (UNCHANGED) ───
    console.log('[checkoutInit] body', {
      paymentMethod: req.body?.paymentMethod,
      name: req.body?.name,
      phone: req.body?.phone,
      pincode: req.body?.pincode
    });
    console.log('[checkoutInit] session.checkoutDraft (before)', req.session?.checkoutDraft);

    const settings = await Settings.findOne();

    // ── COD loop prevention ───────────────────────────────────────────────
    // If user already started COD checkout, do not recreate checkoutDraft again
    // (prevents repeated redirect to /checkout when /checkout/init is resubmitted).
    const existingDraft = req.session?.checkoutDraft;
    const existingPaymentMethod = existingDraft?.paymentMethod;
    const incomingPaymentMethod = typeof req.body?.paymentMethod === 'string' ? req.body.paymentMethod.trim() : '';
    if (
      existingDraft &&
      existingPaymentMethod === 'Cash On Delivery' &&
      incomingPaymentMethod === 'Cash On Delivery'
    ) {
      // Keep the same draft; route user back to checkout page showing confirm UI.
      // checkout.ejs will hide delivery and show confirm when step === 'confirm'.
      existingDraft.step = existingDraft.step === 'delivery' ? 'confirm' : existingDraft.step;
      req.session.checkoutDraft = existingDraft;
      return res.redirect('/checkout');
    }

    // Idempotency key for DB-level duplicate-order protection.
    // Generates per checkout attempt.
    // Stored in session and reused for the /checkout/confirm call.
    req.session.checkoutIdempotency = req.session.checkoutIdempotency || {};
    req.session.checkoutIdempotency.key = req.session.checkoutIdempotency.key || require('crypto').randomBytes(32).toString('hex');


    const cartDoc = await getActiveCartDoc(req);
    const cart = cartToViewItems(cartDoc);

    if (!cartDoc || !cart || cart.length === 0) {
      // Never crash checkout for empty/invalid cart: create a new empty draft flow.
      req.flash('error_msg', 'Your cart is empty');
      return res.redirect('/cart');
    }


    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
    const city = typeof req.body.city === 'string' ? req.body.city.trim() : '';
    const state = typeof req.body.state === 'string' ? req.body.state.trim() : '';
    const pincode = typeof req.body.pincode === 'string' ? req.body.pincode.trim() : '';
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    const paymentMethodIn = typeof req.body.paymentMethod === 'string' ? req.body.paymentMethod.trim() : '';

    const errors = validateCheckoutFields({ name, phone, address, city, state, pincode });
    if (errors.length) {
      req.flash('error_msg', errors.join(', '));
      return res.redirect('/checkout');
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const shipping = subtotal >= (settings?.freeShippingAbove || 999) ? 0 : (settings?.shippingCharge || 0);
    const baseTotal = subtotal + shipping;

    const pm = paymentMethodIn === 'Cash On Delivery' ? 'Cash On Delivery' : 'Online Payment';
    const codFee = pm === 'Cash On Delivery' && settings?.enableCOD ? Number(settings?.codFeeAmount ?? 40) : 0;
    const totalAmount = pm === 'Cash On Delivery' ? baseTotal + codFee : baseTotal;

    console.log('[checkoutInit] creating checkoutDraft');
    req.session.checkoutDraft = {

      step: pm === 'Cash On Delivery' ? 'confirm' : 'upload',
      cartDocId: String(cartDoc._id),
      cartOwner: getCartOwner(req),
      delivery: {

        name: String(name).trim(),
        phone: String(phone).trim(),
        email: email?.trim() || '',
        address: String(address).trim(),
        city: String(city).trim(),
        state: String(state).trim(),
        pincode: String(pincode).trim(),
        notes: notes?.trim() || ''
      },
      paymentMethod: pm,
      codFee,
      totals: {
        subtotal,
        shippingCharge: shipping,
        baseTotal,
        totalAmount
      },
      payment: {
        screenshotPath: null
      }
    };

    return res.redirect('/checkout');

  } catch (err) {
    console.error('checkoutInit error:', err);
    req.flash('error_msg', 'Failed to start checkout. Please try again.');
    return res.redirect('/checkout');
  }
};



// ─── UPLOAD SCREENSHOT ────────────────────────────────────────────────────
exports.uploadPaymentScreenshot = async (req, res) => {
  try {
    console.log('[uploadPaymentScreenshot] request received', {
      ip: req.ip,
      hasDraft: !!req.session?.checkoutDraft,
      paymentMethod: req.session?.checkoutDraft?.paymentMethod,
      fileProvided: !!req.file,
      mime: req.file?.mimetype,
      filename: req.file?.filename,
      originalname: req.file?.originalname
    });

    const draft = req.session?.checkoutDraft;

    if (!draft) {
      req.flash('error_msg', 'Checkout session expired. Please start again.');
      return res.redirect('/checkout');
    }



    if (draft.paymentMethod !== 'Online Payment') {
      req.flash('error_msg', 'Screenshot upload is only for online payments.');
      return res.redirect('/checkout');
    }

    if (!req.file) {
      console.warn('[uploadPaymentScreenshot] missing file');
      req.flash('error_msg', 'Please upload a payment screenshot.');
      draft.step = 'upload';
      return res.redirect('/checkout');
    }

    if (!draft.payment) draft.payment = { screenshotPath: null };
    draft.payment.screenshotPath = req.file.path ? req.file.path : req.file.filename;
    draft.step = 'confirm';

    console.log('[uploadPaymentScreenshot] screenshot stored', {
      screenshotPath: draft.payment.screenshotPath
    });

    return res.redirect('/checkout');

  } catch (err) {
    console.error('uploadPaymentScreenshot error:', err);
    req.flash('error_msg', 'Upload failed.');
    return res.redirect('/checkout');
  }
};

    // ─── CONFIRM ──────────────────────────────────────────────────────────────
exports.confirmOrder = async (req, res) => {
  try {
    // COD must be isolated: do NOT depend on checkoutDraft/OTP/UPI logic.
    // However, our checkout page currently posts paymentMethod only on /checkout/confirm.
    // So we read address from checkoutDraft.delivery (created at /checkout/init).
    // Also, clear checkoutDraft+idempotency after a successful COD order to prevent repeat submits.
    const paymentMethodRaw = typeof req.body?.paymentMethod === 'string' ? req.body.paymentMethod.trim() : '';
    if (paymentMethodRaw === 'Cash On Delivery') {
      // COD submit is coming from the confirm form, which currently does NOT include name/phone/address.
      // For a minimal safe fix, use checkoutDraft delivery payload if available; do not run the rest of the draft/UPI confirm logic.
      const draft = req.session?.checkoutDraft;

      // Allow accepting entered details for COD from /checkout/init.
      // /checkout/confirm form does not submit delivery fields, so we must use draft.delivery.
      if (!draft?.delivery) {
        req.flash('error_msg', 'Please complete checkout details again.');
        return res.redirect('/checkout');
      }

      const settings = await Settings.findOne();
      const cartDoc = await getActiveCartDoc(req);
      const cart = cartToViewItems(cartDoc);

      if (!cartDoc || !cart || cart.length === 0) {
        req.flash('error_msg', 'Your cart is empty');
        return res.redirect('/cart');
      }

      const name = draft.delivery?.name || '';
      const phone = draft.delivery?.phone || '';
      const address = draft.delivery?.address || '';
      const city = draft.delivery?.city || '';
      const state = draft.delivery?.state || '';
      const pincode = draft.delivery?.pincode || '';
      const notes = draft.delivery?.notes || '';

      const errors = validateCheckoutFields({ name, phone, address, city, state, pincode });
      if (errors.length) {
        req.flash('error_msg', errors.join(', '));
        return res.redirect('/checkout');
      }

      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shipping = subtotal >= (settings?.freeShippingAbove || 999) ? 0 : (settings?.shippingCharge || 0);
      const baseTotal = subtotal + shipping;
      const codFee = settings?.enableCOD ? Number(settings?.codFeeAmount ?? 40) : 0;
      const totalAmount = baseTotal + codFee;

      const items = cart.map(item => ({
        product: item.productId,
        productName: item.name,
        productImage: item.image,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.price * item.quantity
      }));

      const order = new Order({
        customer: {
          name,
          phone,
          email: typeof req.body?.email === 'string' ? req.body.email.trim() : '',
          address,
          city,
          state,
          pincode
        },
        items,
        subtotal,
        shippingCharge: shipping,
        totalAmount,
        codFee,
        paymentMethod: 'Cash On Delivery',
        paymentStatus: 'Pending',
        payment: { screenshotPath: null },
        notes,
        statusHistory: [{ status: 'Pending' }]
      });

      await order.save();

      // Reduce stock using existing inventory logic.
      for (const item of cart) {
        const fresh = await Product.findById(item.productId);
        if (!fresh || !fresh.active) {
          req.flash('error_msg', `Product unavailable: "${item.name}"`);
          return res.redirect('/checkout');
        }
        if (fresh.stock < item.quantity) {
          req.flash('error_msg', `Not enough stock for "${item.name}". Available: ${fresh.stock}.`);
          return res.redirect('/checkout');
        }
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });

        // Low stock alert (non-blocking)
        try {
          const updated = await Product.findById(item.productId);
          const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 5);
          if (updated && typeof updated.stock === 'number' && updated.stock <= threshold) {
            const { notifyAdmin } = require('../scripts/notifyAdmin');
            await notifyAdmin({
              type: 'LOW_STOCK_ALERT',
              order,
              lowStockItems: [{ name: updated.name, sku: updated.sku, stock: updated.stock }]
            });
          }
        } catch (e) {
          console.error('LOW_STOCK_ALERT failed:', e);
        }
      }

      // Notify admin for COD order
      try {
        const { notifyAdmin } = require('../scripts/notifyAdmin');
        await notifyAdmin({
          type: 'ORDER_CREATED',
          order,
          products: items.map(i => ({ name: i.productName, sku: '', stock: null })),
          paymentScreenshot: null
        });
      } catch (e) {
        console.error('Admin notification (ORDER_CREATED) failed:', e);
      }

      // Clear cart.
      cartDoc.items = [];
      cartDoc.recalculateTotals();
      await cartDoc.save();

      // Prevent repeat COD redirects / re-submits.
      req.session.checkoutDraft = null;
      req.session.checkoutIdempotency = null;

      return res.redirect(`/order-success/${order._id}`);
    }

    console.log('[TRACE] START confirmOrder', {
      sid: req.sessionID,
      sessionCheckoutDraft: req.session?.checkoutDraft,
      ip: req.ip,
      hasDraft: !!req.session?.checkoutDraft,
      paymentMethod: req.session?.checkoutDraft?.paymentMethod
    });


    // ── DB-level duplicate-order protection (idempotency) ──
    // Prevents duplicate orders across refresh/double-click/network retry.
    // Uses a persisted idempotency key in MongoDB.
    const draft = req.session?.checkoutDraft;



    // If draft disappeared from session, do NOT proceed with new order creation.
    // Idempotency will handle duplicates; otherwise restart checkout.
    if (!draft) {
      console.warn('[confirmOrder][redirect /checkout] missing checkoutDraft', {
        paymentMethod: req.session?.checkoutDraft?.paymentMethod,
        hasIdempotencyKey: !!req.session?.checkoutIdempotency?.key,
        idempotencyKey: req.session?.checkoutIdempotency?.key,
      });

      // Avoid referencing `existing` here (it is declared later in the function).
      req.flash('error_msg', 'Checkout session expired. Please start again.');
      return res.redirect('/checkout');
    }


    console.log('[confirmOrder] sessionId', { sid: req.sessionID });
    console.log('[confirmOrder] checkoutDraft exists?', { exists: !!draft });
    if (draft) {
      console.log('[confirmOrder] checkoutDraft paymentMethod', { paymentMethod: draft.paymentMethod });
      console.log('[confirmOrder] checkoutDraft step', { step: draft.step });
    }

    // Create a signature for this draft (used for validation).
    const signatureParts = [
      String(draft.cartDocId || ''),
      String(draft.paymentMethod || ''),
      String(draft.delivery?.phone || ''),
      String(draft.delivery?.pincode || ''),
      String(draft.totals?.totalAmount ?? ''),
      String(draft.totals?.baseTotal ?? ''),
      String(draft.totals?.shippingCharge ?? '')
    ];

    // COD never has/needs a screenshot. Excluding it prevents signature mismatch
    // causing COD to bounce back to /checkout.
    if (draft.paymentMethod === 'Online Payment') {
      signatureParts.push(String(draft.payment?.screenshotPath || ''));
    }

    const signature = signatureParts.join('|');




    // Use/ensure an idempotency key persisted in session.
    // If the user retries the same flow, the same key will be reused.
    req.session.checkoutIdempotency = req.session.checkoutIdempotency || {};
    const idempotencyKey = req.session.checkoutIdempotency.key;

    if (!idempotencyKey) {
      req.flash('error_msg', 'Checkout session expired. Please start again.');
      return res.redirect('/checkout');
    }

    // Check DB: if key exists and completed, return existing order.
    const existing = await CheckoutIdempotency.findOne({ idempotencyKey }).populate('orderId');

    // If previously completed, just redirect to the existing order.
    if (existing?.orderId && existing.status === 'Completed') {
      return res.redirect(`/order-success/${existing.orderId._id}`);
    }

    // If we got a retry while the first request is still processing,
    // avoid bouncing user back to /checkout.
    if (existing?.status === 'Pending' && existing?.orderId) {
      return res.redirect(`/order-success/${existing.orderId._id}`);
    }

    // If session draft is missing on retry, but we already have a pending/completed record,
    // do not create a new order.
    if (!draft) {
      if (existing?.orderId) return res.redirect(`/order-success/${existing.orderId._id}`);
      req.flash('error_msg', 'Checkout session expired. Please start again.');
      return res.redirect('/checkout');
    }

    // For COD, draft.payment.screenshotPath is irrelevant. Ensure we have a delivery payload.
    if (draft.paymentMethod === 'Cash On Delivery' && (!draft.delivery || !draft.delivery.phone || !draft.delivery.pincode)) {
      req.flash('error_msg', 'COD checkout draft is invalid. Please restart checkout.');
      return res.redirect('/checkout');
    }

    // If key exists but signature differs, reject (prevents accidental reuse).

    if (existing && existing.signature && existing.signature !== signature) {
      req.flash('error_msg', 'This checkout attempt has already been processed differently. Please try again.');
      return res.redirect('/checkout');
    }

    // Create key doc if not present.
    let idemDoc = existing;
    if (!idemDoc) {
      try {
        idemDoc = await CheckoutIdempotency.create({
          idempotencyKey,
          signature,
          status: 'Pending'
        });
      } catch (e) {
        // Unique index race: fetch again.
        idemDoc = await CheckoutIdempotency.findOne({ idempotencyKey });
      }
    }

    // If already pending, return the same order if it is already linked.
    if (idemDoc?.orderId) {
      return res.redirect(`/order-success/${idemDoc.orderId}`);
    }

    if (!draft) {

      req.flash('error_msg', 'Checkout session expired. Please start again.');
      return res.redirect('/checkout');
    }

    const screenshotPath = draft?.payment?.screenshotPath;
    if (
      draft.paymentMethod === 'Online Payment' &&
      (!screenshotPath || String(screenshotPath).trim().length === 0)
    ) {
      console.warn('[confirmOrder] missing screenshot for Online Payment');
      req.flash('error_msg', 'Please upload your payment screenshot before confirming.');
      draft.step = 'upload';
      return res.redirect('/checkout');
    }



    const cartDoc = await getActiveCartDoc(req);
    const cart = cartToViewItems(cartDoc || null);
    if (!cartDoc || !cart || cart.length === 0) {
      console.warn('[confirmOrder] empty cart', { hasExisting: !!existing, existingStatus: existing?.status, hasOrderId: !!existing?.orderId });
      // If idempotency token existed but cart is empty, it means the order likely already got created.
      if (existing?.orderId) {
        return res.redirect(`/order-success/${existing.orderId._id}`);
      }
      req.flash('error_msg', 'Your cart is empty (or checkout session/cart expired).');
      return res.redirect('/cart');
    }




    const settings = await Settings.findOne();

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal >= (settings?.freeShippingAbove || 999) ? 0 : (settings?.shippingCharge || 0);
    const baseTotal = subtotal + shipping;
    const codFee = draft.paymentMethod === 'Cash On Delivery' ? Number(settings?.codFeeAmount ?? 40) : 0;
    const totalAmount = baseTotal + codFee;

    const items = cart.map(item => ({
      product: item.productId,
      productName: item.name,
      productImage: item.image,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.price * item.quantity
    }));

    const isOnline = draft.paymentMethod === 'Online Payment';

    const order = new Order({
      customer: {

        name: draft.delivery.name,
        phone: draft.delivery.phone,
        email: draft.delivery.email || '',
        address: draft.delivery.address,
        city: draft.delivery.city,
        state: draft.delivery.state,
        pincode: draft.delivery.pincode
      },
      items,
      subtotal,
      shippingCharge: shipping,
      totalAmount,
      codFee,
      paymentMethod: isOnline ? 'UPI' : 'Cash On Delivery',
      paymentStatus: isOnline ? 'Payment Verification Pending' : 'Pending',

      // Store UPI proof only for online payments
      // (COD: screenshotPath stays null)
      payment: {
        screenshotPath: isOnline ? (draft.payment?.screenshotPath || null) : null
      },


      notes: draft.delivery.notes || '',
      statusHistory: [{ status: isOnline ? 'Payment Verification Pending' : 'Pending' }]


    });

    console.log('[confirmOrder] saving order...');
    await order.save();
    console.log('[confirmOrder] order saved', { id: order._id, orderNumber: order.orderNumber });


    // Mark idempotency key as completed and link order immediately to prevent duplicates
    await CheckoutIdempotency.findOneAndUpdate(
      { idempotencyKey },
      { $set: { status: 'Completed', signature, orderId: order._id } }
    );

    // For COD: Fulfill order immediately by reducing stock
    if (!isOnline) {
      for (const item of cart) {
        const fresh = await Product.findById(item.productId);
        if (!fresh || !fresh.active) {
          req.flash('error_msg', `Product unavailable: "${item.name}"`);
          return res.redirect('/checkout');
        }
        if (fresh.stock < item.quantity) {
          req.flash('error_msg', `Not enough stock for "${item.name}". Available: ${fresh.stock}.`);
          return res.redirect('/checkout');
        }

        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });

        // Low stock alert (non-blocking)
        try {
          const updated = await Product.findById(item.productId);
          const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 5);
          if (updated && typeof updated.stock === 'number' && updated.stock <= threshold) {
            const { notifyAdmin } = require('../scripts/notifyAdmin');
            await notifyAdmin({
              type: 'LOW_STOCK_ALERT',
              order,
              lowStockItems: [{ name: updated.name, sku: updated.sku, stock: updated.stock }]
            });
          }
        } catch (e) {
          console.error('LOW_STOCK_ALERT failed:', e);
        }
      }
    }

    // Notify admin for both COD and UPI
    try {
      const { notifyAdmin } = require('../scripts/notifyAdmin');
      await notifyAdmin({
        type: 'ORDER_CREATED',
        order,
        products: items.map(i => ({ name: i.productName, sku: '', stock: null })),
        paymentScreenshot: isOnline ? (draft.payment?.screenshotPath || null) : null
      });
    } catch (e) {
      console.error('Admin notification (ORDER_CREATED) failed:', e);
    }

    // Clear cart + draft
    cartDoc.items = [];
    cartDoc.recalculateTotals();
    await cartDoc.save();

    req.session.checkoutDraft = null;

    console.log('[confirmOrder] final response redirect');
    return res.redirect(`/order-success/${order._id}`);

  } catch (err) {
    console.error('confirmOrder error:', err);
    req.flash('error_msg', `Failed to confirm order: ${err?.message || 'unknown error'}`);
    return res.redirect('/checkout');
  }
};



// Backward-compat: keep old placeOrder method name but disable it
exports.placeOrder = async (req, res) => {
  req.flash('error_msg', 'Checkout flow has changed. Please use Buy Now.');
  return res.redirect('/checkout');
};

