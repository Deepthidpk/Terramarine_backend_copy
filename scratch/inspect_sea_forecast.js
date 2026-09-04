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
  const html = await fetchPage('https://mausam.imd.gov.in/responsive/marine_forecast.php');
  
  // Look for any links to bulletin pages
  const matches = html.match(/href=["']([^"']*bulletin[^"']*)["']/gi) || [];
  console.log('Bulletin links in marine_forecast.php:', matches);

  // Look for php or data links
  const phpMatches = html.match(/href=["']([^"']*\.php[^"']*)["']/gi) || [];
  console.log('PHP links in marine_forecast.php:', phpMatches);

  // Look for iframe or data-link
  const dataLinks = html.match(/data-link=["']([^"']*)["']/gi) || [];
  console.log('Data-link attributes:', dataLinks);
}

run();
