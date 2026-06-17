require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");

// Función para encriptar la contraseña usando PBKDF2 (SHA-512)
function hashPassword(password) {
  const salt = process.env.PASSWORD_SALT || "larueka_salt_default_123";
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const app = express();

// =========================
// MIDDLEWARE
// =========================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
  extended: true
}));

app.use(express.static("public"));

// =========================
// POSTGRESQL
// =========================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },
});

// =========================
// CLOUDINARY
// =========================

const storage = new CloudinaryStorage({

  cloudinary: cloudinary,

  params: {
    folder: "productos",

    allowed_formats: [
      "jpg",
      "jpeg",
      "png",
      "webp"
    ],
  },

});

const upload = multer({ storage });

// =========================
// CREAR TABLA
// =========================

async function initializeDatabase() {

  try {

    await pool.query(`

      CREATE TABLE IF NOT EXISTS products (

        id SERIAL PRIMARY KEY,

        name TEXT NOT NULL,

        price REAL NOT NULL,

        image TEXT NOT NULL,

        category TEXT NOT NULL

      )

    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    const defaultHashed = hashPassword('admin123');
    await pool.query(`
      INSERT INTO settings (key, value)
      VALUES ('admin_password', $1)
      ON CONFLICT (key) DO NOTHING
    `, [defaultHashed]);

    // Migrar contraseña existente a hash si está en texto plano
    const currentPassQuery = await pool.query("SELECT value FROM settings WHERE key = 'admin_password'");
    if (currentPassQuery.rows.length > 0) {
      const currentPass = currentPassQuery.rows[0].value;
      if (currentPass.length !== 128) {
        const hashedVal = hashPassword(currentPass);
        await pool.query("UPDATE settings SET value = $1 WHERE key = 'admin_password'", [hashedVal]);
        console.log("🔑 Contraseña de administrador migrada a formato encriptado");
      }
    }

    console.log("✅ PostgreSQL conectado");

  } catch (err) {

    console.error("❌ Error PostgreSQL:");
    console.error(err.message);

  }

}

initializeDatabase();

// =========================
// OBTENER TODOS LOS PRODUCTOS
// =========================

app.get("/products", async (req, res) => {

  try {

    const result = await pool.query(`

      SELECT *
      FROM products
      ORDER BY id DESC

    `);

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});

// =========================
// OBTENER PRODUCTOS POR CATEGORÍA
// =========================

app.get("/products/category/:category", async (req, res) => {

  try {

    const { category } = req.params;

    const result = await pool.query(

      `
      SELECT *
      FROM products
      WHERE category = $1
      ORDER BY id DESC
      `,

      [category]

    );

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});

// =========================
// CREAR PRODUCTO
// =========================

app.post(
  "/products",
  upload.single("image"),

  async (req, res) => {

    try {

      const {
        name,
        price,
        category
      } = req.body;

      if (
        !name ||
        !price ||
        !category ||
        !req.file
      ) {

        return res.status(400).json({
          error: "Todos los campos son obligatorios"
        });

      }

      const image = req.file.path;

      const result = await pool.query(

        `
        INSERT INTO products
        (name, price, image, category)

        VALUES ($1, $2, $3, $4)

        RETURNING *
        `,

        [
          name,
          price,
          image,
          category
        ]

      );

      res.json(result.rows[0]);

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: err.message
      });

    }

  }

);

// =========================
// ACTUALIZAR PRODUCTO
// =========================

app.put(
  "/products/:id",
  upload.single("image"),

  async (req, res) => {

    try {

      const { id } = req.params;

      const {
        name,
        price,
        category
      } = req.body;

      const currentProduct =
        await pool.query(

          `
          SELECT *
          FROM products
          WHERE id = $1
          `,

          [id]

        );

      if (
        currentProduct.rows.length === 0
      ) {

        return res.status(404).json({
          error: "Producto no encontrado"
        });

      }

      let image =
        currentProduct.rows[0].image;

      if (req.file) {

        image = req.file.path;

      }

      const result = await pool.query(

        `
        UPDATE products

        SET
          name = $1,
          price = $2,
          image = $3,
          category = $4

        WHERE id = $5

        RETURNING *
        `,

        [
          name,
          price,
          image,
          category,
          id
        ]

      );

      res.json({

        message: "Producto actualizado",

        product: result.rows[0]

      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: err.message
      });

    }

  }

);

// =========================
// ELIMINAR PRODUCTO
// =========================

app.delete("/products/:id", async (req, res) => {

  try {

    const { id } = req.params;

    const result = await pool.query(

      `
      DELETE FROM products
      WHERE id = $1
      RETURNING *
      `,

      [id]

    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Producto no encontrado"
      });

    }

    res.json({
      message: "Producto eliminado"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});

// =========================
// ADMIN AUTHENTICATION
// =========================

app.post("/admin/login", async (req, res) => {
  try {
    const { password } = req.body;
    const result = await pool.query(`SELECT value FROM settings WHERE key = 'admin_password'`);
    if (result.rows.length === 0) {
      return res.status(500).json({ error: "Configuración no encontrada" });
    }
    const adminPassword = result.rows[0].value;
    const hashedPassword = hashPassword(password);
    if (hashedPassword === adminPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Contraseña incorrecta" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/admin/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query(`SELECT value FROM settings WHERE key = 'admin_password'`);
    if (result.rows.length === 0) {
      return res.status(500).json({ error: "Configuración no encontrada" });
    }
    const adminPassword = result.rows[0].value;
    const hashedCurrent = hashPassword(currentPassword);
    if (hashedCurrent !== adminPassword) {
      return res.status(401).json({ error: "La contraseña actual es incorrecta" });
    }
    if (!newPassword || newPassword.trim().length === 0) {
      return res.status(400).json({ error: "La nueva contraseña es inválida" });
    }
    
    const hashedNew = hashPassword(newPassword);
    await pool.query(`UPDATE settings SET value = $1 WHERE key = 'admin_password'`, [hashedNew]);
    res.json({ success: true, message: "Contraseña actualizada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// PÁGINAS
// =========================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );

});

app.get("/hombres", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "hombres.html"
    )
  );

});

app.get("/mujeres", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "mujeres.html"
    )
  );

});

app.get("/admin", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "admin.html"
    )
  );

});

// =========================
// SERVIDOR
// =========================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `🚀 Servidor corriendo en puerto ${PORT}`
  );

});

module.exports = app;