/**
 * POSHAAK - Database Seed Script
 * Seeds admin user, categories, and sample products (Deity Poshak)
 * Run: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin    = require('./models/Admin');
const Category = require('./models/Category');
const Product  = require('./models/Product');
const Settings = require('./models/Settings');
const Banner   = require('./models/Banner');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/poshaak';

async function seed() {
  try {
    console.log('\n🌱 Poshaak Seeder Starting...\n');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB Connected');

    // ── CLEAR EXISTING DATA ──────────────────────────────────
    await Promise.all([
      Admin.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Settings.deleteMany({}),
      Banner.deleteMany({})
    ]);
    console.log('🗑️  Cleared existing data');

    // ── CREATE DEFAULT ADMIN (if not exists) ──────────────────────────────────────────
    const DEFAULT_ADMIN_USERNAME = 'admin_poshak';
    const DEFAULT_ADMIN_EMAIL = 'admin@poshakstore.com';
    const DEFAULT_ADMIN_PASSWORD = 'Poshak@2026Admin';

    // Ensure uniqueness by username/email
    const existingAdmin = await Admin.findOne({
      $or: [
        { username: DEFAULT_ADMIN_USERNAME },
        { email: DEFAULT_ADMIN_EMAIL.toLowerCase() }
      ]
    });

    let admin;
    if (existingAdmin) {
      admin = existingAdmin;
      console.log(`👤 Admin already exists: ${admin.username}`);

      // Safe migration: set phone if missing
      const seedAdminPhone = process.env.ADMIN_PHONE || '9999999999';
      const phoneOk = /^[6-9]\d{9}$/.test(seedAdminPhone);
      if (!admin.phone && phoneOk) {
        admin.phone = seedAdminPhone;
        await admin.save();
        console.log(`📞 Migrated admin phone: ${seedAdminPhone}`);
      }

    } else {
      const seedAdminPhone = process.env.ADMIN_PHONE || '9999999999';
      admin = await Admin.create({
        username: process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME,
        email: process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase() : DEFAULT_ADMIN_EMAIL.toLowerCase(),
        phone: /^[6-9]\d{9}$/.test(seedAdminPhone) ? seedAdminPhone : undefined,
        password: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
        role: 'admin'
      });
      console.log(`👤 Admin created: ${admin.username} / ${process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD}`);
    }


    // ── CREATE SETTINGS ───────────────────────────────────────
    await Settings.create({
      businessName:    'Krishiv',
      tagline:         'Divine Poshak for Ladoo Gopal & Deity Idols',
      phone:           '+91 92597 57262',
      whatsapp:        '919259757262',
      email:           'ankits2252@gmail.com',
      address:         'Shop No. 5, Poshak Bazaar',
      city:            'Vrindavan',
      state:           'Uttar Pradesh',
      aboutUs:         'Krishiv is your trusted destination for premium handcrafted poshak (divine clothing) for Ladoo Gopal and deity idols. Each poshak is lovingly crafted with the finest fabrics, crystals, pearls, and embellishments by our skilled artisans. We serve devotees across India with authentic, beautiful, and affordable deity clothing for all occasions — from daily worship to Janmashtami, Annakut, and Holi.',
      facebook:        '',
      instagram:       '',
      shippingCharge:  50,
      freeShippingAbove: 999,
      metaDescription: 'Krishiv - Premium handcrafted Poshak for Ladoo Gopal & deity idols. Shop traditional poshak sets, mukut, and accessories. Cash on Delivery. Pan India Delivery.'
    });
    console.log('⚙️  Settings created');

    // ── CREATE CATEGORIES ─────────────────────────────────────
    const catData = [
      { name: 'Poshak Sets',     slug: 'poshak-sets',     description: 'Complete poshak sets for Ladoo Gopal and deity idols', sortOrder: 1 },
      { name: 'Mukut',           slug: 'mukut',           description: 'Handcrafted deity crowns and headwear',                sortOrder: 2 },
      { name: 'Ladoo Gopal',     slug: 'ladoo-gopal',     description: 'Special poshak for Ladoo Gopal idols',                sortOrder: 3 },
      { name: 'Festival Special',slug: 'festival-special',description: 'Poshak for Janmashtami, Annakut, Holi, and festivals', sortOrder: 4 },
      { name: 'Accessories',     slug: 'accessories',     description: 'Deity accessories, jewellery, and decorations',        sortOrder: 5 },
      { name: 'Bulk / Wholesale',slug: 'wholesale',       description: 'Bulk orders at wholesale prices',                     sortOrder: 6 },
    ];

    const categories = await Category.insertMany(catData);
    console.log(`🏷️  ${categories.length} categories created`);

    const catMap = {};
    categories.forEach(c => { catMap[c.slug] = c._id; });

    // ── CREATE PRODUCTS ───────────────────────────────────────
    // Based on the actual product photos shared by the business owner
// ── CREATE PRODUCTS ───────────────────────────────────────
// Intentionally left empty.
// Products must be created and uploaded only through the Admin Panel.
const products = [];

// Seed should not insert any demo/sample product images or products.
console.log('📦 No demo products seeded (admin-managed only).');


    // ── SEED COMPLETE ─────────────────────────────────────────
    console.log('\n✅ ════════════════════════════════════════');
    console.log('   SEEDING COMPLETE!');
    console.log('════════════════════════════════════════');
    console.log(`\n🌐 Store URL:  http://localhost:3000`);
    console.log(`🔐 Admin URL:  http://localhost:3000/admin/login`);
    console.log(`👤 Username:   ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`🔑 Password:   ${process.env.ADMIN_PASSWORD || 'Admin@12345'}`);
    console.log('\n📸 IMPORTANT: Upload product images through Admin Panel!');
    console.log('   Go to: Admin > Products > Edit each product > Upload Images\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seeding failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
