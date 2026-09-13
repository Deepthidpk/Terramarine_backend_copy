const db = require('../config/db');
const { fetchSeaBulletins } = require('./imdSeaBulletinService');
const { fetchCoastalBulletins } = require('./imdCoastalBulletinService');

let lastSyncTimestamp = 0;
const SYNC_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes cache throttle

/**
 * Evaluates marine safety status strictly from official IMD bulletin warning text
 */
const evaluateMarineStatus = (bulletins = []) => {
  if (!bulletins || bulletins.length === 0) {
    return {
      statusCode: 'INFORMATION_UNAVAILABLE',
      statusText: 'INFORMATION UNAVAILABLE',
      badgeColor: '#94a3b8',
      message: 'Unable to retrieve or verify the latest IMD marine information. Refer to official broadcasts.'
    };
  }

  let hasWarning = false;
  let hasAdvisory = false;
  let activeWarningText = '';
  let activeWarningLayer = '';

  for (const b of bulletins) {
    const warn = (b.warning || '').trim().toUpperCase();
    const isNil = !warn || warn === 'NIL' || warn === 'NIL.' || warn === 'NIL AT ALL PORTS' || warn === 'NONE';

    if (!isNil) {
      if (warn.includes('WARNING') || warn.includes('GALE') || warn.includes('CYCLONE') || warn.includes('STORMY') || warn.includes('DANGER') || warn.includes('HIGH SEAS')) {
        hasWarning = true;
        activeWarningText = b.warning;
        activeWarningLayer = b.layer;
        break; // High priority warning found
      } else {
        hasAdvisory = true;
        activeWarningText = b.warning;
        activeWarningLayer = b.layer;
      }
    }
  }

  if (hasWarning) {
    return {
      statusCode: 'WARNING_ACTIVE',
      statusText: 'WARNING ACTIVE',
      badgeColor: '#ef4444',
      message: `An official IMD warning is currently active for ${activeWarningLayer}: "${activeWarningText}"`,
      warningText: activeWarningText,
      warningLayer: activeWarningLayer
    };
  }

  if (hasAdvisory) {
    return {
      statusCode: 'ADVISORY_CAUTION',
      statusText: 'ADVISORY / CAUTION',
      badgeColor: '#f59e0b',
      message: `An advisory condition is present in the latest IMD bulletin for ${activeWarningLayer}: "${activeWarningText}"`,
      warningText: activeWarningText,
      warningLayer: activeWarningLayer
    };
  }

  return {
    statusCode: 'NO_ACTIVE_WARNING',
    statusText: 'NO ACTIVE WARNING',
    badgeColor: '#10b981',
    message: 'No active official warning is present in the latest retrieved IMD bulletin.'
  };
};

/**
 * Upserts bulletin into PostgreSQL database and triggers fisherman notifications for new warnings
 */
const saveBulletinToDb = async (bulletin) => {
  try {
    const extId = bulletin.id || `${bulletin.bulletinType}_${bulletin.layer}_${bulletin.updateTime || Date.now()}`;

    // Check if bulletin record already exists with same external_id, layer, and source_update_time
    const existing = await db.query(
      `SELECT id, warning FROM marine_bulletins WHERE bulletin_type = $1 AND layer = $2 AND external_id = $3 LIMIT 1`,
      [bulletin.bulletinType, bulletin.layer, extId]
    );

    let savedId = null;

    if (existing.rows.length > 0) {
      savedId = existing.rows[0].id;
      // Update existing record
      await db.query(
        `UPDATE marine_bulletins SET
          observation_date = $1,
          issued_by = $2,
          valid_from = $3,
          validity_hours = $4,
          warning = $5,
          wind = $6,
          synoptic_situation = $7,
          weather = $8,
          visibility = $9,
          sea_condition = $10,
          port_signal = $11,
          part4 = $12,
          part5 = $13,
          part6 = $14,
          source_update_time = $15,
          retrieved_at = NOW(),
          raw_response = $16,
          updated_at = NOW()
        WHERE id = $17`,
        [
          bulletin.observationDate || null,
          bulletin.issuedBy || null,
          bulletin.validFrom || null,
          bulletin.validityHours || 12,
          bulletin.warning || 'NIL',
          bulletin.wind || null,
          bulletin.synopticSituation || null,
          bulletin.weather || null,
          bulletin.visibility || null,
          bulletin.seaCondition || null,
          bulletin.portSignal || null,
          bulletin.part4 || null,
          bulletin.part5 || null,
          bulletin.part6 || null,
          bulletin.updateTime || null,
          JSON.stringify(bulletin.rawResponse || {}),
          savedId
        ]
      );
    } else {
      // Insert new record
      const insertResult = await db.query(
        `INSERT INTO marine_bulletins (
          external_id, bulletin_type, observation_date, layer, issued_by, valid_from, validity_hours,
          warning, wind, synoptic_situation, weather, visibility, sea_condition, port_signal,
          part4, part5, part6, source, source_update_time, retrieved_at, raw_response
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'IMD', $18, NOW(), $19
        ) RETURNING id`,
        [
          extId,
          bulletin.bulletinType,
          bulletin.observationDate || null,
          bulletin.layer,
          bulletin.issuedBy || null,
          bulletin.validFrom || null,
          bulletin.validityHours || 12,
          bulletin.warning || 'NIL',
          bulletin.wind || null,
          bulletin.synopticSituation || null,
          bulletin.weather || null,
          bulletin.visibility || null,
          bulletin.seaCondition || null,
          bulletin.portSignal || null,
          bulletin.part4 || null,
          bulletin.part5 || null,
          bulletin.part6 || null,
          bulletin.updateTime || null,
          JSON.stringify(bulletin.rawResponse || {})
        ]
      );
      savedId = insertResult.rows[0].id;
    }

    // Notification Trigger: Check if warning is active (not NIL) and notify fishermen if not notified previously
    const warnUpper = (bulletin.warning || '').trim().toUpperCase();
    const isNil = !warnUpper || warnUpper === 'NIL' || warnUpper === 'NIL.' || warnUpper === 'NIL AT ALL PORTS' || warnUpper === 'NONE';

    if (!isNil && savedId) {
      // Check if notification already dispatched for this savedId or external_id
      const notifCheck = await db.query(
        `SELECT notification_id FROM notifications WHERE reference_type = 'IMD_Marine_Bulletin' AND reference_id = $1 LIMIT 1`,
        [savedId]
      );

      if (notifCheck.rows.length === 0) {
        const notifTitle = `⚠️ Official IMD Marine Warning: ${bulletin.layer}`;
        const notifMessage = `An official IMD warning has been issued for coastal region (${bulletin.layer}). Warning: ${bulletin.warning}. Valid From: ${bulletin.validFrom || 'Immediate'}`;
        
        await db.query(
          `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
           SELECT user_id, $1, $2, 'IMD_Marine_Bulletin', $3
           FROM users WHERE role = 'Fisherman'`,
          [notifTitle, notifMessage, savedId]
        );
      }
    }

    return savedId;
  } catch (err) {
    console.error('Error saving marine bulletin to DB:', err.message);
    return null;
  }
};

/**
 * Synchronizes Sea and Coastal Bulletins from official IMD APIs
 */
const syncMarineBulletins = async (force = false) => {
  const now = Date.now();
  if (!force && (now - lastSyncTimestamp < SYNC_THROTTLE_MS)) {
    return { synced: false, reason: 'Throttled' };
  }

  let seaCount = 0;
  let coastalCount = 0;
  let fetchError = null;

  // 1. Fetch & Sync Sea Area Bulletins
  try {
    const seaBulletins = await fetchSeaBulletins();
    for (const sb of seaBulletins) {
      await saveBulletinToDb(sb);
      seaCount++;
    }
  } catch (err) {
    console.warn('Sea Bulletin fetch warning:', err.message);
    fetchError = err.message;
  }

  // 2. Fetch & Sync Coastal Bulletins
  try {
    const coastalBulletins = await fetchCoastalBulletins();
    for (const cb of coastalBulletins) {
      await saveBulletinToDb(cb);
      coastalCount++;
    }
  } catch (err) {
    console.warn('Coastal Bulletin fetch warning:', err.message);
    if (!fetchError) fetchError = err.message;
  }

  lastSyncTimestamp = now;

  return {
    synced: true,
    seaCount,
    coastalCount,
    error: fetchError
  };
};

/**
 * Retrieve bulletins from Database with fallback to API if DB empty
 */
const getBulletinsFromDb = async (bulletinType = null, layerFilter = null) => {
  try {
    let query = `SELECT * FROM marine_bulletins WHERE 1=1`;
    const params = [];

    if (bulletinType) {
      params.push(bulletinType);
      query += ` AND bulletin_type = $${params.length}`;
    }

    if (layerFilter && layerFilter.trim() && layerFilter !== 'All') {
      const filter = layerFilter.trim();
      const lowerFilter = filter.toLowerCase();

      const keralaKeywords = ['kerala', 'ernakulam', 'kochi', 'thiruvananthapuram', 'trivandrum', 'alappuzha', 'alleppey', 'kollam', 'quilon', 'kozhikode', 'calicut', 'kannur', 'kasargod', 'thrissur', 'malappuram', 'ponnani', 'vizhinjam', 'kovalam', 'munambam', 'vypin', 'cherai'];

      if (keralaKeywords.some(kw => lowerFilter.includes(kw))) {
        query += ` AND (layer ILIKE '%kerala%' OR layer ILIKE '%lakshadweep%' OR layer ILIKE '%south coast%' OR issued_by ILIKE '%thiruvananthapuram%')`;
      } else {
        params.push(`%${filter}%`);
        query += ` AND (layer ILIKE $${params.length} OR issued_by ILIKE $${params.length})`;
      }
    }

    query += ` ORDER BY retrieved_at DESC, created_at DESC LIMIT 50`;

    const res = await db.query(query, params);
    return res.rows.map(row => ({
      source: row.source || 'IMD',
      bulletinType: row.bulletin_type,
      id: row.external_id || row.id,
      dbId: row.id,
      observationDate: row.observation_date,
      layer: row.layer,
      issuedBy: row.issued_by,
      validFrom: row.valid_from,
      validityHours: row.validity_hours,
      warning: row.warning || 'NIL',
      wind: row.wind,
      synopticSituation: row.synoptic_situation,
      weather: row.weather,
      visibility: row.visibility,
      seaCondition: row.sea_condition,
      portSignal: row.port_signal,
      part4: row.part4,
      part5: row.part5,
      part6: row.part6,
      updateTime: row.source_update_time,
      retrievedAt: row.retrieved_at,
      rawResponse: row.raw_response
    }));
  } catch (err) {
    console.error('Error fetching marine bulletins from DB:', err.message);
    return [];
  }
};

const { resolveImdCoverage } = require('./imdCoverageService');
const { fetchPortWarnings } = require('./imdCoastalBulletinService');
const {
  parseBulletinValidity,
  calculateMarineAlert,
  calculateWeatherAlert,
  calculateOverallSafety,
  isWarningApplicableToLocation
} = require('./marineSafetyEvaluator');

/**
 * Strictly location-scoped alert resolver for Fisherman users
 * Reads user's DB location, resolves IMD coverage region, filters bulletins,
 * evaluates official warning status, and returns ONLY relevant bulletins.
 */
const getRelevantAlertsForFisherman = async (user) => {
  if (!user) {
    throw new Error('User context required');
  }

  const state = user.location_state || user.state || '';
  const district = user.location_district || user.district || '';
  const municipality = user.location_municipality || '';
  const coastalArea = user.location_coastal_area || '';

  // 1. Resolve IMD Coverage Region & Port ID
  const coverage = resolveImdCoverage(state, district, municipality, coastalArea);
  const locationObj = { state, district, municipality, coastalArea };

  // 2. Make sure marine bulletins are synced
  try {
    await syncMarineBulletins(false);
  } catch (err) {}

  // 3. Retrieve all Coastal and Sea Area bulletins from DB
  const coastalBulletins = await getBulletinsFromDb('COASTAL', null);
  const seaBulletins = await getBulletinsFromDb('SEA_AREA', null);

  // 4. Fetch Port Warnings
  let portWarnings = [];
  try {
    portWarnings = await fetchPortWarnings();
  } catch (err) {}

  // 5. Strictly filter Coastal Bulletins by IMD coverage layer keywords
  let relevantCoastal = null;
  if (coverage.layerKeywords && coverage.layerKeywords.length > 0) {
    relevantCoastal = coastalBulletins.find(b => {
      const bLayer = (b.layer || '').toLowerCase();
      return coverage.layerKeywords.some(kw => bLayer.includes(kw));
    });
  }

  // 6. Strictly filter Sea Area Bulletins by coverage sea area keywords
  let relevantSea = null;
  if (coverage.seaAreaKeywords && coverage.seaAreaKeywords.length > 0) {
    relevantSea = seaBulletins.find(b => {
      const bLayer = (b.layer || '').toLowerCase();
      // Ensure we don't accidentally pick Lakshadweep Sea for North Kerala if user is in Kerala
      if (coverage.state === 'Kerala' && bLayer.includes('lakshadweep') && !coverage.region.includes('Lakshadweep')) {
        return false;
      }
      return coverage.seaAreaKeywords.some(kw => bLayer.includes(kw));
    });
  }
  // Fallback to first general Arabian Sea / Kerala Sea bulletin if exact layer keyword not in title but applies (excluding Lakshadweep-only)
  if (!relevantSea && coverage.state === 'Kerala') {
    relevantSea = seaBulletins.find(b => {
      const bLayer = (b.layer || '').toLowerCase();
      if (bLayer.includes('lakshadweep')) return false;
      return bLayer.includes('kerala') || bLayer.includes('arabian sea') || bLayer.includes('south east');
    }) || null;
  }

  // 7. Filter Port Warning if portName is resolved
  let relevantPort = null;
  if (coverage.portName) {
    const searchPort = coverage.portName.toLowerCase();
    relevantPort = portWarnings.find(pw => (pw.portName || '').toLowerCase().includes(searchPort)) || null;
  }

  // 7.1 Fetch & Evaluate Official IMD Cyclone Wind Warnings
  let cycloneWarning = null;
  try {
    const { fetchCycloneWindWarnings, evaluateCycloneWindWarningForLocation } = require('./imdCycloneService');
    const cycloneData = await fetchCycloneWindWarnings();
    const coords = user.latitude && user.longitude ? [parseFloat(user.longitude), parseFloat(user.latitude)] : coverage.coordinates;
    cycloneWarning = evaluateCycloneWindWarningForLocation(cycloneData, coords);
  } catch (err) {}

  // 8. Deterministic Evaluation for Marine Alert, Weather Alert, and Overall Status
  const marineAlert = calculateMarineAlert({
    coastalBulletin: relevantCoastal,
    seaBulletin: relevantSea,
    portWarning: relevantPort,
    cycloneWarning: cycloneWarning,
    location: locationObj,
    coverage: coverage,
    currentTime: new Date()
  });

  const weatherAlert = calculateWeatherAlert({
    coastalBulletin: relevantCoastal,
    seaBulletin: relevantSea,
    cycloneWarning: cycloneWarning,
    location: locationObj,
    coverage: coverage,
    currentTime: new Date()
  });

  const overallStatus = calculateOverallSafety(marineAlert, weatherAlert);

  // Validity checks
  const coastalValidity = relevantCoastal ? parseBulletinValidity(relevantCoastal) : null;
  const seaValidity = relevantSea ? parseBulletinValidity(relevantSea) : null;
  const primaryValidity = coastalValidity || seaValidity || {
    isValid: false,
    formattedValidUntil: 'Unavailable',
    validUntil: null
  };

  // Backwards-compatible legacy status object matching overall evaluation
  const legacyStatus = {
    statusCode: overallStatus.level === 'RED' ? 'OFFICIAL_WARNING_ACTIVE' : overallStatus.level === 'YELLOW' ? 'ADVISORY_CAUTION' : overallStatus.level === 'GREEN' ? 'NO_ACTIVE_WARNING' : 'INFORMATION_UNAVAILABLE',
    statusText: overallStatus.title,
    badgeColor: overallStatus.badgeColor,
    message: overallStatus.message
  };

  return {
    success: true,
    location: {
      state: state || 'Kerala',
      district: district || 'Malappuram',
      municipality: municipality || 'Ponnani Municipality',
      coastalArea: coastalArea || 'Ponnani Light House & Harbour'
    },
    imdCoverage: {
      region: coverage.region,
      portName: coverage.portName || null,
      coordinates: coverage.coordinates || null
    },
    status: legacyStatus,
    marineAlert,
    weatherAlert,
    overallStatus,
    validity: primaryValidity,
    cycloneWarning: cycloneWarning || null,
    relevantCoastalBulletin: relevantCoastal || null,
    relevantSeaBulletin: relevantSea || null,
    relevantPortWarning: relevantPort || null,
    counts: {
      coastal: relevantCoastal ? 1 : 0,
      seaArea: relevantSea ? 1 : 0,
      port: relevantPort ? 1 : 0
    },
    retrievedAt: new Date().toISOString()
  };
};

module.exports = {
  evaluateMarineStatus,
  syncMarineBulletins,
  getBulletinsFromDb,
  getRelevantAlertsForFisherman
};
