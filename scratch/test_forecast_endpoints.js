const https = require('https');

function testEndpoint(urlStr, headers = {}) {
  return new Promise((resolve) => {
    https.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`=== ${urlStr} ===`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Length: ${data.length}`);
        console.log(`Snippet: ${data.slice(0, 400)}\n`);
        resolve(data);
      });
    }).on('error', (err) => resolve(err.message));
  });
}

async function run() {
  await testEndpoint('https://mausam.imd.gov.in/Forecast/coastal_bulletin_new.php');
  await testEndpoint('https://mausam.imd.gov.in/Forecast/seabulletin_new.php');
  
  // Test if IMD API accepts key parameter or headers like X-Api-Key
  await testEndpoint('https://api.imd.gov.in/api/v1/seabulletin?api_key=test');
  await testEndpoint('https://api.imd.gov.in/api/v1/seabulletin', { 'x-api-key': 'imd' });
}

run();
