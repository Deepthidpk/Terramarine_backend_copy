const db = require('./src/config/db');

async function fix() {
  try {
    const res = await db.query("UPDATE cleanup_campaigns SET visibility = 'Private' WHERE campaign_name ILIKE '%Kollam%' RETURNING campaign_id;");
    if (res.rows.length > 0) {
      console.log("Updated visibility to Private for campaign:", res.rows[0].campaign_id);
      
      const updateVol = await db.query("UPDATE campaign_volunteers SET registration_status = 'Pending' WHERE campaign_id = $1 RETURNING *;", [res.rows[0].campaign_id]);
      console.log("Updated volunteers to Pending:", updateVol.rows.length);
    }
  } catch(e) {
    console.log("Error:", e.message);
  }

  process.exit(0);
}

fix();
