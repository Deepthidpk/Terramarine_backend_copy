const db = require('../src/config/db');
const marineService = require('../src/services/marineService');

async function test() {
  try {
    const userRes = await db.query("SELECT * FROM users WHERE email = 'deepak@gmail.com' LIMIT 1");
    const u = userRes.rows[0];
    const data = await marineService.getRelevantAlertsForFisherman(u);
    console.log('SUCCESS:', data);
    process.exit(0);
  } catch (err) {
    console.error('ERROR TRACE:', err);
    process.exit(1);
  }
}
test();
