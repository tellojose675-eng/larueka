require("dotenv").config();

const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");

// SQLite
const sqliteDb = new sqlite3.Database("tienda.db");

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function migrar() {
  try {
    // Crear tabla si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        image TEXT NOT NULL
      )
    `);

    // Leer productos SQLite
    sqliteDb.all("SELECT * FROM products", async (err, rows) => {
      if (err) {
        console.error(err);
        return;
      }

      console.log(`Productos encontrados: ${rows.length}`);

      for (const p of rows) {
        await pool.query(
          "INSERT INTO products (name, price, image) VALUES ($1, $2, $3)",
          [p.name, p.price, p.image]
        );

        console.log(`Migrado: ${p.name}`);
      }

      console.log("Migración completada");

      sqliteDb.close();
      pool.end();
    });
  } catch (err) {
    console.error(err);
  }
}

migrar();