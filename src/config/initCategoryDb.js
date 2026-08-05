const db = require('./db');

const initCategoryDb = async () => {
  try {
    // 1. Alter pollution_reports.report_category to VARCHAR(100) to allow custom categories
    await db.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'pollution_reports' AND column_name = 'report_category' AND data_type = 'USER-DEFINED'
        ) THEN 
          ALTER TABLE pollution_reports ALTER COLUMN report_category TYPE VARCHAR(100) USING report_category::VARCHAR;
        END IF;
      END $$;
    `);

    // 2. Create report_categories table
    await db.query(`
      CREATE TABLE IF NOT EXISTS report_categories (
        category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Create waste_types table
    await db.query(`
      CREATE TABLE IF NOT EXISTS waste_types (
        waste_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Seed default categories if empty
    const catCheck = await db.query('SELECT COUNT(*) FROM report_categories');
    if (parseInt(catCheck.rows[0].count) === 0) {
      await db.query(`
        INSERT INTO report_categories (name, description) VALUES
        ('Pollution', 'General marine and coastal pollution issues including plastic, garbage, and debris.'),
        ('Emergency', 'Critical environmental emergencies such as oil spills, chemical leaks, and toxic hazards.')
        ON CONFLICT (name) DO NOTHING;
      `);
      console.log('Seeded default report categories successfully.');
    }

    // 5. Seed default waste types if empty
    const wasteCheck = await db.query('SELECT COUNT(*) FROM waste_types');
    if (parseInt(wasteCheck.rows[0].count) === 0) {
      await db.query(`
        INSERT INTO waste_types (name, description) VALUES
        ('Plastic', 'Plastic bottles, food wrappers, bags, microplastics, and synthetic containers.'),
        ('Glass', 'Broken or discarded glass bottles, jars, and sharp glass fragments.'),
        ('Fishing Nets', 'Abandoned, lost, or discarded fishing gear (ghost nets, lines, and ropes).'),
        ('Oil Spill', 'Petroleum slicks, oil drums, fuel leaks, and chemical residues at sea or shore.'),
        ('Dead Marine Life', 'Casualties of marine organisms, stranded mammals, fish kills, or endangered species.'),
        ('General Litter', 'Mixed solid waste, organic debris, wood, clothing, and domestic refuse.')
        ON CONFLICT (name) DO NOTHING;
      `);
      console.log('Seeded default waste types successfully.');
    }

    console.log('Category and Waste Type DB tables initialized successfully.');
  } catch (error) {
    console.error('Error initializing Category & Waste Type tables:', error.message);
  }
};

module.exports = initCategoryDb;
