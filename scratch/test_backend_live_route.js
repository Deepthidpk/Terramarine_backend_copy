const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Path: ${path} | Status: ${res.statusCode}`);
        console.log(`Response: ${data.slice(0, 300)}`);
        resolve(res.statusCode);
      });
    }).on('error', (err) => {
      console.log(`Path: ${path} | Error: ${err.message}`);
      resolve(null);
    });
  });
}

async function run() {
  await testEndpoint('/api/fisherman/marine/status');
  await testEndpoint('/api/fisherman/marine/sea-bulletin');
  await testEndpoint('/api/fisherman/marine/coastal-bulletin');
}

run();
