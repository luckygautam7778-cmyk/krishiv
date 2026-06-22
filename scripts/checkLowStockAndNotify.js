require('dotenv').config();

const Product = require('../models/Product');
const Settings = require('../models/Settings');
const { notifyAdmin } = require('./notifyAdmin');

async function run() {
  const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 5);

  // Only notify for products that are actually low and still Active
  const products = await Product.find({
    stock: { $lte: threshold, $gt: 0 },
    active: true
  });

  if (!products || products.length === 0) {
    console.log('[LowStock] No products below threshold.');
    return;
  }

  // Ensure we have latest settings (notifyAdmin reads settings internally)
  await Settings.findOne();

  await notifyAdmin({
    type: 'LOW_STOCK_ALERT',
    order: null,
    lowStockItems: products.map(p => ({
      name: p.name,
      sku: p.sku,
      stock: p.stock
    }))
  });
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[LowStock] Error:', err);
    process.exit(1);
  });

