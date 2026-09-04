const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { user_id: '11111111-1111-1111-1111-111111111111', role: 'Fisherman', email: 'fisherman@terramarine.com' },
  process.env.JWT_SECRET || 'super_secret_terramarine_token_key_123!'
);

function testKeralaCall() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/fisherman/marine/status?layer=Kerala',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status code: ${res.statusCode}`);
        const parsed = JSON.parse(data);
        console.log('Overall Status:', parsed.status);
        console.log(`Sea Bulletins (${parsed.seaBulletins.length}):`, parsed.seaBulletins.map(b => `${b.layer} (${b.issuedBy})`));
        console.log(`Coastal Bulletins (${parsed.coastalBulletins.length}):`, parsed.coastalBulletins);
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error('Error:', err.message);
      resolve();
    });

    req.end();
  });
}

testKeralaCall();
