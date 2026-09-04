const db = require('./db');

const initLocationDb = async () => {
  try {
    // Add location columns to users table if they do not exist
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS location_state VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS location_district VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS location_municipality VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS location_coastal_area VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS imd_coverage_region VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS imd_port_id VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS location_completed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE NULL;
    `);

    // Create index on location_completed and role for fast query lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_fisherman_location ON users(user_id, role, location_completed);
    `);

    console.log('Fisherman location schema columns and indexes initialized successfully.');
  } catch (error) {
    console.error('Error initializing Fisherman Location DB columns:', error.message);
  }
};

module.exports = initLocationDb;
