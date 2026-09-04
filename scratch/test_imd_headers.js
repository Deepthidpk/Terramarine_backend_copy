const https = require('https');

function testUrl(urlStr, headers = {}) {
  return new Promise((resolve) => {
    console.log(`Testing ${urlStr} with headers:`, headers);
    const req = https.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://mausam.imd.gov.in/',
        'Origin': 'https://mausam.imd.gov.in',
        ...headers
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response length: ${data.length}`);
        console.log(`Response sample: ${data.slice(0, 300)}`);
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', (err) => {
      console.log('Error:', err.message);
      resolve({ error: err.message });
    });
  });
}

async function run() {
  await testUrl('https://api.imd.gov.in/api/v1/seabulletin');
  await testUrl('https://api.imd.gov.in/api/v1/seabulletin?id=108');
  await testUrl('https://api.imd.gov.in/api/v1/coastalbulletin');
  await testUrl('https://mausam.imd.gov.in/responsive/marine_forecast.php');
}

run();
