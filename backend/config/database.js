// =============================================================================
// DATABASE CONFIGURATION - PostgreSQL Connection Pool
// =============================================================================
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'newdb',
  password: process.env.DB_PASSWORD || 'praveen123',
  port: process.env.DB_PORT || 5432,
});

// Test database connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.stack);
    return;
  }
  console.log('✅ Connected to PostgreSQL database');
  release();
});

// Export the pool for use in controllers
module.exports = pool;
