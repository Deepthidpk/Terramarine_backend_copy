const db = require('../src/config/db');
const http = require('http');
const jwt = require('jsonwebtoken');

async function test() {
  const users = await db.query("SELECT user_id, email, role, full_name FROM users WHERE full_name IN ('Aradhya', 'Dheerav')");
  
  for (const user of users.rows) {
    console.log(`\n================ Testing for User: ${user.full_name} (${user.email}) ================`);
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role, name: user.full_name },
      'super_secret_terramarine_token_key_123!',
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

    const res = await query('hi');
    console.log(`[Greeting output for ${user.full_name}]:`);
    console.log(res.data.reply.split('\n')[0]);
  }
  process.exit(0);
}

test().catch(console.error);
