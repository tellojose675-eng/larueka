require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

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

app.use(express.static(path.join(__dirname, "public"), { extensions: ['html'] }));

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
      CREATE TABLE IF NOT EXISTS reclamos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        tipo_documento VARCHAR(50) NOT NULL,
        numero_documento VARCHAR(50) NOT NULL,
        telefono VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        direccion TEXT,
        tipo_bien VARCHAR(50) NOT NULL,
        monto_reclamado NUMERIC(10, 2) DEFAULT 0.00,
        descripcion_bien TEXT,
        tipo_reclamacion VARCHAR(50) NOT NULL,
        detalle_reclamacion TEXT NOT NULL,
        pedido_consumidor TEXT NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado VARCHAR(50) DEFAULT 'Pendiente'
      )
    `);



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
      WHERE category = $1 OR category LIKE $2
      ORDER BY id DESC
      `,

      [category, `${category}:%`]

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

  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        const errMsg = err.message || JSON.stringify(err) || String(err);
        console.error("❌ Multer/Cloudinary error (POST):", errMsg);
        return res.status(500).json({ error: errMsg });
      }
      next();
    });
  },

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
          error: "Todos los campos son obligatorios (incluyendo imagen)"
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

      const errMsg = err.message || JSON.stringify(err) || String(err);
      console.error("❌ Error crear producto:", errMsg);

      res.status(500).json({
        error: errMsg
      });

    }

  }

);

// =========================
// ACTUALIZAR PRODUCTO
// =========================

app.put(
  "/products/:id",

  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        const errMsg = err.message || JSON.stringify(err) || String(err);
        console.error("❌ Multer/Cloudinary error (PUT):", errMsg);
        return res.status(500).json({ error: errMsg });
      }
      next();
    });
  },

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

      const errMsg = err.message || JSON.stringify(err) || String(err);
      console.error("❌ Error actualizar producto:", errMsg);

      res.status(500).json({
        error: errMsg
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
// LIBRO DE RECLAMACIONES
// =========================

async function sendReclamoEmail(reclamo) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const toEmail = process.env.NOTIFICATION_EMAIL || "laruekaperu@gmail.com";

  if (!host || !user || !pass) {
    console.log("⚠️ SMTP no está completamente configurado (SMTP_HOST, SMTP_USER, SMTP_PASS). Se omite el envío del correo de notificación.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: {
        user: user,
        pass: pass,
      },
    });

    const formattedMonto = parseFloat(reclamo.monto_reclamado || 0).toFixed(2);
    const dateFormatted = new Date(reclamo.fecha || new Date()).toLocaleString("es-PE", { timeZone: "America/Lima" });

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <div style="background-color: #111111; color: #ffffff; padding: 25px; text-align: center;">
          <h2 style="margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">Nuevo Reclamo Registrado</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">LA RUEKA - Libro de Reclamaciones</p>
        </div>
        <div style="padding: 25px; background-color: #ffffff; color: #333333; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 25px; padding: 15px; background-color: #f9f9f9; border-radius: 6px; border-left: 4px solid #e63946;">
            <span style="font-size: 13px; text-transform: uppercase; font-weight: bold; color: #666;">Código de Seguimiento</span><br/>
            <strong style="font-size: 20px; color: #e63946;">${reclamo.codigo}</strong>
          </div>

          <h3 style="border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; color: #111; font-size: 16px; text-transform: uppercase; margin-top: 0;">1. Información del Consumidor</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 160px; color: #555;">Nombre:</td>
              <td style="padding: 6px 0; color: #111;">${reclamo.nombre}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #555;">Documento:</td>
              <td style="padding: 6px 0; color: #111;">${reclamo.tipo_documento} ${reclamo.numero_documento}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #555;">Teléfono:</td>
              <td style="padding: 6px 0; color: #111;">${reclamo.telefono}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #555;">Email:</td>
              <td style="padding: 6px 0; color: #111;"><a href="mailto:${reclamo.email}" style="color: #e63946; text-decoration: none;">${reclamo.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #555;">Dirección:</td>
              <td style="padding: 6px 0; color: #111;">${reclamo.direccion || "-"}</td>
            </tr>
          </table>

          <h3 style="border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; color: #111; font-size: 16px; text-transform: uppercase;">2. Detalles del Bien Contratado</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 160px; color: #555;">Tipo de Bien:</td>
              <td style="padding: 6px 0; color: #111;">${reclamo.tipo_bien}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #555;">Monto Reclamado:</td>
              <td style="padding: 6px 0; color: #111; font-weight: bold;">S/. ${formattedMonto}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #555;">Descripción:</td>
              <td style="padding: 6px 0; color: #111;">${reclamo.descripcion_bien || "-"}</td>
            </tr>
          </table>

          <h3 style="border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; color: #111; font-size: 16px; text-transform: uppercase;">3. Detalles de la Reclamación</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 160px; color: #555;">Tipo:</td>
              <td style="padding: 6px 0; color: #111;"><span style="background-color: #ffeef0; color: #e63946; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; text-transform: uppercase;">${reclamo.tipo_reclamacion}</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #555;">Fecha de Envío:</td>
              <td style="padding: 6px 0; color: #111;">${dateFormatted}</td>
            </tr>
          </table>

          <div style="background-color: #fcfcfc; border: 1px solid #eee; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
            <p style="margin: 0 0 5px 0; font-weight: bold; font-size: 13px; color: #555; text-transform: uppercase;">Detalle del Hecho:</p>
            <p style="margin: 0; font-size: 14px; color: #333; white-space: pre-wrap;">${reclamo.detalle_reclamacion}</p>
          </div>

          <div style="background-color: #fcfcfc; border: 1px solid #eee; padding: 15px; border-radius: 6px;">
            <p style="margin: 0 0 5px 0; font-weight: bold; font-size: 13px; color: #555; text-transform: uppercase;">Pedido del Consumidor:</p>
            <p style="margin: 0; font-size: 14px; color: #333; white-space: pre-wrap;">${reclamo.pedido_consumidor}</p>
          </div>
        </div>
        <div style="background-color: #f5f5f5; text-align: center; padding: 15px; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0;">
          Este correo fue generado automáticamente por la plataforma de LA RUEKA.<br/>
          Por favor, atienda el reclamo dentro del plazo legal de 15 días hábiles.
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"Libro de Reclamaciones LA RUEKA" <${user}>`,
      to: toEmail,
      subject: `[${reclamo.tipo_reclamacion.toUpperCase()}] Libro de Reclamaciones - ${reclamo.codigo}`,
      html: htmlContent,
    });

    console.log("✉️ Correo de reclamación enviado con éxito. ID:", info.messageId);
  } catch (error) {
    console.error("❌ Error enviando correo de reclamación:", error);
  }
}

app.post("/api/reclamos", async (req, res) => {
  try {
    const {
      nombre,
      tipo_documento,
      numero_documento,
      telefono,
      email,
      direccion,
      tipo_bien,
      monto_reclamado,
      descripcion_bien,
      tipo_reclamacion,
      detalle_reclamacion,
      pedido_consumidor
    } = req.body;

    if (!nombre || !tipo_documento || !numero_documento || !telefono || !email || !tipo_bien || !tipo_reclamacion || !detalle_reclamacion || !pedido_consumidor) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const year = new Date().getFullYear();
    const countQuery = await pool.query(
      "SELECT COUNT(*) FROM reclamos WHERE codigo LIKE $1",
      [`LR-REC-${year}-%`]
    );
    const count = parseInt(countQuery.rows[0].count);
    const correlativo = (count + 1).toString().padStart(4, "0");
    const codigo = `LR-REC-${year}-${correlativo}`;

    const query = `
      INSERT INTO reclamos (
        codigo, nombre, tipo_documento, numero_documento, telefono, email,
        direccion, tipo_bien, monto_reclamado, descripcion_bien, tipo_reclamacion,
        detalle_reclamacion, pedido_consumidor
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      codigo,
      nombre,
      tipo_documento,
      numero_documento,
      telefono,
      email,
      direccion || null,
      tipo_bien,
      monto_reclamado || 0,
      descripcion_bien || null,
      tipo_reclamacion,
      detalle_reclamacion,
      pedido_consumidor
    ];

    const result = await pool.query(query, values);
    const newReclamo = result.rows[0];

    // Enviar correo de notificación (no bloqueante)
    sendReclamoEmail(newReclamo);

    res.json({
      success: true,
      message: "Reclamo registrado exitosamente",
      reclamo: newReclamo
    });
  } catch (err) {
    console.error("❌ Error al registrar reclamo:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reclamos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM reclamos ORDER BY fecha DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al obtener reclamos:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/reclamos/:id/estado", async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({ error: "El estado es requerido" });
    }

    const result = await pool.query(
      "UPDATE reclamos SET estado = $1 WHERE id = $2 RETURNING *",
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Reclamo no encontrado" });
    }

    res.json({
      success: true,
      message: "Estado de reclamo actualizado",
      reclamo: result.rows[0]
    });
  } catch (err) {
    console.error("❌ Error al actualizar estado de reclamo:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/reclamos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM reclamos WHERE id = $1 RETURNING *", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Reclamo no encontrado" });
    }

    res.json({
      success: true,
      message: "Reclamo eliminado"
    });
  } catch (err) {
    console.error("❌ Error al eliminar reclamo:", err);
    res.status(500).json({ error: err.message });
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