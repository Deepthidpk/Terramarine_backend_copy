const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const http = require('http');

async function test() {
  try {
    const userRes = await db.query("SELECT * FROM users WHERE email = 'deepak@gmail.com' LIMIT 1");
    if (userRes.rows.length === 0) {
      console.log('No Deepak user found');
      process.exit(0);
    }
    const u = userRes.rows[0];
    console.log('Found fisherman:', u.full_name, `(${u.email})`);
    console.log('Location:', u.location_coastal_area, '|', u.location_municipality, '|', u.location_district, '|', u.location_state);
    
    const token = jwt.sign(
      { user_id: u.user_id, role: u.role, email: u.email },
      process.env.JWT_SECRET || 'super_secret_terramarine_token_key_123!'
    );
    
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/fisherman/marine/relevant-alerts',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('\n--- LIVE API RESPONSE ---');
        console.log('HTTP Status:', res.statusCode);
        const parsed = JSON.parse(data);
        console.log('IMD Coverage:', parsed.imdCoverage);
        console.log('\n🌊 Marine Alert:', parsed.marineAlert);
        console.log('\n☁️ Weather Alert:', parsed.weatherAlert);
        console.log('\n🚦 Overall Status:', parsed.overallStatus);
        console.log('\nValidity:', parsed.validity);
        process.exit(0);
      });
    });
    req.on('error', e => {
      console.error('Req error:', e.message);
      process.exit(1);
    });
    req.end();
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

test();
