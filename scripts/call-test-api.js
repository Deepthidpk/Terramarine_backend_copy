const http = require('http');

http.get('http://localhost:5000/api/auth/test-email?email=terramarine33@gmail.com', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status Code:', res.statusCode);
    console.log('Response Body:', data);
  });
}).on('error', (err) => {
  console.error('HTTP Request Error:', err.message);
});
