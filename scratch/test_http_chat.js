const db = require('../src/config/db');
const http = require('http');
const jwt = require('jsonwebtoken');

async function test() {
  const users = await db.query("SELECT user_id, email, role, full_name FROM users WHERE role = 'Researcher' LIMIT 5");
  console.log('Found Researchers in DB:', users.rows);

  if (users.rows.length === 0) return;
  const testUser = users.rows[0];

  const token = jwt.sign(
    { user_id: testUser.user_id, email: testUser.email, role: testUser.role, name: testUser.full_name },
    process.env.JWT_SECRET || 'super_secret_terramarine_token_key_123!',
    { expiresIn: '1d' }
  );

  const query = async (msg) => {
    return new Promise((resolve) => {
      const data = JSON.stringify({ message: msg });
      const req = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/researcher/assistant/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
      });
      req.write(data);
      req.end();
    });
  };

  console.log('\n--- Testing "hi" query ---');
  const res1 = await query('hi');
  console.log('Status:', res1.status);
  console.log('Reply:\n', res1.data.reply);

  console.log('\n--- Testing "explain ocean acidification" query ---');
  const res2 = await query('explain ocean acidification');
  console.log('Status:', res2.status);
  console.log('Reply:\n', res2.data.reply);

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
