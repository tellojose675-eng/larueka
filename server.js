const express = require("express");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

// 👉 Servir tu página web (frontend)
app.use(express.static("public"));

// 👉 Configuración de la Base de Datos
const db = new sqlite3.Database("tienda.db", (err) => {
  if (err) {
    console.error("Error al abrir la base de datos", err.message);
  } else {
    console.log("Conectado a la base de datos SQLite");
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        image TEXT NOT NULL
      )
    `);

    // Verificar si hay productos, si no, insertar los iniciales
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
      if (err) {
        console.error(err.message);
        return;
      }
      if (row.count === 0) {
        const initialProducts = [
          { name: "Camisa Formal", price: 35, image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format" },
          { name: "Chaqueta de Cuero", price: 120, image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800" },
          { name: "Zapatillas", price: 150, image: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800" },
          { name: "Pantalón Jean", price: 45, image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800" },
          { name: "Polera Hoodie", price: 55, image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800" },
          { name: "Vestido de Gala", price: 120, image: "https://images.unsplash.com/photo-1539008835279-43468ef9300e?w=800" },
          { name: "Shorts Deportivos", price: 25, image: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800" },
          { name: "Gorra Urbana", price: 15, image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800" },
          { name: "Medias Pack x3", price: 10, image: "https://images.unsplash.com/photo-1582966232431-951d7e81efcd?w=800" },
          { name: "Correa de Cuero", price: 30, image: "https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800" },
          { name: "Jean Mujer", price: 60, image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800" },
          { name: "Blusa Elegante", price: 40, image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800" },
          { name: "Casaca de Jean", price: 85, image: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800" },
          { name: "Falda Midi", price: 45, image: "https://images.unsplash.com/photo-1583496661160-fb5889a0abab?w=800" },
          { name: "Sweater de Lana", price: 70, image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800" },
          { name: "Reloj Clásico", price: 110, image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800" },
          { name: "Gafas de Sol", price: 50, image: "https://images.unsplash.com/photo-1511499767390-90342f531a3f?w=800" },
          { name: "Mochila Urbana", price: 65, image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800" },
          { name: "Billetera de Cuero", price: 25, image: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800" },
          { name: "Zapatos de Vestir", price: 95, image: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800" }
        ];

        const stmt = db.prepare("INSERT INTO products (name, price, image) VALUES (?, ?, ?)");
        initialProducts.forEach(p => stmt.run(p.name, p.price, p.image));
        stmt.finalize();
        console.log("Productos iniciales insertados");
      }
    });
  });
}

// 👉 Ruta API: Obtener todos los productos
app.get("/products", (req, res) => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 👉 Ruta API: Agregar un producto
app.post("/products", (req, res) => {
  const { name, price, image } = req.body;
  if (!name || !price || !image) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }
  const query = "INSERT INTO products (name, price, image) VALUES (?, ?, ?)";
  db.run(query, [name, price, image], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, price, image });
  });
});

// 👉 Ruta API: Actualizar un producto
app.put("/products/:id", (req, res) => {
  const { name, price, image } = req.body;
  const { id } = req.params;
  const query = "UPDATE products SET name = ?, price = ?, image = ? WHERE id = ?";
  db.run(query, [name, price, image, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    res.json({ message: "Producto actualizado", id, name, price, image });
  });
});

// 👉 Ruta API: Eliminar un producto
app.delete("/products/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM products WHERE id = ?", id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    res.json({ message: "Producto eliminado", id });
  });
});

// 👉 Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 👉 Ruta del Admin
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});