const http = require('http');
const https = require('https');

const httpGet = (urlStr) => {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const client = url.protocol === 'https:' ? https : http;
      client.get(urlStr, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        rejectUnauthorized: false
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          resolve({ status: res.statusCode, data });
        });
      }).on('error', e => resolve({ error: e.message }));
    } catch (err) {
      resolve({ error: err.message });
    }
  });
};

async function test() {
  console.log('Testing RSMC Port Warning: https://rsmcnewdelhi.imd.gov.in/port-warning.php');
  const res = await httpGet('https://rsmcnewdelhi.imd.gov.in/port-warning.php');
  console.log('Status:', res.status || res.error);
  if (res.data) {
    console.log('Length:', res.data.length);
    console.log('Data snippet:', res.data.slice(0, 400));
  }
  process.exit(0);
}

test();
