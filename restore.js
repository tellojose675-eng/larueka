require("dotenv").config();
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");

const sqliteDb = new sqlite3.Database("tienda.db");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  try {
    sqliteDb.all("SELECT * FROM products", async (err, rows) => {
      if (err) {
        console.error("Error reading SQLite:", err);
        return;
      }
      console.log(`Found ${rows.length} products in local backup.`);
      let count = 0;
      for (const p of rows) {
        let cat = "hombres";
        if (p.name.toLowerCase().includes("mujer")) cat = "mujeres";
        
        await pool.query(
          "INSERT INTO products (name, price, image, category) VALUES ($1, $2, $3, $4)",
          [p.name, p.price, p.image, cat]
        );
        console.log(`Inserted: ${p.name} in category ${cat}`);
        count++;
      }
      console.log(`Successfully migrated ${count} products to Supabase.`);
      sqliteDb.close();
      pool.end();
    });
  } catch (error) {
    console.error("Migration failed", error);
  }
}

migrate();
