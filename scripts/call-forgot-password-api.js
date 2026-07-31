const http = require('http');

const postData = JSON.stringify({ email: 'volunteer@terramarine.com' });


const req = http.request('http://localhost:5000/api/auth/forgot-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Forgot Password HTTP Status:', res.statusCode);
    console.log('Response Body:', data);
  });
});

req.on('error', (err) => {
  console.error('Request Error:', err.message);
});

req.write(postData);
req.end();
