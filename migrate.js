const db = require('./src/config/db');

async function migrate() {
  try {
    await db.query("ALTER TABLE cleanup_campaigns ADD COLUMN visibility VARCHAR(20) DEFAULT 'Public';");
    console.log("Added visibility to cleanup_campaigns");
  } catch(e) {
    console.log("Error or already exists:", e.message);
  }

  try {
    await db.query("ALTER TABLE campaign_volunteers ADD COLUMN registration_status VARCHAR(20) DEFAULT 'Approved';");
    console.log("Added registration_status to campaign_volunteers");
  } catch(e) {
    console.log("Error or already exists:", e.message);
  }

  process.exit(0);
}

migrate();
