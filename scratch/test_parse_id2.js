const https = require('https');
const { parseImdCoastalHtmlBulletin } = require('../src/services/imdCoastalBulletinService');

https.get('https://mausam.imd.gov.in/Forecast/coastal_bulletin_new.php?id=2', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
  rejectUnauthorized: false
}, (res) => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    const bulletins = parseImdCoastalHtmlBulletin(html);
    console.log(`Parsed ${bulletins.length} bulletins from ID 2:`);
    bulletins.forEach(b => {
      console.log('---');
      console.log('Layer:', b.layer);
      console.log('Issued By:', b.issuedBy);
      console.log('Wind:', b.wind);
      console.log('Weather:', b.weather);
      console.log('Sea Condition:', b.seaCondition);
      console.log('Visibility:', b.visibility);
      console.log('Port Signal:', b.portSignal);
      console.log('Warning:', b.warning);
      console.log('Valid From:', b.validFrom);
    });
  });
});
