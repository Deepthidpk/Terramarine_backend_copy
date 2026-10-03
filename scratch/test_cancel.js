const db = require('../src/config/db');

async function test() {
  const user = { user_id: 'afeeb454-eb36-4f5f-89a8-4e40ec066952', role: 'Authority', full_name: 'Municipal Administrator' };
  const id = '62971279-7ee5-4227-aea3-66e3d7d98761';
  
  const campaignResult = await db.query(
    `SELECT c.*, u.full_name as creator_name, u.organization_name 
     FROM cleanup_campaigns c
     JOIN users u ON c.created_by = u.user_id
     WHERE c.campaign_id = $1`,
    [id]
  );
  console.log('Campaign Found:', campaignResult.rows.length);
  const campaign = campaignResult.rows[0];
  console.log('Campaign Status:', campaign.status, 'Created By:', campaign.created_by, 'User:', user.user_id);
  
  const participantsResult = await db.query(
    `SELECT u.user_id, u.full_name, u.email, u.role
     FROM campaign_volunteers cv
     JOIN users u ON cv.volunteer_id = u.user_id
     WHERE cv.campaign_id = $1`,
    [id]
  );
  console.log('Participants:', participantsResult.rows);
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
