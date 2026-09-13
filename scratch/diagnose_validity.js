const db = require('../src/config/db');
const { parseBulletinValidity, calculateMarineAlert, calculateWeatherAlert } = require('../src/services/marineSafetyEvaluator');

async function test() {
  try {
    const res = await db.query("SELECT * FROM marine_bulletins WHERE layer ILIKE '%south west arabian sea%' ORDER BY retrieved_at DESC LIMIT 1");
    if (res.rows.length === 0) {
      console.log('No row found');
      process.exit(0);
    }
    const b = res.rows[0];
    console.log('Bulletin row:');
    console.log('valid_from:', b.valid_from);
    console.log('source_update_time:', b.source_update_time);
    console.log('observation_date:', b.observation_date);
    console.log('retrieved_at:', b.retrieved_at);
    console.log('Current system date:', new Date().toISOString(), 'Local:', new Date().toString());
    
    const v = parseBulletinValidity({
      validFrom: b.valid_from,
      updateTime: b.source_update_time,
      observationDate: b.observation_date,
      retrievedAt: b.retrieved_at
    });
    console.log('\nParsed validity:', v);
    
    const m = calculateMarineAlert({ seaBulletin: {
      seaCondition: b.sea_condition,
      wind: b.wind,
      warning: b.warning,
      validFrom: b.valid_from,
      updateTime: b.source_update_time,
      observationDate: b.observation_date,
      retrievedAt: b.retrieved_at
    }});
    console.log('\nMarine Alert:', m);
    
    const w = calculateWeatherAlert({ seaBulletin: {
      weather: b.weather,
      visibility: b.visibility,
      warning: b.warning,
      validFrom: b.valid_from,
      updateTime: b.source_update_time,
      observationDate: b.observation_date,
      retrievedAt: b.retrieved_at
    }});
    console.log('\nWeather Alert:', w);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
test();
