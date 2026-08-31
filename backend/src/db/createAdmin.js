const { query, closePool, testConnection } = require('../config/db');
const { hashPassword } = require('../utils/crypto');

async function createAdmin() {
  const args = process.argv.slice(2);
  const getArg = (name, defaultValue) => {
    const found = args.find(a => a.startsWith(`--${name}=`));
    return found ? found.split('=')[1] : defaultValue;
  };

  const email = (getArg('email', process.env.ADMIN_EMAIL || 'admin@gmail.com')).trim().toLowerCase();
  const password = getArg('password', process.env.ADMIN_PASSWORD || 'Admin@123456');
  const fullName = getArg('name', 'System Administrator');
  const admissionNumber = getArg('admission', 'ADMIN-001').trim().toUpperCase();

  console.log('--- Admin Account Setup ---');

  const conn = await testConnection();
  if (!conn.connected) {
    console.error(`[Error]: Cannot connect to database: ${conn.message}`);
    process.exit(1);
  }

  try {
    const existing = await query('SELECT id, email, role FROM users WHERE email = $1', [email]);
    const passwordHash = await hashPassword(password);

    if (existing.rows.length > 0) {
      // Update existing account to ADMINISTRATOR with new password
      await query(`
        UPDATE users
        SET full_name = $1,
            admission_number = $2,
            password_hash = $3,
            role = 'ADMINISTRATOR',
            is_verified = TRUE,
            verification_status = 'APPROVED',
            status = 'ACTIVE',
            updated_at = NOW()
        WHERE email = $4;
      `, [fullName, admissionNumber, passwordHash, email]);

      console.log(`✔ Admin account updated successfully: ${email}`);
    } else {
      // Insert new administrator
      await query(`
        INSERT INTO users (
          full_name, admission_number, email, password_hash, role, is_verified, verification_status, status
        ) VALUES ($1, $2, $3, $4, 'ADMINISTRATOR', TRUE, 'APPROVED', 'ACTIVE');
      `, [fullName, admissionNumber, email, passwordHash]);

      console.log(`✔ Admin account created successfully: ${email}`);
    }

    console.log(`   Email: ${email}`);
    console.log(`   Role: ADMINISTRATOR (Verified & Approved)`);
    console.log('--- Setup Complete ---');
  } catch (err) {
    console.error('[Admin Setup Error]:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  createAdmin();
}

module.exports = { createAdmin };
