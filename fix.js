require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  await pool.query("UPDATE products SET image = REPLACE(image, '/images/mujers/', '/images/mujeres/') WHERE category = 'mujer'");
  console.log('Fixed URLs');
  pool.end();
}

fix();
