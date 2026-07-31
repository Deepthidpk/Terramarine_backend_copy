const db = require('../src/config/db');

async function migrateAdmin12Features() {
  try {
    console.log('Running Migration for 12 System Administrator Features...');

    // 1. Create platform_settings table
    await db.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✔ Created platform_settings table.');

    // Seed default platform settings if empty
    const checkSettings = await db.query('SELECT COUNT(*)::int FROM platform_settings');
    if (checkSettings.rows[0].count === 0) {
      await db.query(`
        INSERT INTO platform_settings (setting_key, setting_value, description)
        VALUES 
          ('maintenance_mode', 'false', 'Enable or disable system-wide maintenance mode'),
          ('max_file_upload_mb', '25', 'Maximum allowed upload size for reports and documents in MB'),
          ('session_timeout_minutes', '60', 'Default inactivity timeout for user sessions'),
          ('password_min_length', '8', 'Minimum required password length'),
          ('max_login_attempts', '5', 'Failed login attempts before temporary lockout'),
          ('jwt_expiry_hours', '24', 'JSON Web Token validity duration in hours'),
          ('google_oauth_enabled', 'true', 'Enable Google Single Sign-On authentication')
      `);
      console.log('✔ Seeded default platform settings.');
    }

    // 2. Create database_backups table
    await db.query(`
      CREATE TABLE IF NOT EXISTS database_backups (
        backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename VARCHAR(255) NOT NULL,
        size_mb DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Completed',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(user_id) ON DELETE SET NULL
      );
    `);
    console.log('✔ Created database_backups table.');

    // Seed sample backup snapshot if empty
    const checkBackups = await db.query('SELECT COUNT(*)::int FROM database_backups');
    if (checkBackups.rows[0].count === 0) {
      await db.query(`
        INSERT INTO database_backups (filename, size_mb, status)
        VALUES 
          ('terramarine_backup_2026_07_29.sql', 14.85, 'Completed'),
          ('terramarine_backup_2026_07_22.sql', 13.92, 'Completed')
      `);
      console.log('✔ Seeded sample database backup history.');
    }

    // 3. Create support_tickets table
    await db.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_name VARCHAR(150) NOT NULL,
        contact_email VARCHAR(150) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(50) DEFAULT 'Medium',
        status VARCHAR(50) DEFAULT 'Open',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolution_notes TEXT
      );
    `);
    console.log('✔ Created support_tickets table.');

    // Seed sample support tickets if empty
    const checkTickets = await db.query('SELECT COUNT(*)::int FROM support_tickets');
    if (checkTickets.rows[0].count === 0) {
      await db.query(`
        INSERT INTO support_tickets (org_name, contact_email, subject, description, priority, status)
        VALUES 
          ('Kochi Municipal Corporation', 'authority@terramarine.com', 'GIS Map Layer Synchronization Request', 'Need assistance configuring custom marine sanctuary boundary layer on GIS dashboard.', 'High', 'Open'),
          ('Eco Waves Coastal NGO', 'ngo@terramarine.com', 'Volunteer Bulk Certificate Generation', 'Requesting higher batch limit for volunteer cleanup certificate generation.', 'Medium', 'In Progress')
      `);
      console.log('✔ Seeded sample technical support tickets.');
    }

    console.log('All 12 System Admin migrations executed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrateAdmin12Features();
