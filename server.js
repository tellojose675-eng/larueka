const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// 👉 Servir tu página web (frontend)
app.use(express.static("public"));
const products = [
  {
    id: 1,
    name: "Camisa Formal",
    price: 35,
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format"
  },
  {
    id: 2,
    name: "Chaqueta de Cuero",
    price: 120,
    image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800"
  },
  {
    id: 3,
    name: "Zapatillas",
    price: 150,
    image: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800"
  }
];

// 👉 Ruta API
app.get("/products", (req, res) => {
  res.json(products);
});

// 👉 Ruta principal (para evitar "Cannot GET /")
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});