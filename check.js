const db = require('./src/config/db');

async function check() {
  try {
    const res = await db.query("SELECT campaign_id, campaign_name, visibility FROM cleanup_campaigns WHERE campaign_name ILIKE '%Kollam%';");
    console.log("Campaigns:", res.rows);
    
    if (res.rows.length > 0) {
      const vol = await db.query("SELECT * FROM campaign_volunteers WHERE campaign_id = $1;", [res.rows[0].campaign_id]);
      console.log("Volunteers for first:", vol.rows);
    }
  } catch(e) {
    console.log("Error:", e.message);
  }

  process.exit(0);
}

check();
