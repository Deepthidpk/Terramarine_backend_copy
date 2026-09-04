const https = require('https');

function fetchPage(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}

function parseImdHtmlBulletin(html, bulletinType = 'COASTAL') {
  const bulletins = [];
  
  // Extract Issued by (e.g. ACWC CHENNAI, ACWC KOLKATA)
  const issuedByMatch = html.match(/ACWC\s+[A-Z]+/i) || html.match(/CWC\s+[A-Z]+/i) || html.match(/India Meteorological Department[^<]*/i);
  const issuedBy = issuedByMatch ? issuedByMatch[0].trim() : 'IMD';

  // Extract Valid From / Validity / Date
  const validMatch = html.match(/Bulletin Valid for [^<]+/i) || html.match(/Valid for [^<]+/i);
  const validInfo = validMatch ? validMatch[0].trim() : '';

  // Extract Issue Time
  const timeMatch = html.match(/Time of Issue<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
  const updateTime = timeMatch ? timeMatch[1].trim() : new Date().toISOString();

  // Extract Synoptic Situation
  const synopticMatch = html.match(/Synoptic Situation<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
  const synopticSituation = synopticMatch ? synopticMatch[1].trim() : 'NIL';

  // Extract Layer tables
  // Each layer has <caption class="caption">\s*([^<]+)\s*</caption> followed by <tr><td class="td-1">Field</td><td>Value</td></tr>
  const tableRegex = /<caption class="caption">\s*([\s\S]*?)\s*<\/caption>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html)) !== null) {
    const layerName = match[1].replace(/<[^>]+>/g, '').trim();
    const tableBody = match[2];

    const fields = {};
    const rowRegex = /<td class="td-1">([^<]+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
      const fieldKey = rowMatch[1].replace(/<[^>]+>/g, '').trim();
      const fieldValue = rowMatch[2].replace(/<[^>]+>/g, '').trim();
      fields[fieldKey] = fieldValue;
    }

    if (layerName) {
      const warningText = fields["TTT Warning"] || fields["Storm Surge/Tidal Warning"] || fields["Warning"] || "NIL";
      bulletins.push({
        source: 'IMD',
        bulletinType,
        id: `IMD_${layerName.replace(/\s+/g, '_')}_${Date.now()}`,
        observationDate: new Date().toISOString().split('T')[0],
        layer: layerName,
        issuedBy: issuedBy,
        validFrom: validInfo,
        validityHours: 12,
        warning: warningText,
        wind: fields["Wind"] || "",
        synopticSituation: synopticSituation,
        weather: fields["Weather"] || "",
        visibility: fields["Visibility"] || "",
        seaCondition: fields["Sea Condition"] || "",
        portSignal: fields["Port Signal"] || "NIL",
        part4: fields["Part 4"] || "NIL",
        part5: fields["Part 5"] || "NIL",
        part6: fields["Part 6"] || "NIL",
        updateTime: updateTime,
        rawResponse: { sourceUrl: 'mausam.imd.gov.in', fields }
      });
    }
  }

  return bulletins;
}

async function runTest() {
  const ids = ['', '?id=2', '?id=4', '?id=5', '?id=6', '?id=7'];
  let allBulletins = [];

  for (const idParam of ids) {
    const url = `https://mausam.imd.gov.in/Forecast/coastal_bulletin_new.php${idParam}`;
    try {
      const html = await fetchPage(url);
      const parsed = parseImdHtmlBulletin(html, 'COASTAL');
      console.log(`URL ${url} -> Found ${parsed.length} coastal layers.`);
      allBulletins.push(...parsed);
    } catch (err) {
      console.error(`Error fetching ${url}:`, err.message);
    }
  }

  console.log(`\nTotal parsed IMD Coastal Bulletins: ${allBulletins.length}`);
  console.log('Sample parsed bulletin:', JSON.stringify(allBulletins[0], null, 2));
}

runTest();
