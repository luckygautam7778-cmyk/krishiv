/**
 * Backfill SKU for existing products.
 * Run once after deploying SKU-required schema changes.
 *
 * Usage:
 *   node scripts/backfill-sku.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');
const Product = require('../models/Product');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/poshaak';

function normalize(s) {
  return (s || '').toString().trim();
}

async function main() {
  await mongoose.connect(MONGODB_URI);

  // Find docs where sku is missing/blank
  const cursor = Product.find({ $or: [{ sku: { $exists: false } }, { sku: '' }, { sku: null }] });

  let updated = 0;
  let scanned = 0;

  // Use cursor for memory safety
  const docs = await cursor.select('_id name slug sku').lean();

  for (const doc of docs) {
    scanned++;

    const base = normalize(doc.slug) || slugify(normalize(doc.name) || 'product', { lower: true, strict: true }) || 'product';

    // Keep trying until unique
    // (In practice this will succeed in 1-2 tries)
    let candidate;
    let tries = 0;
    while (true) {
      tries++;
      candidate = `${base}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
      const exists = await Product.exists({ sku: candidate });
      if (!exists) break;
      if (tries > 10) throw new Error(`Failed to generate unique sku for product ${doc._id}`);
    }

    await Product.updateOne({ _id: doc._id }, { $set: { sku: candidate } });
    updated++;
    console.log(`✅ Backfilled SKU for ${doc._id}: ${candidate}`);
  }

  console.log(`\nDone. Scanned: ${scanned}, Updated: ${updated}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Backfill failed:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

