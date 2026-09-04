const marineService = require('../services/marineService');

// Get Sea Area Bulletin
exports.getSeaBulletin = async (req, res) => {
  try {
    const { layer, refresh } = req.query;
    if (refresh === 'true' || refresh === '1') {
      await marineService.syncMarineBulletins(true);
    } else {
      // Auto-sync in background if needed
      marineService.syncMarineBulletins(false).catch(() => {});
    }

    const bulletins = await marineService.getBulletinsFromDb('SEA_AREA', layer);

    if (bulletins.length === 0) {
      return res.json({
        source: 'India Meteorological Department (IMD)',
        bulletinType: 'SEA_AREA',
        count: 0,
        bulletins: [],
        message: 'No Sea Area bulletin is currently available for the selected area.'
      });
    }

    res.json({
      source: 'India Meteorological Department (IMD)',
      bulletinType: 'SEA_AREA',
      count: bulletins.length,
      lastUpdated: bulletins[0]?.retrievedAt || new Date().toISOString(),
      bulletins
    });
  } catch (error) {
    console.error('Get Sea Bulletin Error:', error);
    res.status(500).json({ 
      error: 'Unable to retrieve the latest IMD marine information. Please try again later.' 
    });
  }
};

// Get Coastal Bulletin
exports.getCoastalBulletin = async (req, res) => {
  try {
    const { layer, refresh } = req.query;
    if (refresh === 'true' || refresh === '1') {
      await marineService.syncMarineBulletins(true);
    } else {
      marineService.syncMarineBulletins(false).catch(() => {});
    }

    const bulletins = await marineService.getBulletinsFromDb('COASTAL', layer);

    if (bulletins.length === 0) {
      return res.json({
        source: 'India Meteorological Department (IMD)',
        bulletinType: 'COASTAL',
        count: 0,
        bulletins: [],
        message: 'No Coastal bulletin is currently available for the selected area.'
      });
    }

    res.json({
      source: 'India Meteorological Department (IMD)',
      bulletinType: 'COASTAL',
      count: bulletins.length,
      lastUpdated: bulletins[0]?.retrievedAt || new Date().toISOString(),
      bulletins
    });
  } catch (error) {
    console.error('Get Coastal Bulletin Error:', error);
    res.status(500).json({ 
      error: 'Unable to retrieve the latest IMD marine information. Please try again later.' 
    });
  }
};

// Get Active Official Warnings
exports.getOfficialAlerts = async (req, res) => {
  try {
    marineService.syncMarineBulletins(false).catch(() => {});

    const allBulletins = await marineService.getBulletinsFromDb(null, req.query.layer);
    
    const activeAlerts = allBulletins.filter(b => {
      const w = (b.warning || '').trim().toUpperCase();
      return w && w !== 'NIL' && w !== 'NIL.' && w !== 'NIL AT ALL PORTS' && w !== 'NONE';
    });

    res.json({
      source: 'India Meteorological Department (IMD)',
      count: activeAlerts.length,
      alerts: activeAlerts
    });
  } catch (error) {
    console.error('Get Official Marine Alerts Error:', error);
    res.status(500).json({ 
      error: 'Unable to retrieve the latest IMD marine information.' 
    });
  }
};

// Get Marine Safety Status & Summary
exports.getMarineStatus = async (req, res) => {
  try {
    const { layer, refresh } = req.query;

    if (refresh === 'true' || refresh === '1') {
      await marineService.syncMarineBulletins(true);
    } else {
      marineService.syncMarineBulletins(false).catch(() => {});
    }

    const seaBulletins = await marineService.getBulletinsFromDb('SEA_AREA', layer);
    const coastalBulletins = await marineService.getBulletinsFromDb('COASTAL', layer);

    const allBulletins = [...seaBulletins, ...coastalBulletins];
    const statusEvaluation = marineService.evaluateMarineStatus(allBulletins);

    // Extract unique available layers for frontend dropdown filter
    const allDbBulletins = await marineService.getBulletinsFromDb(null, null);
    const availableLayers = Array.from(new Set(allDbBulletins.map(b => b.layer).filter(Boolean)));

    const activeOfficialWarnings = allBulletins.filter(b => {
      const w = (b.warning || '').trim().toUpperCase();
      return w && w !== 'NIL' && w !== 'NIL.' && w !== 'NIL AT ALL PORTS' && w !== 'NONE';
    });

    const mostRecentRetrievedAt = allBulletins[0]?.retrievedAt || null;

    res.json({
      source: 'India Meteorological Department (IMD)',
      status: statusEvaluation,
      lastUpdated: mostRecentRetrievedAt,
      isStale: false,
      availableLayers,
      activeOfficialWarnings,
      seaBulletins,
      coastalBulletins
    });
  } catch (error) {
    console.error('Get Marine Status Error:', error);
    // Fallback error response per requirements
    res.status(500).json({
      source: 'India Meteorological Department (IMD)',
      status: {
        statusCode: 'INFORMATION_UNAVAILABLE',
        statusText: 'INFORMATION UNAVAILABLE',
        badgeColor: '#94a3b8',
        message: 'Unable to retrieve the latest IMD marine information. Please try again later.'
      },
      error: 'Unable to retrieve the latest IMD marine information.'
    });
  }
};
