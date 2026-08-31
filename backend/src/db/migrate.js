const fs = require('fs');
const path = require('path');
const { query, closePool, testConnection } = require('../config/db');

async function runMigration() {
  console.log('--- Starting Database Migration ---');
  
  const conn = await testConnection();
  if (!conn.connected) {
    console.error(`[Migration Failed]: Cannot connect to database: ${conn.message}`);
    console.error('Please ensure PostgreSQL is running and credentials in .env are correct.');
    process.exit(1);
  }

  console.log(`Connected to database '${conn.database}' as user '${conn.user}'`);

  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`[Migration Error]: Schema file not found at ${schemaPath}`);
    process.exit(1);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  try {
    console.log('Executing schema DDL...');
    await query(schemaSql);
    console.log('✔ Schema DDL executed successfully.');

    // Verify created tables
    const tableRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`✔ Verified ${tableRes.rows.length} public tables in database:`);
    tableRes.rows.forEach(r => console.log(`   - ${r.table_name}`));
    console.log('--- Migration Completed Successfully ---');
  } catch (error) {
    console.error('[Migration Error]:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
