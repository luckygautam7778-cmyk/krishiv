const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');

/**
 * Bootstraps and verifies the Admin account in the database.
 * Runs on application startup to ensure production matches expectations.
 */
async function bootstrapAdmin() {
  try {
    console.log('\n🔍 [BOOTSTRAP-ADMIN] Starting verification check...');

    // 1. Inspect all admins
    const admins = await Admin.find({});
    console.log(`📊 [BOOTSTRAP-ADMIN] Total admin count in DB: ${admins.length}`);

    const listDetails = admins.map(a => ({
      id: a._id,
      username: a.username,
      email: a.email,
      role: a.role,
      hasPhone: Boolean(a.phone),
      phone: a.phone,
      hasPassword: Boolean(a.password),
      isPasswordHashed: typeof a.password === 'string' && a.password.length === 60 && a.password.startsWith('$2')
    }));
    console.log('📋 [BOOTSTRAP-ADMIN] Existing admins details:', JSON.stringify(listDetails, null, 2));

    // Check for duplicates
    const usernames = listDetails.map(a => a.username);
    const emails = listDetails.map(a => a.email?.toLowerCase());
    const uniqueUsernames = new Set(usernames);
    const uniqueEmails = new Set(emails);

    if (uniqueUsernames.size !== usernames.length) {
      console.warn('⚠️ [BOOTSTRAP-ADMIN] Warning: Duplicate admin usernames detected!');
    }
    if (uniqueEmails.size !== emails.length) {
      console.warn('⚠️ [BOOTSTRAP-ADMIN] Warning: Duplicate admin emails detected!');
    }

    // 2. Look for the expected admin 'admin_poshak'
    const targetUsername = 'admin_poshak';
    const targetEmail = 'admin@poshakstore.com';
    const expectedPassword = 'Poshaak@2026Admin';

    let admin = await Admin.findOne({
      $or: [
        { username: targetUsername },
        { email: targetEmail }
      ]
    });

    if (!admin) {
      console.log(`👤 [BOOTSTRAP-ADMIN] Admin "${targetUsername}" not found. Creating it...`);
      admin = new Admin({
        username: targetUsername,
        email: targetEmail,
        password: expectedPassword,
        role: 'admin'
      });
      await admin.save();
      console.log(`✅ [BOOTSTRAP-ADMIN] Admin "${targetUsername}" successfully created!`);
    } else {
      console.log(`👤 [BOOTSTRAP-ADMIN] Admin "${admin.username}" found (email: "${admin.email}"). Checking password validity...`);

      // Verify the password
      let isMatch = false;
      try {
        isMatch = await admin.comparePassword(expectedPassword);
      } catch (err) {
        console.error('❌ [BOOTSTRAP-ADMIN] Error comparing password:', err.message);
      }

      if (!isMatch) {
        console.log(`⚠️ [BOOTSTRAP-ADMIN] Password mismatch for "${admin.username}". Repairing and updating password to the default...`);
        admin.password = expectedPassword;
        await admin.save();
        console.log(`✅ [BOOTSTRAP-ADMIN] Password for "${admin.username}" successfully repaired/updated!`);
      } else {
        console.log(`✅ [BOOTSTRAP-ADMIN] Password for "${admin.username}" is correct and valid.`);
      }

      // Safe migration: ensure correct username/email if slightly mismatched
      let needsSave = false;
      if (admin.username !== targetUsername) {
        console.log(`🔄 [BOOTSTRAP-ADMIN] Updating username from "${admin.username}" to "${targetUsername}"`);
        admin.username = targetUsername;
        needsSave = true;
      }
      if (admin.email !== targetEmail) {
        console.log(`🔄 [BOOTSTRAP-ADMIN] Updating email from "${admin.email}" to "${targetEmail}"`);
        admin.email = targetEmail;
        needsSave = true;
      }

      if (needsSave) {
        await admin.save();
        console.log(`✅ [BOOTSTRAP-ADMIN] Admin credentials updated successfully.`);
      }
    }

    console.log('🔍 [BOOTSTRAP-ADMIN] Verification check complete.\n');
  } catch (error) {
    console.error('❌ [BOOTSTRAP-ADMIN] Error during admin bootstrap:', error);
  }
}

module.exports = bootstrapAdmin;
