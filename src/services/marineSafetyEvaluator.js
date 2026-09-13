/**
 * Marine Safety & Weather Alert Evaluator
 * Deterministic rule-based classification engine for Official IMD data.
 */

/**
 * Format a Date object to a user-friendly string (e.g., "10:00 PM, 13 Sep 2026")
 */
function formatValidUntil(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return 'Next bulletin update';
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour12: true
  };
  return dateObj.toLocaleDateString('en-IN', options);
}

/**
 * Parse bulletin validity and determine expiration status
 */
function parseBulletinValidity(bulletin, currentTime = new Date()) {
  if (!bulletin) {
    return {
      isValid: false,
      isExpired: true,
      validUntil: null,
      formattedValidUntil: 'Information Unavailable',
      sourceTime: null
    };
  }

  const now = currentTime instanceof Date ? currentTime : new Date(currentTime);
  let validUntilDate = null;
  const validFromStr = String(bulletin.validFrom || '').trim();
  const warningStr = String(bulletin.warning || '').trim();
  const updateTimeStr = String(bulletin.updateTime || bulletin.source_update_time || '').trim();
  const obsDateStr = String(bulletin.observationDate || bulletin.observation_date || '').trim();
  const retrievedAtStr = String(bulletin.retrievedAt || bulletin.retrieved_at || '').trim();
  const validityHours = parseInt(bulletin.validityHours || bulletin.validity_hours || 12, 10) || 12;

  // 1. Try to parse "to HH UTC of YYYY-MM-DD" or "to HH UTC of DD-MM-YYYY" from validFrom
  const utcToMatch = validFromStr.match(/to\s+(\d{1,2})\s*UTC\s*of\s*(\d{4}-\d{2}-\d{2})/i) ||
                     validFromStr.match(/to\s+(\d{1,2})\s*UTC\s*of\s*(\d{2}-\d{2}-\d{4})/i);
  if (utcToMatch) {
    const hours = parseInt(utcToMatch[1], 10);
    let datePart = utcToMatch[2];
    if (datePart.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const parts = datePart.split('-');
      datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const d = new Date(`${datePart}T00:00:00.000Z`);
    if (!isNaN(d.getTime())) {
      d.setUTCHours(hours);
      validUntilDate = d;
    }
  }

  // 2. Try to parse "till HH:MM hours on DD-MM-YYYY" or "till HH:MM IST of DD-MM-YYYY" from warning
  if (!validUntilDate) {
    const tillMatch = warningStr.match(/till\s+(\d{1,2}):(\d{2})\s*(?:hours|ist)?\s*(?:on|of)\s*(\d{2}-\d{2}-\d{4})/i) ||
                      warningStr.match(/till\s+(\d{1,2}):(\d{2})\s*(?:hours|ist)?\s*(?:on|of)\s*(\d{4}-\d{2}-\d{2})/i);
    if (tillMatch) {
      const hours = parseInt(tillMatch[1], 10);
      const mins = parseInt(tillMatch[2], 10);
      let datePart = tillMatch[3];
      if (datePart.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const parts = datePart.split('-');
        datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      // Indian Standard Time is UTC+5:30
      const d = new Date(`${datePart}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00.000+05:30`);
      if (!isNaN(d.getTime())) {
        validUntilDate = d;
      }
    }
  }

  // 3. Fallback: Parse from updateTime / obsDate / retrievedAt + validityHours (+ grace period)
  if (!validUntilDate) {
    let baseDate = null;
    if (updateTimeStr) {
      // e.g. "12:09 IST of 2026-09-13"
      const istMatch = updateTimeStr.match(/(\d{1,2}):(\d{2})\s*IST\s*of\s*(\d{4}-\d{2}-\d{2})/i) ||
                       updateTimeStr.match(/(\d{1,2}):(\d{2})\s*IST\s*of\s*(\d{2}-\d{2}-\d{4})/i);
      if (istMatch) {
        const h = parseInt(istMatch[1], 10);
        const m = parseInt(istMatch[2], 10);
        let dt = istMatch[3];
        if (dt.match(/^\d{2}-\d{2}-\d{4}$/)) {
          const parts = dt.split('-');
          dt = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        baseDate = new Date(`${dt}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000+05:30`);
      } else {
        const parsed = new Date(updateTimeStr);
        if (!isNaN(parsed.getTime())) baseDate = parsed;
      }
    }

    if (!baseDate && obsDateStr) {
      baseDate = new Date(`${obsDateStr}T00:00:00.000+05:30`);
    }

    if (!baseDate && retrievedAtStr) {
      const parsed = new Date(retrievedAtStr);
      if (!isNaN(parsed.getTime())) baseDate = parsed;
    }

    if (baseDate && !isNaN(baseDate.getTime())) {
      validUntilDate = new Date(baseDate.getTime() + (validityHours + 12) * 60 * 60 * 1000);
    }
  }

  const isExpired = validUntilDate ? now.getTime() > validUntilDate.getTime() : false;
  const isValid = Boolean(validUntilDate && !isExpired);

  return {
    isValid,
    isExpired,
    validUntil: validUntilDate ? validUntilDate.toISOString() : null,
    formattedValidUntil: validUntilDate ? formatValidUntil(validUntilDate) : 'Valid for current cycle',
    sourceTime: updateTimeStr || obsDateStr || retrievedAtStr || null
  };
}

/**
 * Checks if a specific warning/advisory text applies to the fisherman's registered location.
 */
function isWarningApplicableToLocation(warningText, location = {}, coverage = {}) {
  if (!warningText) return false;
  const w = warningText.trim().toUpperCase();
  if (!w || w === 'NIL' || w === 'NIL.' || w === 'NIL AT ALL PORTS' || w === 'NONE' || w === 'NO WARNING') {
    return false;
  }

  const district = (location.district || '').trim().toUpperCase();
  const coastalArea = (location.coastalArea || location.coastal_area || '').trim().toUpperCase();
  const municipality = (location.municipality || '').trim().toUpperCase();
  const state = (location.state || coverage.state || 'KERALA').trim().toUpperCase();
  const region = (coverage.region || '').trim().toUpperCase();

  // 1. Lakshadweep-specific isolation
  const lakshadweepIslands = ['AGATTI', 'AMINI', 'ANDROTH', 'KAVARATTI', 'KAVARATHI', 'MINICOY', 'KALPENI', 'CHETLAT', 'BITRA', 'KILTAN', 'KADMAT', 'LAKSHADWEEP'];
  const mentionsLakshadweep = lakshadweepIslands.some(isl => w.includes(isl));
  
  // If user is in Kerala and warning is ONLY for Lakshadweep islands
  const isKeralaUser = state.includes('KERALA') || district.includes('MALAPPURAM') || district.includes('KOZHIKODE') || district.includes('KANNUR') || district.includes('KASARAGOD') || district.includes('ERNAKULAM');
  const mentionsKeralaDirectly = w.includes('KERALA') || w.includes('MALAPPURAM') || w.includes('KASARAGOD') || w.includes('KANNUR') || w.includes('KOZHIKODE') || w.includes('KOZHIKKODE') || w.includes('PONNANI');

  if (isKeralaUser && mentionsLakshadweep && !mentionsKeralaDirectly) {
    return false; // Lakshadweep warning does not apply to Kerala
  }

  // 2. North Kerala vs South Kerala isolation
  const isNorthKerala = region.includes('NORTH KERALA') || ['MALAPPURAM', 'KASARAGOD', 'KASARGOD', 'KANNUR', 'KOZHIKODE', 'KOZHIKKODE', 'THRISSUR'].some(d => district.includes(d));
  const southKeralaPlaces = ['THIRUVANANTHAPURAM', 'TRIVANDRUM', 'VIZHINJAM', 'KOLLAM', 'QUILON', 'ALAPPUZHA', 'ALLEPPEY', 'SOUTH KERALA COAST', 'SOUTH COAST OF KERALA'];
  const northKeralaPlaces = ['MALAPPURAM', 'PONNANI', 'KASARAGOD', 'KASARGOD', 'KANNUR', 'KOZHIKODE', 'KOZHIKKODE', 'BEYPORE', 'NORTH KERALA COAST', 'NORTH COAST OF KERALA'];

  const hasGenericKeralaCoast = (w.includes('KERALA COAST') && !w.includes('SOUTH KERALA COAST') && !w.includes('NORTH KERALA COAST')) ||
                                w.includes('ALL OF KERALA') ||
                                w.includes('ENTIRE KERALA') ||
                                w.includes('ALL COASTS OF KERALA');

  const mentionsSouthOnly = southKeralaPlaces.some(p => w.includes(p)) && !northKeralaPlaces.some(p => w.includes(p)) && !hasGenericKeralaCoast;
  if (isNorthKerala && mentionsSouthOnly) {
    return false; // South Kerala specific warning does not apply to North Kerala
  }

  const isSouthKerala = region.includes('SOUTH KERALA') || ['ERNAKULAM', 'ALAPPUZHA', 'KOLLAM', 'THIRUVANANTHAPURAM'].some(d => district.includes(d));
  const mentionsNorthOnly = northKeralaPlaces.some(p => w.includes(p)) && !southKeralaPlaces.some(p => w.includes(p)) && !hasGenericKeralaCoast;
  if (isSouthKerala && mentionsNorthOnly) {
    return false; // North Kerala specific warning does not apply to South Kerala
  }

  // 3. District & Coastal Area direct match
  if (district && w.includes(district)) return true;
  if (coastalArea && w.includes(coastalArea)) return true;
  if (municipality && w.includes(municipality)) return true;

  // 4. Region or State wide match
  if (region && w.includes(region)) return true;
  if (state && w.includes(state)) return true;

  // If warning does not restrict to specific other regions, consider it applicable to the bulletin layer
  return true;
}

/**
 * Calculates Marine Alert (GREEN | YELLOW | RED | UNAVAILABLE)
 */
function calculateMarineAlert({ coastalBulletin, seaBulletin, portWarning, location = {}, coverage = {}, currentTime = new Date() }) {
  // Find the primary valid bulletin
  const coastalValidity = coastalBulletin ? parseBulletinValidity(coastalBulletin, currentTime) : { isValid: false };
  const seaValidity = seaBulletin ? parseBulletinValidity(seaBulletin, currentTime) : { isValid: false };

  const validCoastal = coastalBulletin && coastalValidity.isValid ? coastalBulletin : null;
  const validSea = seaBulletin && seaValidity.isValid ? seaBulletin : null;

  if (!validCoastal && !validSea) {
    return {
      level: 'UNAVAILABLE',
      label: 'DATA UNAVAILABLE',
      badgeColor: '#94a3b8',
      reason: 'Current official marine information could not be verified.',
      subtext: 'No valid official IMD marine bulletin found for your registered area.',
      source: 'India Meteorological Department (IMD)',
      validUntil: null,
      formattedValidUntil: 'Unavailable',
      isExpired: Boolean(coastalValidity.isExpired || seaValidity.isExpired)
    };
  }

  const primaryBulletin = validCoastal || validSea;
  const validity = validCoastal ? coastalValidity : seaValidity;

  const seaCondStr = String(primaryBulletin.seaCondition || validSea?.seaCondition || validCoastal?.seaCondition || '').trim().toLowerCase();
  const windStr = String(primaryBulletin.wind || validSea?.wind || validCoastal?.wind || '').trim().toLowerCase();
  const coastalWarn = String(validCoastal?.warning || '').trim();
  const seaWarn = String(validSea?.warning || '').trim();
  const portWarn = String(portWarning?.warning || portWarning?.signal || '').trim();

  const isCoastalWarnApplicable = isWarningApplicableToLocation(coastalWarn, location, coverage);
  const isSeaWarnApplicable = isWarningApplicableToLocation(seaWarn, location, coverage);
  const isPortWarnApplicable = isWarningApplicableToLocation(portWarn, location, coverage);

  const activeMarineWarnings = [];
  if (isCoastalWarnApplicable && coastalWarn && coastalWarn.toUpperCase() !== 'NIL') activeMarineWarnings.push(coastalWarn);
  if (isSeaWarnApplicable && seaWarn && seaWarn.toUpperCase() !== 'NIL') activeMarineWarnings.push(seaWarn);
  if (isPortWarnApplicable && portWarn && portWarn.toUpperCase() !== 'NIL') activeMarineWarnings.push(portWarn);

  const combinedWarnText = activeMarineWarnings.join(' ').toLowerCase();

  // Extract wind speed
  const windMatch = windStr.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*knots?/i);
  const maxWindSpeed = windMatch ? parseInt(windMatch[2], 10) : 0;
  const gustMatch = windStr.match(/gusting\s*(?:to|-)?\s*(\d+)\s*knots?/i);
  const gustSpeed = gustMatch ? parseInt(gustMatch[1], 10) : 0;

  // ----------------------------------------------------
  // 1. RED MARINE ALERT (DO NOT GO TO SEA)
  // ----------------------------------------------------
  const isRedWarning = combinedWarnText.includes('do not venture') ||
                       combinedWarnText.includes('fishermen are advised not to venture') ||
                       combinedWarnText.includes('gale') ||
                       combinedWarnText.includes('cyclonic') ||
                       combinedWarnText.includes('cyclone') ||
                       combinedWarnText.includes('very rough') ||
                       combinedWarnText.includes('high seas') ||
                       combinedWarnText.includes('phenomenal') ||
                       combinedWarnText.includes('dangerous sea') ||
                       combinedWarnText.includes('storm surge warning') ||
                       combinedWarnText.includes('great danger') ||
                       combinedWarnText.includes('red alert');

  const isRedSeaCondition = seaCondStr.includes('rough') && !seaCondStr.includes('slight to moderate') && !seaCondStr.includes('moderate to rough') ||
                            seaCondStr.includes('very rough') ||
                            seaCondStr.includes('high') ||
                            seaCondStr.includes('very high') ||
                            seaCondStr.includes('phenomenal');

  const isRedWind = maxWindSpeed > 25 || gustSpeed > 30 || windStr.includes('gale') || windStr.includes('squall force');

  const isRedPort = portWarn.toLowerCase().includes('signal iii') ||
                    portWarn.toLowerCase().includes('signal iv') ||
                    portWarn.toLowerCase().includes('signal v') ||
                    portWarn.toLowerCase().includes('signal vi') ||
                    portWarn.toLowerCase().includes('signal vii') ||
                    portWarn.toLowerCase().includes('signal viii') ||
                    portWarn.toLowerCase().includes('danger');

  if (isRedWarning || isRedSeaCondition || isRedWind || isRedPort) {
    let redReason = 'Official IMD warning indicates dangerous sea conditions.';
    if (isRedWarning && activeMarineWarnings.length > 0) {
      redReason = activeMarineWarnings[0];
    } else if (isRedSeaCondition) {
      redReason = `Dangerous sea condition reported by IMD: ${primaryBulletin.seaCondition || 'Rough'}.`;
    } else if (isRedWind) {
      redReason = `High marine wind hazard reported by IMD (${primaryBulletin.wind}).`;
    }

    return {
      level: 'RED',
      label: 'DO NOT GO TO SEA',
      badgeColor: '#ef4444',
      reason: redReason,
      subtext: 'High hazard official IMD marine warning active for your zone.',
      source: 'India Meteorological Department (IMD)',
      validUntil: validity.validUntil,
      formattedValidUntil: validity.formattedValidUntil,
      details: {
        seaCondition: primaryBulletin.seaCondition || 'N/A',
        wind: primaryBulletin.wind || 'N/A',
        portSignal: primaryBulletin.portSignal || portWarning?.signal || 'NIL'
      }
    };
  }

  // ----------------------------------------------------
  // 2. YELLOW MARINE ALERT (CAUTION)
  // ----------------------------------------------------
  const isYellowWarning = combinedWarnText.includes('swell surge') ||
                          combinedWarnText.includes('wave alert') ||
                          combinedWarnText.includes('caution') ||
                          combinedWarnText.includes('vigilance') ||
                          combinedWarnText.includes('advisory') ||
                          combinedWarnText.includes('moderate hazard');

  const isYellowSeaCondition = seaCondStr.includes('moderate') ||
                               seaCondStr.includes('slight to moderate') ||
                               seaCondStr.includes('moderate to rough');

  const isYellowWind = (maxWindSpeed >= 15 && maxWindSpeed <= 25) || gustSpeed >= 20;

  const isYellowPort = portWarn && portWarn.toUpperCase() !== 'NIL' && !isRedPort;

  if (isYellowWarning || isYellowSeaCondition || isYellowWind || isYellowPort) {
    let yellowReason = 'Moderate sea conditions reported by IMD.';
    if (isYellowWarning && activeMarineWarnings.length > 0) {
      yellowReason = activeMarineWarnings[0];
    } else if (isYellowSeaCondition) {
      yellowReason = `Moderate sea conditions reported by IMD (${primaryBulletin.seaCondition || 'Moderate'}).`;
    } else if (isYellowWind) {
      yellowReason = `Moderate marine wind reported by IMD (${primaryBulletin.wind}).`;
    }

    return {
      level: 'YELLOW',
      label: 'CAUTION',
      badgeColor: '#f59e0b',
      reason: yellowReason,
      subtext: 'Moderate marine conditions reported. Exercise caution at sea.',
      source: 'India Meteorological Department (IMD)',
      validUntil: validity.validUntil,
      formattedValidUntil: validity.formattedValidUntil,
      details: {
        seaCondition: primaryBulletin.seaCondition || 'N/A',
        wind: primaryBulletin.wind || 'N/A',
        portSignal: primaryBulletin.portSignal || portWarning?.signal || 'NIL'
      }
    };
  }

  // ----------------------------------------------------
  // 3. GREEN MARINE ALERT (SAFE TO GO TO SEA)
  // ----------------------------------------------------
  return {
    level: 'GREEN',
    label: 'SAFE TO GO TO SEA',
    badgeColor: '#22c55e',
    reason: 'No significant official marine hazard detected for your registered area.',
    subtext: 'No significant official marine hazard detected for your registered area.',
    source: 'India Meteorological Department (IMD)',
    validUntil: validity.validUntil,
    formattedValidUntil: validity.formattedValidUntil,
    details: {
      seaCondition: primaryBulletin.seaCondition || 'Calm / Slight',
      wind: primaryBulletin.wind || 'Light',
      portSignal: primaryBulletin.portSignal || 'NIL'
    }
  };
}

/**
 * Calculates Weather Alert (GREEN | YELLOW | RED | UNAVAILABLE)
 */
function calculateWeatherAlert({ coastalBulletin, seaBulletin, location = {}, coverage = {}, currentTime = new Date() }) {
  const coastalValidity = coastalBulletin ? parseBulletinValidity(coastalBulletin, currentTime) : { isValid: false };
  const seaValidity = seaBulletin ? parseBulletinValidity(seaBulletin, currentTime) : { isValid: false };

  const validCoastal = coastalBulletin && coastalValidity.isValid ? coastalBulletin : null;
  const validSea = seaBulletin && seaValidity.isValid ? seaBulletin : null;

  if (!validCoastal && !validSea) {
    return {
      level: 'UNAVAILABLE',
      label: 'DATA UNAVAILABLE',
      badgeColor: '#94a3b8',
      reason: 'Current official weather information could not be verified.',
      subtext: 'No valid official IMD weather forecast available for your registered area.',
      source: 'India Meteorological Department (IMD)',
      validUntil: null,
      formattedValidUntil: 'Unavailable',
      isExpired: Boolean(coastalValidity.isExpired || seaValidity.isExpired)
    };
  }

  const primaryBulletin = validCoastal || validSea;
  const validity = validCoastal ? coastalValidity : seaValidity;

  const weatherStr = String(primaryBulletin.weather || validSea?.weather || validCoastal?.weather || '').trim().toLowerCase();
  const visibilityStr = String(primaryBulletin.visibility || validSea?.visibility || validCoastal?.visibility || '').trim().toLowerCase();
  const coastalWarn = String(validCoastal?.warning || '').trim();
  const seaWarn = String(validSea?.warning || '').trim();

  const isCoastalWarnApplicable = isWarningApplicableToLocation(coastalWarn, location, coverage);
  const isSeaWarnApplicable = isWarningApplicableToLocation(seaWarn, location, coverage);

  const activeWeatherWarnings = [];
  if (isCoastalWarnApplicable && coastalWarn && coastalWarn.toUpperCase() !== 'NIL') activeWeatherWarnings.push(coastalWarn);
  if (isSeaWarnApplicable && seaWarn && seaWarn.toUpperCase() !== 'NIL') activeWeatherWarnings.push(seaWarn);

  const combinedWarnText = activeWeatherWarnings.join(' ').toLowerCase();

  // ----------------------------------------------------
  // 1. RED WEATHER ALERT (DO NOT GO TO SEA)
  // ----------------------------------------------------
  const isRedWeatherWarning = combinedWarnText.includes('severe thunderstorm') ||
                              combinedWarnText.includes('violent squall') ||
                              combinedWarnText.includes('cyclone') ||
                              combinedWarnText.includes('cyclonic weather') ||
                              combinedWarnText.includes('depression') ||
                              combinedWarnText.includes('extremely heavy rain') ||
                              combinedWarnText.includes('very heavy rain and squall') ||
                              combinedWarnText.includes('severe weather warning');

  const isRedWeather = weatherStr.includes('violent thunderstorm') ||
                       weatherStr.includes('severe squall') ||
                       weatherStr.includes('cyclonic storm') ||
                       weatherStr.includes('extremely heavy');

  const isRedVisibility = visibilityStr.includes('very poor') && (weatherStr.includes('storm') || weatherStr.includes('heavy'));

  if (isRedWeatherWarning || isRedWeather || isRedVisibility) {
    let redReason = 'Official IMD warning indicates severe weather conditions.';
    if (isRedWeatherWarning && activeWeatherWarnings.length > 0) {
      redReason = activeWeatherWarnings[0];
    } else if (isRedWeather) {
      redReason = `Severe weather reported by IMD: ${primaryBulletin.weather}.`;
    } else if (isRedVisibility) {
      redReason = 'Very poor visibility due to severe weather storm reported by IMD.';
    }

    return {
      level: 'RED',
      label: 'DO NOT GO TO SEA',
      badgeColor: '#ef4444',
      reason: redReason,
      subtext: 'Severe official weather hazard affecting your fishing zone.',
      source: 'India Meteorological Department (IMD)',
      validUntil: validity.validUntil,
      formattedValidUntil: validity.formattedValidUntil,
      details: {
        weather: primaryBulletin.weather || 'N/A',
        visibility: primaryBulletin.visibility || 'N/A'
      }
    };
  }

  // ----------------------------------------------------
  // 2. YELLOW WEATHER ALERT (CAUTION)
  // ----------------------------------------------------
  const isYellowWeather = weatherStr.includes('thunder') ||
                          weatherStr.includes('squall') ||
                          weatherStr.includes('rain') ||
                          weatherStr.includes('shower') ||
                          weatherStr.includes('scattered rain') ||
                          weatherStr.includes('widespread rain') ||
                          weatherStr.includes('fairly widespread');

  const isYellowVisibility = visibilityStr.includes('poor') ||
                             visibilityStr.includes('moderate becoming poor') ||
                             visibilityStr.includes('moderate');

  if (isYellowWeather || isYellowVisibility) {
    let yellowReason = 'Thunderstorm / rain conditions reported by IMD.';
    if (weatherStr.includes('thunder') || weatherStr.includes('squall')) {
      yellowReason = `Thunderstorm / squall conditions reported by IMD (${primaryBulletin.weather}).`;
    } else if (weatherStr.includes('rain') || weatherStr.includes('shower')) {
      yellowReason = `Rain / shower conditions reported by IMD (${primaryBulletin.weather}).`;
    } else if (isYellowVisibility) {
      yellowReason = `Reduced visibility reported by IMD (${primaryBulletin.visibility}).`;
    }

    return {
      level: 'YELLOW',
      label: 'CAUTION',
      badgeColor: '#f59e0b',
      reason: yellowReason,
      subtext: 'Rain or thunderstorm conditions present. Proceed with caution.',
      source: 'India Meteorological Department (IMD)',
      validUntil: validity.validUntil,
      formattedValidUntil: validity.formattedValidUntil,
      details: {
        weather: primaryBulletin.weather || 'N/A',
        visibility: primaryBulletin.visibility || 'N/A'
      }
    };
  }

  // ----------------------------------------------------
  // 3. GREEN WEATHER ALERT (SAFE TO GO TO SEA)
  // ----------------------------------------------------
  return {
    level: 'GREEN',
    label: 'SAFE TO GO TO SEA',
    badgeColor: '#22c55e',
    reason: 'No significant official weather hazard detected for your registered area.',
    subtext: 'No significant official weather hazard detected for your registered area.',
    source: 'India Meteorological Department (IMD)',
    validUntil: validity.validUntil,
    formattedValidUntil: validity.formattedValidUntil,
    details: {
      weather: primaryBulletin.weather || 'Clear Skies / Fair',
      visibility: primaryBulletin.visibility || 'Good Visibility'
    }
  };
}

/**
 * Calculates Overall Safety Status based on Marine and Weather alerts
 * Priority: RED > YELLOW > GREEN > UNAVAILABLE
 */
function calculateOverallSafety(marineAlert, weatherAlert) {
  const mLevel = marineAlert?.level || 'UNAVAILABLE';
  const wLevel = weatherAlert?.level || 'UNAVAILABLE';

  // 1. RED OVERALL (DO NOT GO TO SEA)
  if (mLevel === 'RED' || wLevel === 'RED') {
    return {
      level: 'RED',
      title: 'DO NOT GO TO SEA',
      badgeColor: '#ef4444',
      message: 'Dangerous official conditions detected. Fishermen are strongly advised not to venture out to sea.'
    };
  }

  // 2. YELLOW OVERALL (PROCEED WITH CAUTION)
  if (mLevel === 'YELLOW' || wLevel === 'YELLOW') {
    return {
      level: 'YELLOW',
      title: 'PROCEED WITH CAUTION',
      badgeColor: '#f59e0b',
      message: 'Advisory or moderate conditions reported by IMD. Exercise vigilance and safety precautions.'
    };
  }

  // 3. GREEN OVERALL (NO SIGNIFICANT OFFICIAL HAZARD)
  if (mLevel === 'GREEN' && wLevel === 'GREEN') {
    return {
      level: 'GREEN',
      title: 'NO SIGNIFICANT OFFICIAL HAZARD',
      badgeColor: '#22c55e',
      message: 'Safe conditions reported by IMD for your registered fishing zone.'
    };
  }

  // 4. INFORMATION UNAVAILABLE
  return {
    level: 'UNAVAILABLE',
    title: 'INFORMATION UNAVAILABLE',
    badgeColor: '#94a3b8',
    message: 'Current official marine/weather information could not be verified. Check official VHF/coastal broadcasts.'
  };
}

module.exports = {
  formatValidUntil,
  parseBulletinValidity,
  isWarningApplicableToLocation,
  calculateMarineAlert,
  calculateWeatherAlert,
  calculateOverallSafety
};
