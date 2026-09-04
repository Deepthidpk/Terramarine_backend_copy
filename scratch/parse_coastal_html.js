const https = require('https');

function fetchPage(urlStr) {
  return new Promise((resolve) => {
    https.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
  });
}

async function run() {
  const html = await fetchPage('https://mausam.imd.gov.in/Forecast/coastal_bulletin_new.php');
  console.log('--- HTML of coastal_bulletin_new.php ---');
  console.log(html);

  const htmlId6 = await fetchPage('https://mausam.imd.gov.in/Forecast/coastal_bulletin_new.php?id=6');
  console.log('--- HTML of coastal_bulletin_new.php?id=6 ---');
  console.log(htmlId6);
}

run();
