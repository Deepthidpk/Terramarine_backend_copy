const http = require('http');
const jwt = require('jsonwebtoken');

// Generate a test token matching backend secret
const token = jwt.sign(
  { user_id: 1, email: 'dheerav@gmail.com', role: 'researcher', name: 'Dheerav' },
  process.env.JWT_SECRET || 'terramarine_jwt_secret_key_2025_secure',
  { expiresIn: '1d' }
);

function testQuery(message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ message });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/researcher/chat-assistant',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Testing live API /api/researcher/chat-assistant:');
  const res1 = await testQuery('hi');
  console.log('Response for "hi":', res1.reply?.slice(0, 150));
  const res2 = await testQuery('explain ocean acidification');
  console.log('Response for "explain ocean acidification":', res2.reply?.slice(0, 150));
}

main().catch(console.error);
