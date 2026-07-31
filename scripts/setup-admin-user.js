const db = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function setupAdmin() {
  try {
    const email = 'terramarine33@gmail.com';
    const plainPassword = 'Terramarine@123';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    console.log(`Setting up Admin user for ${email}...`);

    // Check if user already exists
    const checkRes = await db.query('SELECT * FROM users WHERE email = $1 OR email = $2', [email, 'admin@terramarine.com']);
    
    if (checkRes.rows.length > 0) {
      const existingUser = checkRes.rows[0];
      await db.query(
        `UPDATE users 
         SET email = $1, password_hash = $2, role = 'Admin', status = 'Active', full_name = 'System Admin' 
         WHERE user_id = $3`,
        [email, passwordHash, existingUser.user_id]
      );
      console.log(`Successfully updated admin user (${existingUser.user_id}) with email ${email} and new password.`);
    } else {
      const insertRes = await db.query(
        `INSERT INTO users (user_id, full_name, email, phone, password_hash, role, status, address, district, state)
         VALUES (gen_random_uuid(), 'System Admin', $1, '+919876543216', $2, 'Admin', 'Active', 'Main Server Control Room', 'Ernakulam', 'Kerala')
         RETURNING user_id`,
        [email, passwordHash]
      );
      console.log(`Successfully created new Admin user (${insertRes.rows[0].user_id}) with email ${email}.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error setting up admin user:', err);
    process.exit(1);
  }
}

setupAdmin();
