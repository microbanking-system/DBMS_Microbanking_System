const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'newdb',
  password: process.env.DB_PASSWORD || '123',
  port: process.env.DB_PORT || 5432,
});

// Optional startup check
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

module.exports = { pool };
