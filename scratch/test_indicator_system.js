const assert = require('assert');
const {
  parseBulletinValidity,
  isWarningApplicableToLocation,
  calculateMarineAlert,
  calculateWeatherAlert,
  calculateOverallSafety
} = require('../src/services/marineSafetyEvaluator');
const { resolveImdCoverage } = require('../src/services/imdCoverageService');

console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE 12 TEST SUITE FOR ALERTS');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 12;

const ponnaniLocation = {
  state: 'Kerala',
  district: 'Malappuram',
  municipality: 'Ponnani Municipality',
  coastalArea: 'Ponnani Light House & Harbour'
};
const ponnaniCoverage = resolveImdCoverage('Kerala', 'Malappuram', 'Ponnani Municipality', 'Ponnani Light House & Harbour');
const mockTime = new Date('2026-09-13T15:00:00.000Z');

// ----------------------------------------------------
// TEST 1: No official warning + normal conditions
// Expected: Marine = GREEN, Weather = GREEN, Overall = GREEN
// ----------------------------------------------------
try {
  const normalCoastal = {
    validFrom: 'Bulletin Valid for 12 hrs from 10 UTC of 2026-09-13 to 22 UTC of 2026-09-13',
    warning: 'NIL',
    wind: 'Northerly 05-10 knots',
    seaCondition: 'Calm to Slight',
    weather: 'Mainly Dry / Clear Skies',
    visibility: 'Good Visibility'
  };
  const marine = calculateMarineAlert({ coastalBulletin: normalCoastal, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: mockTime });
  const weather = calculateWeatherAlert({ coastalBulletin: normalCoastal, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: mockTime });
  const overall = calculateOverallSafety(marine, weather);

  assert.strictEqual(marine.level, 'GREEN', 'Test 1 Marine must be GREEN');
  assert.strictEqual(weather.level, 'GREEN', 'Test 1 Weather must be GREEN');
  assert.strictEqual(overall.level, 'GREEN', 'Test 1 Overall must be GREEN');
  console.log('✅ TEST 1 PASSED: Normal conditions produce Marine GREEN, Weather GREEN, Overall GREEN');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 1 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 2: Moderate marine condition / caution
// Expected: Marine = YELLOW
// ----------------------------------------------------
try {
  const moderateCoastal = {
    validFrom: 'Bulletin Valid for 12 hrs from 10 UTC of 2026-09-13 to 22 UTC of 2026-09-13',
    warning: 'NIL',
    wind: 'Northwesterly 15-20 knots',
    seaCondition: 'Moderate',
    weather: 'Clear Skies',
    visibility: 'Good'
  };
  const marine = calculateMarineAlert({ coastalBulletin: moderateCoastal, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: mockTime });
  assert.strictEqual(marine.level, 'YELLOW', 'Test 2 Marine must be YELLOW');
  assert.strictEqual(marine.label, 'CAUTION');
  console.log('✅ TEST 2 PASSED: Moderate marine condition produces Marine YELLOW (Caution)');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 2 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 3: Thunderstorm/rain requiring caution
// Expected: Weather = YELLOW
// ----------------------------------------------------
try {
  const rainCoastal = {
    validFrom: 'Bulletin Valid for 12 hrs from 10 UTC of 2026-09-13 to 22 UTC of 2026-09-13',
    warning: 'NIL',
    wind: 'Light',
    seaCondition: 'Smooth',
    weather: 'Scattered Rain / Thunderstorm',
    visibility: 'Moderate becoming poor in rain'
  };
  const weather = calculateWeatherAlert({ coastalBulletin: rainCoastal, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: mockTime });
  assert.strictEqual(weather.level, 'YELLOW', 'Test 3 Weather must be YELLOW');
  assert.strictEqual(weather.label, 'CAUTION');
  console.log('✅ TEST 3 PASSED: Thunderstorm / rain produces Weather YELLOW (Caution)');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 3 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 4: Official serious marine warning
// Expected: Marine = RED, Overall = RED ("DO NOT GO TO SEA")
// ----------------------------------------------------
try {
  const roughMarine = {
    validFrom: 'Bulletin Valid for 12 hrs from 10 UTC of 2026-09-13 to 22 UTC of 2026-09-13',
    warning: 'DANGEROUS SEA CONDITIONS. FISHERMEN ARE ADVISED NOT TO VENTURE INTO SEA ALONG KERALA COAST',
    wind: 'GALE FORCE 35 KNOTS',
    seaCondition: 'Rough to Very Rough',
    weather: 'Partly Cloudy',
    visibility: 'Good'
  };
  const marine = calculateMarineAlert({ coastalBulletin: roughMarine, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: mockTime });
  const weather = calculateWeatherAlert({ coastalBulletin: roughMarine, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: mockTime });
  const overall = calculateOverallSafety(marine, weather);

  assert.strictEqual(marine.level, 'RED', 'Test 4 Marine must be RED');
  assert.strictEqual(overall.level, 'RED', 'Test 4 Overall must be RED');
  assert.strictEqual(overall.title, 'DO NOT GO TO SEA');
  console.log('✅ TEST 4 PASSED: Severe marine hazard produces Marine RED and Overall RED (DO NOT GO TO SEA)');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 4 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 5: Official severe weather warning
// Expected: Weather = RED, Overall = RED ("DO NOT GO TO SEA")
// ----------------------------------------------------
try {
  const severeWeather = {
    validFrom: 'Bulletin Valid for 12 hrs from 10 UTC of 2026-09-13 to 22 UTC of 2026-09-13',
    warning: 'SEVERE CYCLONIC STORM AND SQUALLY WEATHER OVER KERALA COAST. FISHERMEN DO NOT VENTURE OUT',
    wind: 'Northwesterly 10 knots',
    seaCondition: 'Calm',
    weather: 'Severe Thunderstorm / Cyclonic Storm with Extremely Heavy Rain',
    visibility: 'Very Poor'
  };
  const weather = calculateWeatherAlert({ coastalBulletin: severeWeather, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: mockTime });
  const marine = calculateMarineAlert({ coastalBulletin: severeWeather, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: mockTime });
  const overall = calculateOverallSafety(marine, weather);

  assert.strictEqual(weather.level, 'RED', 'Test 5 Weather must be RED');
  assert.strictEqual(overall.level, 'RED', 'Test 5 Overall must be RED');
  console.log('✅ TEST 5 PASSED: Severe weather hazard produces Weather RED and Overall RED (DO NOT GO TO SEA)');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 5 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 6: Marine GREEN + Weather RED
// Expected: Marine = GREEN, Weather = RED, Overall = RED
// ----------------------------------------------------
try {
  const marineObj = { level: 'GREEN', label: 'SAFE TO GO TO SEA' };
  const weatherObj = { level: 'RED', label: 'DO NOT GO TO SEA' };
  const overall = calculateOverallSafety(marineObj, weatherObj);

  assert.strictEqual(overall.level, 'RED', 'Test 6 Overall must be RED when Weather is RED');
  assert.strictEqual(overall.title, 'DO NOT GO TO SEA');
  console.log('✅ TEST 6 PASSED: Marine GREEN + Weather RED produces Overall RED (DO NOT GO TO SEA)');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 6 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 7: Marine RED + Weather GREEN
// Expected: Marine = RED, Weather = GREEN, Overall = RED
// ----------------------------------------------------
try {
  const marineObj = { level: 'RED', label: 'DO NOT GO TO SEA' };
  const weatherObj = { level: 'GREEN', label: 'SAFE TO GO TO SEA' };
  const overall = calculateOverallSafety(marineObj, weatherObj);

  assert.strictEqual(overall.level, 'RED', 'Test 7 Overall must be RED when Marine is RED');
  assert.strictEqual(overall.title, 'DO NOT GO TO SEA');
  console.log('✅ TEST 7 PASSED: Marine RED + Weather GREEN produces Overall RED (DO NOT GO TO SEA)');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 7 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 8: IMD API unavailable / failure
// Expected: Marine = DATA UNAVAILABLE, Weather = DATA UNAVAILABLE (NOT GREEN)
// ----------------------------------------------------
try {
  const marine = calculateMarineAlert({ coastalBulletin: null, seaBulletin: null, location: ponnaniLocation, coverage: ponnaniCoverage });
  const weather = calculateWeatherAlert({ coastalBulletin: null, seaBulletin: null, location: ponnaniLocation, coverage: ponnaniCoverage });
  const overall = calculateOverallSafety(marine, weather);

  assert.strictEqual(marine.level, 'UNAVAILABLE', 'Test 8 Marine must be UNAVAILABLE');
  assert.strictEqual(weather.level, 'UNAVAILABLE', 'Test 8 Weather must be UNAVAILABLE');
  assert.notStrictEqual(marine.level, 'GREEN', 'Test 8 Marine must NEVER be GREEN on missing data');
  assert.strictEqual(overall.level, 'UNAVAILABLE', 'Test 8 Overall must be UNAVAILABLE');
  console.log('✅ TEST 8 PASSED: Missing API / bulletin data produces DATA UNAVAILABLE (Never False Green)');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 8 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 9: Expired bulletin
// Expected: Expired bulletin is rejected from active alert
// ----------------------------------------------------
try {
  const checkTime = new Date('2026-09-13T12:00:00.000Z');
  const expiredBulletin = {
    validFrom: 'Bulletin Valid for 12 hrs from 10 UTC of 2026-09-09 to 22 UTC of 2026-09-09',
    observationDate: '2026-09-09',
    updateTime: '20:30 IST of 2026-09-09',
    warning: 'DANGEROUS GALE WARNING',
    seaCondition: 'Rough',
    weather: 'Squall'
  };

  const validity = parseBulletinValidity(expiredBulletin, checkTime);
  assert.strictEqual(validity.isValid, false, 'Expired bulletin validity must be false');
  assert.strictEqual(validity.isExpired, true, 'Expired bulletin isExpired must be true');

  const marine = calculateMarineAlert({ coastalBulletin: expiredBulletin, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: checkTime });
  assert.strictEqual(marine.level, 'UNAVAILABLE', 'Expired bulletin must produce UNAVAILABLE rather than stale alert');
  console.log('✅ TEST 9 PASSED: Expired bulletin is properly identified and rejected from active safety indicators');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 9 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 10: Lakshadweep warning but Ponnani fisherman
// Expected: Do NOT show the Lakshadweep warning for Ponnani
// ----------------------------------------------------
try {
  const lakshadweepWarning = 'SWELL SURGE ALERT FOR THE COAST OF AGATTI, AMINI, ANDROTH, KAVARATTI, MINICOY, LAKSHADWEEP.';
  const isApp = isWarningApplicableToLocation(lakshadweepWarning, ponnaniLocation, ponnaniCoverage);
  assert.strictEqual(isApp, false, 'Lakshadweep warning must not apply to Ponnani');

  const coastalWithLakshadweepWarn = {
    validFrom: 'Bulletin Valid for 12 hrs from 10 UTC of 2026-09-13 to 22 UTC of 2026-09-13',
    warning: lakshadweepWarning,
    wind: 'Light 5 knots',
    seaCondition: 'Calm',
    weather: 'Clear Skies',
    visibility: 'Good'
  };

  const marine = calculateMarineAlert({ coastalBulletin: coastalWithLakshadweepWarn, location: ponnaniLocation, coverage: ponnaniCoverage, currentTime: mockTime });
  assert.strictEqual(marine.level, 'GREEN', 'Ponnani must remain GREEN when warning is only for Lakshadweep');
  console.log('✅ TEST 10 PASSED: Lakshadweep warning is successfully isolated and not applied to Ponnani fisherman');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 10 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 11: South Kerala warning but Ponnani fisherman
// Expected: Do NOT show South Kerala warning unless explicitly covering North Kerala/Malappuram
// ----------------------------------------------------
try {
  const southKeralaWarning = 'HIGH WAVE ALERT FOR SOUTH KERALA COAST: THIRUVANANTHAPURAM, VIZHINJAM, KOLLAM, ALAPPUZHA.';
  const isApp = isWarningApplicableToLocation(southKeralaWarning, ponnaniLocation, ponnaniCoverage);
  assert.strictEqual(isApp, false, 'South Kerala specific warning must not apply to Ponnani (North Kerala)');

  const northKeralaWarning = 'SWELL SURGE ALERT FOR NORTH KERALA: KASARAGOD, KANNUR, KOZHIKKODE, MALAPPURAM.';
  const isAppNorth = isWarningApplicableToLocation(northKeralaWarning, ponnaniLocation, ponnaniCoverage);
  assert.strictEqual(isAppNorth, true, 'North Kerala warning covering Malappuram must apply to Ponnani');

  console.log('✅ TEST 11 PASSED: South Kerala warning is isolated and North Kerala warning is matched to Ponnani');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 11 FAILED:', e.message);
}

// ----------------------------------------------------
// TEST 12: Fisherman changes location
// Expected: Indicators recalculate based on the new location
// ----------------------------------------------------
try {
  const vizhinjamLocation = {
    state: 'Kerala',
    district: 'Thiruvananthapuram',
    municipality: 'Trivandrum Corporation',
    coastalArea: 'Vizhinjam Fishing Harbour'
  };
  const vizhinjamCoverage = resolveImdCoverage('Kerala', 'Thiruvananthapuram', 'Trivandrum Corporation', 'Vizhinjam Fishing Harbour');
  assert.strictEqual(vizhinjamCoverage.region, 'South Kerala Coast');

  const southKeralaWarning = 'HIGH WAVE ALERT FOR SOUTH KERALA COAST: THIRUVANANTHAPURAM, VIZHINJAM, KOLLAM.';
  const isAppSouth = isWarningApplicableToLocation(southKeralaWarning, vizhinjamLocation, vizhinjamCoverage);
  assert.strictEqual(isAppSouth, true, 'South Kerala warning must apply to Vizhinjam fisherman');

  const coastalForSouth = {
    validFrom: 'Bulletin Valid for 12 hrs from 10 UTC of 2026-09-13 to 22 UTC of 2026-09-13',
    warning: southKeralaWarning,
    wind: 'Northwesterly 15 knots',
    seaCondition: 'Moderate',
    weather: 'Clear',
    visibility: 'Good'
  };
  const marineSouth = calculateMarineAlert({ coastalBulletin: coastalForSouth, location: vizhinjamLocation, coverage: vizhinjamCoverage, currentTime: mockTime });
  assert.strictEqual(marineSouth.level, 'YELLOW', 'Vizhinjam must receive Yellow advisory due to wave alert');

  console.log('✅ TEST 12 PASSED: Registered location change properly recalculates indicators for new location');
  passedTests++;
} catch (e) {
  console.error('❌ TEST 12 FAILED:', e.message);
}

console.log(`\n====================================================`);
console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log(`====================================================\n`);
