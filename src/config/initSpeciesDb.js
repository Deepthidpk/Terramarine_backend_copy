const db = require('./db');

const initialCategories = [
  'Mammals',
  'Fish',
  'Reptiles',
  'Corals',
  'Crustaceans',
  'Microorganisms',
  'Plants',
  'Coastal Birds'
];

const initialSpecies = [
  {
    name: 'Green Sea Turtle',
    scientific_name: 'Chelonia mydas',
    category: 'Reptiles',
    status: 'Endangered',
    habitat: 'Coastal waters, lagoons, reefs, and seagrass beds',
    threats: 'Plastic pollution, accidental netting, coastal development',
    sensitivity: 'High',
    notes: 'Frequently observed feeding on seagrass near Fort Kochi.',
    image: '/images/green_sea_turtle.png'
  },
  {
    name: 'Indian Humpback Dolphin',
    scientific_name: 'Sousa plumbea',
    category: 'Mammals',
    status: 'Endangered',
    habitat: 'Shallow coastal waters, estuaries, and river mouths',
    threats: 'Acoustic disturbance, vessel strikes, chemical pollution',
    sensitivity: 'High',
    notes: 'A small group spotted periodically inside the Kochi harbour channel.',
    image: '/images/indian_humpback_dolphin.png'
  },
  {
    name: 'Indian Mackerel',
    scientific_name: 'Rastrelliger kanagurta',
    category: 'Fish',
    status: 'Least Concern',
    habitat: 'Coastal pelagic waters, bays, and reef zones',
    threats: 'Overfishing, rising seawater temperature, microplastics',
    sensitivity: 'Medium',
    notes: 'Major commercial species. Vulnerable to chemical and plastic residues.',
    image: '/images/indian_mackerel.png'
  },
  {
    name: 'Whale Shark',
    scientific_name: 'Rhincodon typus',
    category: 'Fish',
    status: 'Endangered',
    habitat: 'Warm coastal seas and open ocean basins',
    threats: 'Ghost nets, marine plastic consumption, ship impacts',
    sensitivity: 'High',
    notes: 'Rare migratory sightings logged offshore.',
    image: '/images/whale_shark.png'
  },
  {
    name: 'Staghorn Coral',
    scientific_name: 'Acropora cervicornis',
    category: 'Corals',
    status: 'Critically Endangered',
    habitat: 'Shallow reef terraces and lagoons',
    threats: 'Coral bleaching, sediment runoff, high turbidity',
    sensitivity: 'Critical',
    notes: 'Extremely vulnerable to changes in pH and dissolved oxygen levels.',
    image: 'https://images.unsplash.com/photo-1546026423-cc4642628d2b?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Zooplankton (Copepods)',
    scientific_name: 'Copepoda',
    category: 'Microorganisms',
    status: 'Stable',
    habitat: 'Pelagic zones, estuaries, and benthic environments',
    threats: 'Acidification, petroleum hydrocarbons, microplastics',
    sensitivity: 'High',
    notes: 'Primary food source. Abundance drop indicates chemical contamination.',
    image: '/images/zooplankton_copepods.png'
  },
  {
    name: 'Mangrove Crab',
    scientific_name: 'Scylla serrata',
    category: 'Crustaceans',
    status: 'Least Concern',
    habitat: 'Mangrove swamps, muddy coasts, and estuaries',
    threats: 'Habitat loss, chemical runoff, heavy metals',
    sensitivity: 'Medium',
    notes: 'Crucial for mangrove soil aeration. Accumulates bio-toxins.',
    image: '/images/mangrove_crab.png'
  },
  {
    name: 'Seagrass (Tape Grass)',
    scientific_name: 'Enhalus acoroides',
    category: 'Plants',
    status: 'Vulnerable',
    habitat: 'Shallow marine mud flats and coral sand shores',
    threats: 'Turbidity block (no sunlight), dredging, oil spills',
    sensitivity: 'High',
    notes: 'Forms carbon sinks. Requires high light penetration.',
    image: '/images/seagrass_tape_grass.png'
  },
  {
    name: 'White-bellied Sea Eagle',
    scientific_name: 'Haliaeetus leucogaster',
    category: 'Coastal Birds',
    status: 'Least Concern',
    habitat: 'Coastal cliffs, estuaries, and offshore islands',
    threats: 'Bioaccumulation of poisons, nest disturbance',
    sensitivity: 'Medium',
    notes: 'Top predator. High concentration of plastics in nesting materials.',
    image: '/images/white_bellied_sea_eagle.png'
  }
];

const initSpeciesDb = async () => {
  try {
    // 1. Create species_categories table
    await db.query(`
      CREATE TABLE IF NOT EXISTS species_categories (
        category_id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default categories if empty
    const catCheck = await db.query('SELECT COUNT(*)::int as count FROM species_categories');
    if (catCheck.rows[0].count === 0) {
      for (const catName of initialCategories) {
        await db.query(`
          INSERT INTO species_categories (name, is_default)
          VALUES ($1, true)
          ON CONFLICT (name) DO NOTHING;
        `, [catName]);
      }
      console.log('Seeded default species categories successfully.');
    }

    // 2. Create species_catalog table
    await db.query(`
      CREATE TABLE IF NOT EXISTS species_catalog (
        species_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        scientific_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        status VARCHAR(100) NOT NULL,
        habitat TEXT,
        threats TEXT,
        sensitivity VARCHAR(50) DEFAULT 'Medium',
        notes TEXT,
        image VARCHAR(500),
        created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        created_by_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Seed initial species if empty
    const countRes = await db.query('SELECT COUNT(*)::int as count FROM species_catalog');
    if (countRes.rows[0].count === 0) {
      console.log('Seeding initial marine species catalog into PostgreSQL...');
      for (const sp of initialSpecies) {
        await db.query(`
          INSERT INTO species_catalog (name, scientific_name, category, status, habitat, threats, sensitivity, notes, image)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [sp.name, sp.scientific_name, sp.category, sp.status, sp.habitat, sp.threats, sp.sensitivity, sp.notes, sp.image]);
      }
      console.log('Initial species catalog seeded successfully.');
    }
  } catch (err) {
    console.error('Error initializing species_catalog DB:', err.message);
  }
};

module.exports = initSpeciesDb;
