const db = require('../config/db');
const { resolveImdCoverage } = require('../services/imdCoverageService');
const marineService = require('../services/marineService');

/**
 * GET /api/fisherman/location
 * Returns authenticated fisherman's location status and details
 */
exports.getLocation = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await db.query(
      `SELECT location_state, location_district, location_municipality, location_coastal_area, imd_coverage_region, imd_port_id, location_completed, location_updated_at
       FROM users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fisherman account not found.' });
    }

    const row = result.rows[0];
    const coverage = resolveImdCoverage(
      row.location_state || '',
      row.location_district || '',
      row.location_municipality || '',
      row.location_coastal_area || ''
    );

    return res.json({
      success: true,
      location: {
        state: row.location_state || '',
        district: row.location_district || '',
        municipality: row.location_municipality || '',
        coastalArea: row.location_coastal_area || '',
        imdCoverageRegion: row.imd_coverage_region || coverage.region,
        imdPortId: row.imd_port_id || coverage.portName,
        completed: Boolean(row.location_completed),
        updatedAt: row.location_updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching fisherman location:', error.message);
    return res.status(500).json({ error: 'Server error retrieving fisherman location.' });
  }
};

/**
 * PUT /api/fisherman/location
 * Updates authenticated fisherman's coastal location details, computes IMD coverage region, and sets location_completed = true
 */
exports.updateLocation = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { state, district, municipality, coastalArea } = req.body;

    const cleanState = (state || '').trim();
    const cleanDistrict = (district || '').trim();
    const cleanMunicipality = (municipality || '').trim();
    const cleanCoastalArea = (coastalArea || '').trim();

    if (!cleanState) {
      return res.status(400).json({ error: 'Please select your state.' });
    }
    if (!cleanDistrict) {
      return res.status(400).json({ error: 'Please select your district.' });
    }
    if (!cleanMunicipality) {
      return res.status(400).json({ error: 'Please select your municipality/local body.' });
    }
    if (!cleanCoastalArea) {
      return res.status(400).json({ error: 'Please select your exact coastal area.' });
    }

    // Resolve IMD Coverage Region
    const coverage = resolveImdCoverage(cleanState, cleanDistrict, cleanMunicipality, cleanCoastalArea);

    const result = await db.query(
      `UPDATE users
       SET location_state = $1,
           location_district = $2,
           location_municipality = $3,
           location_coastal_area = $4,
           imd_coverage_region = $5,
           imd_port_id = $6,
           location_completed = TRUE,
           location_updated_at = NOW()
       WHERE user_id = $7 AND role = 'Fisherman'
       RETURNING user_id, full_name, email, role, location_state, location_district, location_municipality, location_coastal_area, imd_coverage_region, imd_port_id, location_completed`,
      [cleanState, cleanDistrict, cleanMunicipality, cleanCoastalArea, coverage.region, coverage.portName || null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fisherman account not found or access denied.' });
    }

    const updatedUser = result.rows[0];

    return res.json({
      success: true,
      message: 'Coastal location saved successfully.',
      location: {
        state: updatedUser.location_state,
        district: updatedUser.location_district,
        municipality: updatedUser.location_municipality,
        coastalArea: updatedUser.location_coastal_area,
        imdCoverageRegion: updatedUser.imd_coverage_region,
        imdPortId: updatedUser.imd_port_id,
        completed: Boolean(updatedUser.location_completed)
      }
    });
  } catch (error) {
    console.error('Error updating fisherman location:', error.message);
    return res.status(500).json({ error: 'Unable to save your location. Please try again.' });
  }
};

/**
 * GET /api/fisherman/marine/relevant-alerts
 * Returns strictly location-filtered IMD Weather & Marine bulletins for the authenticated fisherman
 */
exports.getRelevantAlerts = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Fetch latest user location details from DB
    const userRes = await db.query(
      `SELECT user_id, role, location_state, location_district, location_municipality, location_coastal_area, imd_coverage_region, imd_port_id
       FROM users WHERE user_id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fisherman account not found.' });
    }

    const userObj = userRes.rows[0];
    const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
    const data = await marineService.getRelevantAlertsForFisherman(userObj, forceRefresh);

    return res.json(data);
  } catch (error) {
    console.error('Error fetching relevant fisherman alerts:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Location-specific marine information is currently unavailable.',
      message: 'Unable to retrieve location-specific IMD warnings.'
    });
  }
};
