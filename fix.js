const db = require('./src/config/db');

async function fix() {
  try {
    // 1. Fetch campaigns created by Authority users that are Private
    const selectRes = await db.query(`
      SELECT c.campaign_id, c.campaign_name, c.visibility, u.full_name, u.role
      FROM cleanup_campaigns c
      JOIN users u ON c.created_by = u.user_id
      WHERE u.role = 'Authority';
    `);
    console.log("Authority Campaigns before fix:", selectRes.rows);

    // 2. Update them to Public
    const updateRes = await db.query(`
      UPDATE cleanup_campaigns c
      SET visibility = 'Public'
      FROM users u
      WHERE c.created_by = u.user_id
        AND u.role = 'Authority'
        AND c.visibility != 'Public'
      RETURNING c.campaign_id, c.campaign_name, c.visibility;
    `);
    console.log("Updated campaigns:", updateRes.rows);

  } catch(e) {
    console.log("Error:", e.message);
  }

  process.exit(0);
}

fix();
