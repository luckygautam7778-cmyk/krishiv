const Product = require('../models/Product');
const Settings = require('../models/Settings');
const Cart = require('../models/Cart');

function getCartOwner(req) {
  if (req.session?.userId) {
    return { ownerType: 'user', user: req.session.userId, guestId: null };
  }
  if (!req.session) {
    return { ownerType: 'guest', user: null, guestId: 'temp-guest-id' };
  }
  if (!req.session.guestId) {
    const crypto = require('crypto');
    req.session.guestId = crypto.randomUUID();
  }
  return { ownerType: 'guest', user: null, guestId: req.session.guestId };
}

async function getActiveCart(req) {
  const { ownerType, user, guestId } = getCartOwner(req);
  if (!ownerType) {
    // Graceful fallback: create a guest cart id for the current session.
    const crypto = require('crypto');
    req.session = req.session || {};
    req.session.guestId = req.session.guestId || crypto.randomUUID();
    return await Cart.create({
      ownerType: 'guest',
      user: null,
      guestId: req.session.guestId,
      items: [],
      status: 'active'
    });
  }

  const filter = ownerType === 'user'
    ? { ownerType, user, status: 'active' }
    : { ownerType, guestId, status: 'active' };

  // If guestId is missing/invalid, avoid crashing and recreate a guest cart.
  if (ownerType === 'guest' && !guestId) {
    const crypto = require('crypto');
    req.session = req.session || {};
    req.session.guestId = crypto.randomUUID();
    return await Cart.create({
      ownerType: 'guest',
      user: null,
      guestId: req.session.guestId,
      items: [],
      status: 'active'
    });
  }


  let cart = await Cart.findOne(filter);
  if (!cart) {
    cart = await Cart.create({
      ownerType,
      user: ownerType === 'user' ? user : null,
      guestId: ownerType === 'guest' ? guestId : null,
      items: [],
      status: 'active'
    });
  }
  return cart;
}

function toCartView(cartDoc) {
  return (cartDoc?.items || []).map(it => ({
    productId: it.product,
    name: it.productName,
    price: it.price,
    image: it.productImage,
    quantity: it.quantity
  }));
}

function computeTotals(cartItems) {
  const total = (cartItems || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = (cartItems || []).reduce((sum, item) => sum + item.quantity, 0);
  return { total, cartCount };
}

// ─── VIEW CART ────────────────────────────────────────────────────────────────
exports.getCart = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    const cartDoc = await getActiveCart(req);
    const cart = toCartView(cartDoc);

    const { total, cartCount } = computeTotals(cart);
    const shipping = (settings && total > 0)
      ? (total >= (settings.freeShippingAbove || 999) ? 0 : (settings.shippingCharge || 0))
      : 0;

    res.render('cart', {
      title: 'Shopping Cart | Poshaak',
      pageTitle: 'Your Cart',
      cart,
      cartCount,
      settings,
      total,
      shipping,
      grandTotal: total + shipping
    });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).render('500', { title: 'Error', pageTitle: 'Error', error: err.message });
  }
};

// ─── ADD TO CART ──────────────────────────────────────────────────────────────
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const qtyToAdd = parseInt(quantity);

    if (!productId || !Number.isFinite(qtyToAdd) || qtyToAdd <= 0) {
      return res.json({ success: false, message: 'Invalid quantity' });
    }

    const product = await Product.findById(productId);
    if (!product || !product.active) {
      return res.json({ success: false, message: 'Product not found' });
    }
    if (product.stock < 1) {
      return res.json({ success: false, message: 'Product is out of stock' });
    }

    const cartDoc = await getActiveCart(req);

    const price = product.discountPrice && product.discountPrice < product.price
      ? product.discountPrice
      : product.price;

    const idx = (cartDoc.items || []).findIndex(it => String(it.product) === String(productId));

    if (idx > -1) {
      const newQty = (cartDoc.items[idx].quantity || 0) + qtyToAdd;
      const finalQty = Math.min(newQty, product.stock);
      cartDoc.items[idx].quantity = finalQty;
      cartDoc.items[idx].price = price;
      cartDoc.items[idx].lineTotal = price * finalQty;
    } else {
      const finalQty = Math.min(qtyToAdd, product.stock);
      cartDoc.items.push({
        product: product._id,
        productName: product.name,
        productImage: product.images?.[0] || '',
        quantity: finalQty,
        price,
        lineTotal: price * finalQty
      });
    }

    cartDoc.recalculateTotals();
    await cartDoc.save();

    const cart = toCartView(cartDoc);
    const { cartCount, total } = computeTotals(cart);

    return res.json({
      success: true,
      message: 'Added to cart!',
      cartCount,
      cartTotal: total
    });
  } catch (err) {
    console.error('Add to cart error:', err);
    return res.json({ success: false, message: 'Something went wrong' });
  }
};

// ─── UPDATE CART ──────────────────────────────────────────────────────────────
exports.updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = parseInt(quantity);

    if (!productId || !Number.isFinite(qty)) {
      return res.json({ success: false, message: 'Invalid payload' });
    }

    const cartDoc = await getActiveCart(req);

    const idx = (cartDoc.items || []).findIndex(it => String(it.product) === String(productId));
    if (idx > -1) {
      if (qty <= 0) {
        cartDoc.items.splice(idx, 1);
      } else {
        const product = await Product.findById(productId);
        const maxStock = product?.stock ?? cartDoc.items[idx].quantity;
        const finalQty = Math.min(qty, maxStock);
        cartDoc.items[idx].quantity = finalQty;
        cartDoc.items[idx].lineTotal = cartDoc.items[idx].price * finalQty;
      }
    }

    cartDoc.recalculateTotals();
    await cartDoc.save();

    const cart = toCartView(cartDoc);
    const { cartCount, total } = computeTotals(cart);

    return res.json({ success: true, cartCount, cartTotal: total });
  } catch (err) {
    console.error('Update cart error:', err);
    return res.json({ success: false, message: 'Update failed' });
  }
};

// ─── REMOVE FROM CART ─────────────────────────────────────────────────────────
exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.json({ success: false, message: 'Invalid payload' });

    const cartDoc = await getActiveCart(req);
    cartDoc.items = (cartDoc.items || []).filter(it => String(it.product) !== String(productId));

    cartDoc.recalculateTotals();
    await cartDoc.save();

    const cart = toCartView(cartDoc);
    const { cartCount, total } = computeTotals(cart);

    return res.json({ success: true, cartCount, cartTotal: total });
  } catch (err) {
    console.error('Remove cart error:', err);
    return res.json({ success: false, message: 'Remove failed' });
  }
};

// ─── CLEAR CART ───────────────────────────────────────────────────────────────
exports.clearCart = async (req, res) => {
  try {
    const cartDoc = await getActiveCart(req);
    cartDoc.items = [];
    cartDoc.recalculateTotals();
    await cartDoc.save();
    return res.json({ success: true });
  } catch (err) {
    console.error('Clear cart error:', err);
    return res.json({ success: false, message: 'Clear failed' });
  }
};

