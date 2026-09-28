const http = require('http');
const https = require('https');

const IMD_CYCLONE_WIND_URL = process.env.IMD_CYCLONE_WIND_URL || 'https://api.imd.gov.in/api/v1/cyclone_wind';

/**
 * Helper to fetch content from URL
 */
const httpGet = (urlStr, timeoutMs = 8000, headers = {}) => {
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
 * Standard Ray-Casting algorithm to check if a point [lon, lat] is inside a Polygon ring
 */
function isPointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks if a point [lon, lat] is inside a GeoJSON Polygon or MultiPolygon
 */
function isPointInMultiPolygon(point, geojsonGeometry) {
  if (!point || !geojsonGeometry || !geojsonGeometry.coordinates) return false;
  const { type, coordinates } = geojsonGeometry;

  if (type === 'Polygon') {
    // coordinates is array of rings (outer ring + holes)
    if (!coordinates[0] || coordinates[0].length === 0) return false;
    const inOuter = isPointInRing(point, coordinates[0]);
    if (!inOuter) return false;
    for (let h = 1; h < coordinates.length; h++) {
      if (isPointInRing(point, coordinates[h])) return false; // inside hole
    }
    return true;
  }

  if (type === 'MultiPolygon') {
    // coordinates is array of Polygons
    for (const poly of coordinates) {
      if (!poly || !poly[0] || poly[0].length === 0) continue;
      const inOuter = isPointInRing(point, poly[0]);
      if (inOuter) {
        let inHole = false;
        for (let h = 1; h < poly.length; h++) {
          if (isPointInRing(point, poly[h])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
    }
    return false;
  }

  return false;
}

/**
 * Fetches official IMD Cyclone Wind Warning data
 */
async function fetchCycloneWindWarnings() {
  try {
    const reqHeaders = {};
    if (process.env.IMD_API_KEY) {
      reqHeaders['Authorization'] = `Bearer ${process.env.IMD_API_KEY}`;
      reqHeaders['x-api-key'] = process.env.IMD_API_KEY;
    }

    const res = await httpGet(IMD_CYCLONE_WIND_URL, 8000, reqHeaders);
    const parsed = JSON.parse(res.data);
    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * Evaluates whether fisherman location is affected by active Cyclone Wind Warnings
 * @param {object} cycloneData Response from /api/v1/cyclone_wind
 * @param {number[]} coordinates [longitude, latitude]
 * @returns {object|null} Evaluation result if affected
 */
function evaluateCycloneWindWarningForLocation(cycloneData, coordinates) {
  if (!cycloneData || !cycloneData.data || !coordinates || coordinates.length < 2) {
    return null;
  }

  const [lon, lat] = coordinates;
  if (typeof lon !== 'number' || typeof lat !== 'number' || isNaN(lon) || isNaN(lat)) {
    return null;
  }

  const { data, totalCount } = cycloneData;
  const point = [lon, lat];

  // 1. Check 64kt (Hurricane Force >= 64 Knots)
  if (data['64kt'] && isPointInMultiPolygon(point, data['64kt'])) {
    return {
      active: true,
      tier: '64kt',
      windSpeedKnots: 64,
      level: 'RED',
      label: 'DO NOT GO TO SEA',
      category: 'Extremely Severe Cyclonic Storm (Hurricane Force Winds >= 64 Knots)',
      warningText: 'Official IMD Cyclone Warning: Hurricane force cyclone winds (>= 64 knots) affecting your coastal area.'
    };
  }

  // 2. Check 50kt (Storm Force 50-63 Knots)
  if (data['50kt'] && isPointInMultiPolygon(point, data['50kt'])) {
    return {
      active: true,
      tier: '50kt',
      windSpeedKnots: 50,
      level: 'RED',
      label: 'DO NOT GO TO SEA',
      category: 'Severe Cyclonic Storm (Storm Force Winds 50-63 Knots)',
      warningText: 'Official IMD Cyclone Warning: Dangerous storm-force cyclone winds (50-63 knots) active over your fishing zone.'
    };
  }

  // 3. Check 34kt (Gale Force 34-49 Knots)
  if (data['34kt'] && isPointInMultiPolygon(point, data['34kt'])) {
    return {
      active: true,
      tier: '34kt',
      windSpeedKnots: 34,
      level: 'RED',
      label: 'DO NOT GO TO SEA',
      category: 'Cyclonic Storm (Gale Force Winds 34-49 Knots)',
      warningText: 'Official IMD Cyclone Warning: Gale force winds (34-49 knots) active over your coastal zone.'
    };
  }

  // 4. Check 27kt (Near-Gale Force 27-33 Knots)
  if (data['27kt'] && isPointInMultiPolygon(point, data['27kt'])) {
    return {
      active: true,
      tier: '27kt',
      windSpeedKnots: 27,
      level: 'YELLOW',
      label: 'CAUTION',
      category: 'Deep Depression / Squally Winds (27-33 Knots)',
      warningText: 'Official IMD Cyclone Wind Advisory: Near-gale squally winds (27-33 knots) active in your zone.'
    };
  }

  return null;
}

module.exports = {
  fetchCycloneWindWarnings,
  isPointInMultiPolygon,
  evaluateCycloneWindWarningForLocation
};
