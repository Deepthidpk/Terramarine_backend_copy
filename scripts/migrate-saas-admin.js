const db = require('../src/config/db');

async function migrateSaaSAdmin() {
  try {
    console.log('Running SaaS Admin & Tenant Database Migration...');

    // 1. Add tenant / subscription fields to users table (primarily for Authority & Organization accounts)
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'Pro',
      ADD COLUMN IF NOT EXISTS license_status VARCHAR(50) DEFAULT 'Active',
      ADD COLUMN IF NOT EXISTS renewal_date TIMESTAMP DEFAULT NOW() + INTERVAL '1 year',
      ADD COLUMN IF NOT EXISTS max_users_limit INT DEFAULT 500,
      ADD COLUMN IF NOT EXISTS storage_limit_gb INT DEFAULT 100;
    `);
    console.log('✔ Updated users table with subscription and license fields.');

    // 2. Create system_announcements table
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_announcements (
        announcement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        severity VARCHAR(50) DEFAULT 'Info',
        target_role VARCHAR(50) DEFAULT 'All',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(user_id) ON DELETE SET NULL
      );
    `);
    console.log('✔ Created system_announcements table.');

    // 3. Create system_audit_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_audit_logs (
        log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        action VARCHAR(255) NOT NULL,
        details TEXT,
        ip_address VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✔ Created system_audit_logs table.');

    // Seed a initial system announcement if empty
    const checkAnnounce = await db.query('SELECT COUNT(*)::int FROM system_announcements');
    if (checkAnnounce.rows[0].count === 0) {
      await db.query(`
        INSERT INTO system_announcements (title, message, severity, target_role)
        VALUES (
          'Scheduled System Maintenance', 
          'TerraMarine platform will undergo routine maintenance on Sunday from 02:00 AM to 04:00 AM UTC. Platform availability will not be affected.',
          'Info',
          'All'
        )
      `);
      console.log('✔ Seeded initial system announcement.');
    }

    // Seed initial audit log if empty
    const checkAudit = await db.query('SELECT COUNT(*)::int FROM system_audit_logs');
    if (checkAudit.rows[0].count === 0) {
      await db.query(`
        INSERT INTO system_audit_logs (user_email, action, details, ip_address)
        VALUES ('terramarine33@gmail.com', 'SYSTEM_INITIALIZATION', 'TerraMarine SaaS Tenant Framework initialized successfully', '127.0.0.1')
      `);
      console.log('✔ Seeded initial audit log.');
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateSaaSAdmin();
