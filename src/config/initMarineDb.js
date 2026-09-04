const db = require('./db');

const initMarineDb = async () => {
  try {
    // Create marine_bulletins table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS marine_bulletins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(100),
        bulletin_type VARCHAR(50) NOT NULL, -- 'SEA_AREA' or 'COASTAL'
        observation_date VARCHAR(100),
        layer VARCHAR(255),
        issued_by VARCHAR(150),
        valid_from VARCHAR(100),
        validity_hours INT,
        warning TEXT,
        wind TEXT,
        synoptic_situation TEXT,
        weather TEXT,
        visibility TEXT,
        sea_condition TEXT,
        port_signal TEXT,
        part4 TEXT,
        part5 TEXT,
        part6 TEXT,
        source VARCHAR(100) DEFAULT 'IMD',
        source_update_time VARCHAR(100),
        retrieved_at TIMESTAMP NOT NULL DEFAULT NOW(),
        raw_response JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create Indexes for query performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_marine_bulletin_type ON marine_bulletins(bulletin_type);
      CREATE INDEX IF NOT EXISTS idx_marine_layer ON marine_bulletins(layer);
      CREATE INDEX IF NOT EXISTS idx_marine_valid_from ON marine_bulletins(valid_from);
      CREATE INDEX IF NOT EXISTS idx_marine_update_time ON marine_bulletins(source_update_time);
      CREATE INDEX IF NOT EXISTS idx_marine_external_id ON marine_bulletins(external_id);
    `);

    console.log('Marine Bulletins database table and indexes initialized successfully.');
  } catch (error) {
    console.error('Error initializing Marine Bulletins DB table:', error.message);
  }
};

module.exports = initMarineDb;
