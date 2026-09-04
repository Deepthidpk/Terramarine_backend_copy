const { syncMarineBulletins, getBulletinsFromDb, evaluateMarineStatus } = require('../src/services/marineService');
const initMarineDb = require('../src/config/initMarineDb');

async function runTest() {
  console.log('--- Testing IMD Marine Integration ---');
  await initMarineDb();

  console.log('1. Syncing Bulletins from IMD API...');
  const syncRes = await syncMarineBulletins(true);
  console.log('Sync Result:', syncRes);

  console.log('2. Fetching Sea Bulletins from DB...');
  const seaList = await getBulletinsFromDb('SEA_AREA');
  console.log(`Retrieved ${seaList.length} Sea Area bulletins from DB.`);
  if (seaList.length > 0) {
    console.log('Sample Sea Bulletin:', JSON.stringify(seaList[0], null, 2));
  }

  console.log('3. Fetching Coastal Bulletins from DB...');
  const coastalList = await getBulletinsFromDb('COASTAL');
  console.log(`Retrieved ${coastalList.length} Coastal bulletins from DB.`);
  if (coastalList.length > 0) {
    console.log('Sample Coastal Bulletin:', JSON.stringify(coastalList[0], null, 2));
  }

  console.log('4. Evaluating Marine Safety Status...');
  const status = evaluateMarineStatus([...seaList, ...coastalList]);
  console.log('Evaluated Marine Safety Status:', status);

  console.log('--- Test Complete ---');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
