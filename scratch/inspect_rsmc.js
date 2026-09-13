const https = require('https');

https.get('https://rsmcnewdelhi.imd.gov.in/port-warning.php', { rejectUnauthorized: false }, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    // Look for tables or port warnings
    const tables = data.match(/<table[\s\S]*?<\/table>/gi) || [];
    console.log(`Found ${tables.length} tables`);
    tables.forEach((t, i) => {
      console.log(`\n--- TABLE ${i + 1} ---`);
      console.log(t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500));
    });
    process.exit(0);
  });
}).on('error', e => console.error(e));
