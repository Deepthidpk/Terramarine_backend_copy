const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
};

async function initDatabase() {
  console.log('Connecting to PostgreSQL to check database...');
  
  // Connect to the default 'postgres' database first to create 'terramarine' if it doesn't exist
  const systemClient = new Client({
    ...dbConfig,
    database: 'postgres',
  });

  try {
    await systemClient.connect();
    
    // Check if the database exists
    const res = await systemClient.query("SELECT 1 FROM pg_database WHERE datname = 'terramarine'");
    if (res.rows.length === 0) {
      console.log("Database 'terramarine' does not exist. Creating it...");
      await systemClient.query('CREATE DATABASE terramarine');
      console.log("Database 'terramarine' created successfully.");
    } else {
      console.log("Database 'terramarine' already exists.");
    }
  } catch (error) {
    console.error('Failed to connect to PostgreSQL. Check your credentials in backend/.env', error);
    process.exit(1);
  } finally {
    await systemClient.end();
  }

  // Connect to the 'terramarine' database to run schema and seed
  console.log("Connecting to 'terramarine' database...");
  const appClient = new Client({
    ...dbConfig,
    database: 'terramarine',
  });

  try {
    await appClient.connect();

    // 1. Read and run schema.sql
    console.log('Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Initializing schema tables...');
    await appClient.query(schemaSql);
    console.log('Schema tables created successfully.');

    // 2. Read and run seed.sql
    console.log('Reading seed.sql...');
    const seedPath = path.join(__dirname, 'database/seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('Populating seed data...');
    await appClient.query(seedSql);
    console.log('Seed data populated successfully.');

    console.log('\n==================================================');
    console.log('TerraMarine Database Setup Complete!');
    console.log('==================================================\n');

  } catch (error) {
    console.error('Error during database initialization:', error);
    process.exit(1);
  } finally {
    await appClient.end();
  }
}

initDatabase();
