require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');

async function check() {
  try {
    const res = await db.query('SELECT user_id, full_name, email, role, status FROM users LIMIT 10');
    console.log('Users in Database:');
    console.table(res.rows);
  } catch (err) {
    console.error('DB Query Error:', err.message);
  } finally {
    process.exit();
  }
}

check();
