const http = require('http');
const https = require('https');

const IMD_COASTAL_BULLETIN_URL = process.env.IMD_COASTAL_BULLETIN_URL || 'https://api.imd.gov.in/api/v1/coastalbulletin';

/**
 * Helper to fetch content from URL
 */
const httpGet = (urlStr, timeoutMs = 10000, headers = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.get(urlStr, {
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/html, text/plain, */*',
          ...headers
        },
        rejectUnauthorized: false
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data });
          } else {
            reject(new Error(`HTTP Status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Normalizes raw JSON bulletin item
 */
const normalizeCoastalBulletin = (item) => {
  if (!item || typeof item !== 'object') return null;

  const layer = (item["Layer"] || item.layer || '').trim();
  if (!layer) return null;

  return {
    source: 'IMD',
    bulletinType: 'COASTAL',
    id: String(item["Id"] || item.id || `COASTAL_${layer.replace(/\s+/g, '_')}`).trim(),
    observationDate: item["Date of Observation"] || item.observationDate || new Date().toISOString().split('T')[0],
    layer: layer,
    issuedBy: (item["Issued by"] || item.issuedBy || 'IMD').trim(),
    validFrom: item["Valid From"] || item.validFrom || '',
    validityHours: parseInt(item["Validity"] || item.validityHours || 12, 10) || 12,
    warning: (item["TTT Warning"] || item.warning || item["Warning"] || 'NIL').trim(),
    wind: (item["Wind"] || item.wind || '').trim(),
    synopticSituation: (item["Synoptic Situation"] || item.synopticSituation || '').trim(),
    weather: (item["Weather"] || item.weather || '').trim(),
    visibility: (item["Visibility"] || item.visibility || '').trim(),
    seaCondition: (item["Sea Condition"] || item.seaCondition || '').trim(),
    portSignal: (item["Port Signal"] || item.portSignal || 'NIL').trim(),
    part4: (item["Part 4"] || item.part4 || 'NIL').trim(),
    part5: (item["Part 5"] || item.part5 || 'NIL').trim(),
    part6: (item["Part 6"] || item.part6 || 'NIL').trim(),
    updateTime: item["Update Time"] || item.updateTime || new Date().toISOString(),
    rawResponse: item
  };
};

/**
 * Parses official IMD live portal HTML into normalized Coastal bulletins
 */
const parseImdCoastalHtmlBulletin = (html) => {
  const bulletins = [];
  if (!html) return bulletins;

  const issuedByMatch = html.match(/ACWC\s+[A-Z]+/i) || html.match(/CWC\s+[A-Z]+/i) || html.match(/India Meteorological Department[^<]*/i);
  const issuedBy = issuedByMatch ? issuedByMatch[0].trim() : 'IMD';

  const validMatch = html.match(/Bulletin Valid for [^<]+/i) || html.match(/Valid for [^<]+/i) || html.match(/DAILY [^<]+/i);
  const validInfo = validMatch ? validMatch[0].trim().replace(/\s+/g, ' ') : '';

  const timeMatch = html.match(/Time of Issue<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
  const updateTime = timeMatch ? timeMatch[1].trim() : new Date().toISOString();

  const synopticMatch = html.match(/Synoptic Situation<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
  const synopticSituation = synopticMatch ? synopticMatch[1].trim() : 'NIL';

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
        bulletinType: 'COASTAL',
        id: `IMD_COASTAL_${layerName.replace(/\s+/g, '_')}_${Date.now()}`,
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
};

/**
 * Service function to fetch and normalize IMD Coastal Bulletins
 */
const fetchCoastalBulletins = async (bulletinId = null) => {
  // 1. Try REST API first
  try {
    let targetUrl = IMD_COASTAL_BULLETIN_URL;
    if (bulletinId) targetUrl += `?id=${encodeURIComponent(bulletinId)}`;

    const reqHeaders = {};
    if (process.env.IMD_API_KEY) {
      reqHeaders['Authorization'] = `Bearer ${process.env.IMD_API_KEY}`;
      reqHeaders['x-api-key'] = process.env.IMD_API_KEY;
    }

    const response = await httpGet(targetUrl, 8000, reqHeaders);
    const parsed = JSON.parse(response.data);
    let list = [];
    if (Array.isArray(parsed)) list = parsed;
    else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.data)) list = parsed.data;
      else if (parsed.Id || parsed["Id"]) list = [parsed];
    }

    const normalized = list.map(normalizeCoastalBulletin).filter(b => b !== null);
    if (normalized.length > 0) return normalized;
  } catch (err) {
    // Fall back to live IMD web portal
  }

  // 2. Fallback to Official IMD Web Portal forecast endpoint
  const results = [];
  const ids = bulletinId ? [`?id=${bulletinId}`] : ['', '?id=2', '?id=3', '?id=4', '?id=5', '?id=6', '?id=7'];

  for (const idParam of ids) {
    try {
      const url = `https://mausam.imd.gov.in/Forecast/coastal_bulletin_new.php${idParam}`;
      const res = await httpGet(url, 8000);
      const parsedHtml = parseImdCoastalHtmlBulletin(res.data);
      results.push(...parsedHtml);
    } catch (e) {}
  }

  // Deduplicate by layer name
  const seenLayers = new Set();
  const uniqueResults = [];
  for (const item of results) {
    if (!seenLayers.has(item.layer)) {
      seenLayers.add(item.layer);
      uniqueResults.push(item);
    }
  }

  return uniqueResults;
};

/**
 * Service function to fetch IMD Port Warnings
 */
const fetchPortWarnings = async (portId = null) => {
  try {
    let url = process.env.IMD_PORT_WARNING_URL || 'https://api.imd.gov.in/api/v1/portwarning';
    if (portId) {
      url += `?id=${encodeURIComponent(portId)}`;
    }

    const reqHeaders = {};
    if (process.env.IMD_API_KEY) {
      reqHeaders['Authorization'] = `Bearer ${process.env.IMD_API_KEY}`;
      reqHeaders['x-api-key'] = process.env.IMD_API_KEY;
    }

    const response = await httpGet(url, 8000, reqHeaders);
    const parsed = JSON.parse(response.data);
    let list = [];
    if (Array.isArray(parsed)) list = parsed;
    else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.data)) list = parsed.data;
      else if (parsed.Id || parsed.id || parsed["Port Id"] || parsed["Port Name"]) list = [parsed];
    }
    return list.map(item => ({
      source: 'IMD',
      bulletinType: 'PORT_WARNING',
      portId: String(item["Port Id"] || item.port_id || item.portId || item.id || item.Id || `PORT_${Date.now()}`),
      portName: String(item["Port Name"] || item.port_name || item.portName || '').trim(),
      warning: String(item["Warning"] || item["TTT Warning"] || item.warning || item["Port Signal"] || item.signal || 'NIL').trim(),
      signal: String(item["Port Signal"] || item.signal || item["Warning Signal"] || 'NIL').trim(),
      issuedBy: String(item["Issued By"] || item["Issued by"] || item.issued_by || item.issuedBy || 'IMD').trim(),
      dateOfIssue: String(item["Date of Issue"] || item["Date of issue"] || item.date_of_issue || item.issue_time || new Date().toISOString().split('T')[0]).trim(),
      rawResponse: item
    }));
  } catch (err) {
    return [];
  }
};

module.exports = {
  fetchCoastalBulletins,
  fetchPortWarnings,
  normalizeCoastalBulletin,
  parseImdCoastalHtmlBulletin
};
