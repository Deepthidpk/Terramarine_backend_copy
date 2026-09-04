const https = require('https');

function fetchPage(urlStr) {
  return new Promise((resolve) => {
    https.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
  });
}

async function inspectMausam() {
  const html = await fetchPage('https://mausam.imd.gov.in/responsive/marine_forecast.php');
  console.log('Searching for api.imd.gov.in or fetch or ajax in marine_forecast.php...');
  
  const matches = html.match(/(https?:\/\/[^\s"']+api[^\s"']*)/gi) || [];
  console.log('API URLs found in HTML:', matches);

  const scriptSrcs = html.match(/src=["']([^"']+\.js[^"']*)["']/gi) || [];
  console.log('Script sources:', scriptSrcs.slice(0, 10));

  // Search for inline script tags
  const inlineScripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
  console.log(`Found ${inlineScripts.length} script tags.`);
  for (let i = 0; i < inlineScripts.length; i++) {
    const s = inlineScripts[i];
    if (s.includes('api.imd.gov.in') || s.includes('seabulletin') || s.includes('coastal') || s.includes('api_key') || s.includes('key')) {
      console.log(`--- Script ${i} matches ---`);
      console.log(s.slice(0, 1000));
    }
  }

  // Check coastal forecast page as well
  const coastalHtml = await fetchPage('https://mausam.imd.gov.in/responsive/coastal_forecast.php');
  const coastalMatches = coastalHtml.match(/(https?:\/\/[^\s"']+api[^\s"']*)/gi) || [];
  console.log('Coastal API URLs found in HTML:', coastalMatches);
  const coastalInlineScripts = coastalHtml.match(/<script[\s\S]*?<\/script>/gi) || [];
  for (let i = 0; i < coastalInlineScripts.length; i++) {
    const s = coastalInlineScripts[i];
    if (s.includes('api.imd.gov.in') || s.includes('seabulletin') || s.includes('coastal') || s.includes('api_key') || s.includes('key')) {
      console.log(`--- Coastal Script ${i} matches ---`);
      console.log(s.slice(0, 1000));
    }
  }
}

inspectMausam();
