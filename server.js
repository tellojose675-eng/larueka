require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// =========================
// PostgreSQL
// =========================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// =========================
// Cloudinary Storage
// =========================

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "productos",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ storage });

// =========================
// Crear tabla automáticamente
// =========================

async function initializeDatabase() {

  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        image TEXT NOT NULL
      )
    `);

    // AGREGAR COLUMNA CATEGORY
    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS category TEXT
    `);

    console.log("✅ PostgreSQL conectado");

  } catch (err) {

    console.error("❌ Error PostgreSQL:");
    console.error(JSON.stringify(err, null, 2));

  }
}

initializeDatabase();

// =========================
// Obtener productos
// =========================

app.get("/products", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM products ORDER BY id ASC"
    );

    res.json(result.rows);

  } catch (err) {

    console.error("❌ Error obteniendo productos:");
    console.error(JSON.stringify(err, null, 2));

    res.status(500).json({
      error: err.message,
    });
  }
});

// =========================
// Obtener productos por categoría
// =========================

app.get("/products/category/:category", async (req, res) => {

  try {

    const { category } = req.params;

    const result = await pool.query(
      "SELECT * FROM products WHERE category=$1 ORDER BY id DESC",
      [category]
    );

    res.json(result.rows);

  } catch (err) {

    console.error("❌ Error categorías:");
    console.error(JSON.stringify(err, null, 2));

    res.status(500).json({
      error: err.message,
    });
  }
});

// =========================
// Agregar producto
// =========================

app.post(
  "/products",
  upload.single("image"),
  async (req, res) => {

    try {

      const { name, price, category } = req.body;

      if (!name || !price || !req.file || !category) {

        return res.status(400).json({
          error: "Todos los campos son obligatorios",
        });
      }

      const image = req.file.path;

      const result = await pool.query(
        `
        INSERT INTO products (name, price, image, category)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [name, price, image, category]
      );

      res.json(result.rows[0]);

    } catch (err) {

      console.error("❌ Error agregando producto:");
      console.error(JSON.stringify(err, null, 2));

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// =========================
// Actualizar producto
// =========================

app.put(
  "/products/:id",
  upload.single("image"),
  async (req, res) => {

    try {

      const { id } = req.params;
      const { name, price, category } = req.body;

      const currentProduct = await pool.query(
        "SELECT * FROM products WHERE id=$1",
        [id]
      );

      if (currentProduct.rows.length === 0) {

        return res.status(404).json({
          error: "Producto no encontrado",
        });
      }

      let image = currentProduct.rows[0].image;

      if (req.file) {
        image = req.file.path;
      }

      const result = await pool.query(
        `
        UPDATE products
        SET name=$1, price=$2, image=$3, category=$4
        WHERE id=$5
        RETURNING *
        `,
        [name, price, image, category, id]
      );

      res.json({
        message: "Producto actualizado",
        product: result.rows[0],
      });

    } catch (err) {

      console.error("❌ Error actualizando producto:");
      console.error(JSON.stringify(err, null, 2));

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// =========================
// Eliminar producto
// =========================

app.delete("/products/:id", async (req, res) => {

  try {

    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM products WHERE id=$1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    res.json({
      message: "Producto eliminado",
    });

  } catch (err) {

    console.error("❌ Error eliminando producto:");
    console.error(JSON.stringify(err, null, 2));

    res.status(500).json({
      error: err.message,
    });
  }
});

// =========================
// Página principal
// =========================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =========================
// Página hombres
// =========================

app.get("/hombres", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "hombres.html"));
});

// =========================
// Página mujeres
// =========================

app.get("/mujeres", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mujeres.html"));
});

// =========================
// Panel Admin
// =========================

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// =========================
// Iniciar servidor
// =========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});