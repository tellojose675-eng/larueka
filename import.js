require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const hombresDir = "C:\\Users\\jose2\\Desktop\\LA RUEKA\\HOMBRES";
const mujeresDir = "C:\\Users\\jose2\\Desktop\\LA RUEKA\\MUJERES";
const targetHombresDir = path.join(__dirname, "public", "images", "hombres");
const targetMujeresDir = path.join(__dirname, "public", "images", "mujeres");

// Create target directories
fs.mkdirSync(targetHombresDir, { recursive: true });
fs.mkdirSync(targetMujeresDir, { recursive: true });

async function processDirectory(sourceDir, targetDir, category) {
  if (!fs.existsSync(sourceDir)) {
    console.log(`Directory not found: ${sourceDir}`);
    return;
  }
  
  const files = fs.readdirSync(sourceDir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      
      // Copy file
      fs.copyFileSync(sourcePath, targetPath);
      
      // Clean up product name (remove extension)
      const name = path.parse(file).name;
      const imageUrl = `/images/${category}s/${file}`;
      
      // Insert to DB
      await pool.query(
        "INSERT INTO products (name, price, image, category) VALUES ($1, $2, $3, $4)",
        [name, 0, imageUrl, category]
      );
      console.log(`Added product: ${name} in category ${category}`);
    }
  }
}

async function run() {
  try {
    await processDirectory(hombresDir, targetHombresDir, "hombre");
    await processDirectory(mujeresDir, targetMujeresDir, "mujer");
    console.log("All products imported successfully!");
  } catch (error) {
    console.error("Error importing products:", error);
  } finally {
    pool.end();
  }
}

run();
