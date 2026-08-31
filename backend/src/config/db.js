const { Pool } = require('pg');
const config = require('./env');

const connectionString = process.env.DATABASE_URL || config.db.url;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    }
  : {
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      ssl: false
    };

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[Database Pool Error]: Unexpected client error', err);
});

/**
 * Execute a parameterized query against the PostgreSQL pool
 * @param {string} text - SQL Query text
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development') {
      console.log(`[SQL Query] (${duration}ms): ${text.trim().substring(0, 100)}`);
    }
    return res;
  } catch (error) {
    console.error(`[SQL Error] Query failed: ${text}`, error);
    throw error;
  }
}

/**
 * Acquire a dedicated client from the pool for transactions
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  return await pool.connect();
}

/**
 * Execute a sequence of queries within an isolated ACID database transaction
 * Automatically performs BEGIN, COMMIT, and ROLLBACK on error
 * @param {function(import('pg').PoolClient): Promise<any>} callback
 * @returns {Promise<any>}
 */
async function withTransaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database connectivity
 * @returns {Promise<{ connected: boolean, message?: string, version?: string }>}
 */
async function testConnection() {
  try {
    const res = await pool.query('SELECT version(), current_database(), current_user;');
    return {
      connected: true,
      database: res.rows[0].current_database,
      user: res.rows[0].current_user,
      version: res.rows[0].version
    };
  } catch (error) {
    return {
      connected: false,
      message: error.message
    };
  }
}

/**
 * Close database pool cleanly
 */
async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  getClient,
  withTransaction,
  testConnection,
  closePool
};
