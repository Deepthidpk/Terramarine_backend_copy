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

    // Alter users.role to VARCHAR(50) to allow 'Worker' role
    await db.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'role' AND data_type = 'USER-DEFINED'
        ) THEN 
          ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50) USING role::VARCHAR;
        END IF;
      END $$;
    `);

    // Update worker accounts (e.g. Deepak or worker emails) to role = 'Worker'
    await db.query(`
      UPDATE users 
      SET role = 'Worker' 
      WHERE (LOWER(full_name) LIKE '%deepak%' OR LOWER(email) LIKE '%deepak%' OR LOWER(email) LIKE '%worker%') 
        AND role = 'Volunteer';
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

    // 6. Create research_projects table
    await db.query(`
      CREATE TABLE IF NOT EXISTS research_projects (
        project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        researcher_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        study_area VARCHAR(150),
        objectives TEXT,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 7. Create research_datasets table
    await db.query(`
      CREATE TABLE IF NOT EXISTS research_datasets (
        dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        researcher_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        project_id UUID REFERENCES research_projects(project_id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        file_url TEXT NOT NULL,
        file_name VARCHAR(255),
        file_size INT,
        data_type VARCHAR(50),
        record_count INT DEFAULT 0,
        location VARCHAR(150),
        uploaded_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 8. Create research_alerts table
    await db.query(`
      CREATE TABLE IF NOT EXISTS research_alerts (
        alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        researcher_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        alert_type VARCHAR(100) NOT NULL,
        parameter_name VARCHAR(50),
        threshold_value DECIMAL(10,2),
        comparison_operator VARCHAR(5),
        location VARCHAR(150),
        severity VARCHAR(20) DEFAULT 'Medium',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 9. Create research_reports table
    await db.query(`
      CREATE TABLE IF NOT EXISTS research_reports (
        report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        researcher_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        study_area VARCHAR(150),
        start_date DATE,
        end_date DATE,
        parameters JSONB,
        findings TEXT,
        file_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Category, Waste Type, and Researcher DB tables initialized successfully.');
  } catch (error) {
    console.error('Error initializing Category & Waste Type tables:', error.message);
  }
};

module.exports = initCategoryDb;
