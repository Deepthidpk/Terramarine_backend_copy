const jwt = require('jsonwebtoken');

async function testHttpStatus() {
  const token = jwt.sign(
    { user_id: 'afeeb454-eb36-4f5f-89a8-4e40ec066952', email: 'authority@terramarine.org', role: 'Authority' },
    'super_secret_terramarine_token_key_123!',
    { expiresIn: '1h' }
  );

  const res = await fetch('http://localhost:5000/api/campaigns/62971279-7ee5-4227-aea3-66e3d7d98761/status', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'Cancelled', reason: 'another program on that place' })
  });

  console.log('HTTP Status:', res.status);
  const text = await res.text();
  console.log('Response Body:', text);
}

testHttpStatus().then(() => process.exit(0)).catch(e => { console.error('Fetch error:', e); process.exit(1); });
