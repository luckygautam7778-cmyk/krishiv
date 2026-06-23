const Admin = require('../models/Admin');

/**
 * Bootstraps and verifies the Admin account in the database.
 * Runs on application startup to ensure production matches expectations.
 *
 * IMPORTANT: Uses ONLY environment variables (single source of truth).
 */
let didRun = false;

async function bootstrapAdmin() {
  if (didRun) return;
  didRun = true;

  try {
    console.log('\n🔍 [BOOTSTRAP-ADMIN] Starting verification check...');

    const targetUsername = process.env.ADMIN_USERNAME;
    const targetEmail = process.env.ADMIN_EMAIL;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!targetUsername || !targetEmail || !expectedPassword) {
      console.error(
        '❌ [BOOTSTRAP-ADMIN] Missing env vars. Require ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD.'
      );
      return;
    }

    const normalizedEmail = String(targetEmail).trim().toLowerCase();
    const normalizedUsername = String(targetUsername).trim();

    // Find admin by username OR email
    const admin = await Admin.findOne({
      $or: [
        { username: normalizedUsername },
        { email: normalizedEmail }
      ]
    });

    // Create if missing
    if (!admin) {
      console.log(`👤 [BOOTSTRAP-ADMIN] Admin "${normalizedUsername}" not found. Creating...`);
      const created = new Admin({
        username: normalizedUsername,
        email: normalizedEmail,
        password: expectedPassword,
        role: 'admin'
      });
      await created.save();
      console.log(`✅ [BOOTSTRAP-ADMIN] Admin "${normalizedUsername}" created.`);
      console.log('🔍 [BOOTSTRAP-ADMIN] Verification check complete.\n');
      return;
    }

    // Repair/align username/email if needed
    let needsSave = false;

    if (admin.username !== normalizedUsername) {
      admin.username = normalizedUsername;
      needsSave = true;
    }

    if (String(admin.email).toLowerCase() !== normalizedEmail) {
      admin.email = normalizedEmail;
      needsSave = true;
    }

    // Ensure password matches env password
    const isMatch = await admin.comparePassword(expectedPassword);
    if (!isMatch) {
      admin.password = expectedPassword; // triggers pre-save hash
      needsSave = true;
    }

    if (needsSave) {
      await admin.save();
      console.log(`✅ [BOOTSTRAP-ADMIN] Admin credentials repaired/updated for "${admin.username}".`);
    } else {
      console.log(`✅ [BOOTSTRAP-ADMIN] Admin "${admin.username}" is already up-to-date.`);
    }

    console.log('🔍 [BOOTSTRAP-ADMIN] Verification check complete.\n');
  } catch (error) {
    console.error('❌ [BOOTSTRAP-ADMIN] Error during admin bootstrap:', error);
  }
}

module.exports = bootstrapAdmin;

