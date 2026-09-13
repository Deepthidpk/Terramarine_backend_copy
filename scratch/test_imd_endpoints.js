const http = require('http');
const https = require('https');

const httpGet = (urlStr) => {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const client = url.protocol === 'https:' ? https : http;
      client.get(urlStr, { timeout: 8000, rejectUnauthorized: false }, (res) => {
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
  console.log('Testing Port Warning URL: https://api.imd.gov.in/api/v1/portwarning');
  const pw = await httpGet('https://api.imd.gov.in/api/v1/portwarning');
  console.log('Port Warning Status:', pw.status || pw.error);
  if (pw.data) console.log('Port Warning Data Preview:', pw.data.slice(0, 300));

  console.log('\nTesting Cyclone Wind URL: https://api.imd.gov.in/api/v1/cyclone_wind');
  const cw = await httpGet('https://api.imd.gov.in/api/v1/cyclone_wind');
  console.log('Cyclone Wind Status:', cw.status || cw.error);
  if (cw.data) console.log('Cyclone Wind Data Preview:', cw.data.slice(0, 300));
  
  process.exit(0);
}

test();
