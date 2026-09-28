const db = require('../src/config/db');

async function checkKerala() {
  try {
    const res = await db.query(
      `SELECT * FROM marine_bulletins WHERE layer ILIKE '%kerala%' OR layer ILIKE '%lakshadweep%' OR issued_by ILIKE '%thiruvananthapuram%'`
    );
    console.log(`Found ${res.rows.length} Kerala / South Coast bulletins:`);
    res.rows.forEach(r => {
      console.log('---');
      console.log('ID:', r.id);
      console.log('Type:', r.bulletin_type);
      console.log('Layer:', r.layer);
      console.log('Issued By:', r.issued_by);
      console.log('Wind:', r.wind);
      console.log('Weather:', r.weather);
      console.log('Sea Condition:', r.sea_condition);
      console.log('Visibility:', r.visibility);
      console.log('Port Signal:', r.port_signal);
      console.log('Warning:', r.warning);
      console.log('Valid From:', r.valid_from);
      console.log('Update Time:', r.source_update_time);
    });

    const allLayers = await db.query(`SELECT DISTINCT layer FROM marine_bulletins`);
    console.log('\nAll available layers in DB:');
    console.log(allLayers.rows.map(r => r.layer));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkKerala();
