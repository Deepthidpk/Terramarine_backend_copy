const https = require('https');

function httpGet(urlStr) {
  return new Promise((resolve) => {
    https.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

async function testAll() {
  for (let i = 1; i <= 15; i++) {
    const url = `https://mausam.imd.gov.in/Forecast/coastal_bulletin_new.php?id=${i}`;
    const html = await httpGet(url);
    if (!html) continue;

    const issuedByMatch = html.match(/ACWC\s+[A-Z]+/i) || html.match(/CWC\s+[A-Z]+/i);
    const issuedBy = issuedByMatch ? issuedByMatch[0] : '';

    const tableRegex = /<caption class="caption">\s*([\s\S]*?)\s*<\/caption>/gi;
    let match;
    const layers = [];
    while ((match = tableRegex.exec(html)) !== null) {
      layers.push(match[1].replace(/<[^>]+>/g, '').trim());
    }

    if (layers.length > 0) {
      console.log(`ID ${i}: Issued By: ${issuedBy} | Layers: ${layers.join(', ')}`);
    }
  }
}

testAll();
