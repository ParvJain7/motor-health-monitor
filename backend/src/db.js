const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: true },
  max: 5
});
pool.on('error', (e) => console.error('DB pool error:', e.message));

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
  await pool.query(sql);
  const w = Number(process.env.DEFAULT_WARNING_G || 0.15);
  const c = Number(process.env.DEFAULT_CRITICAL_G || 0.4);
  await pool.query(
    "INSERT INTO settings (key, value) VALUES ('warning', $1), ('critical', $2) ON CONFLICT (key) DO NOTHING",
    [w, c]
  );
  console.log('Database ready');
}

module.exports = { query: (text, params) => pool.query(text, params), init };
