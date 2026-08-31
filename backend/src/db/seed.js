const fs = require('fs');
const path = require('path');
const { query, closePool, testConnection } = require('../config/db');

async function runSeed() {
  console.log('--- Starting Database Seed ---');

  const conn = await testConnection();
  if (!conn.connected) {
    console.error(`[Seed Failed]: Cannot connect to database: ${conn.message}`);
    process.exit(1);
  }

  const positionsSeedPath = path.resolve(__dirname, '../../../database/seeds/01_positions.sql');
  if (!fs.existsSync(positionsSeedPath)) {
    console.error(`[Seed Error]: Seed file not found at ${positionsSeedPath}`);
    process.exit(1);
  }

  const seedSql = fs.readFileSync(positionsSeedPath, 'utf8');

  try {
    console.log('Seeding official 20 election positions...');
    await query(seedSql);
    
    const countRes = await query('SELECT COUNT(*) as total FROM positions;');
    console.log(`✔ Successfully seeded ${countRes.rows[0].total} election positions.`);
    
    const listRes = await query('SELECT display_order, name FROM positions ORDER BY display_order ASC;');
    listRes.rows.forEach(r => console.log(`   ${r.display_order}. ${r.name}`));
    
    console.log('--- Seeding Completed Successfully ---');
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
