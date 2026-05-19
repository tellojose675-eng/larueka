const fs = require('fs');
const files = ['public/index.html', 'public/hombres.html', 'public/mujeres.html'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('data.sort')) return; // Already sorted
  
  // En el index.html usamos "data.forEach", en hombres.html y mujeres.html quizas usamos "products.forEach" o "data.forEach"
  // Vamos a buscar "data.forEach(product =>" o "products.forEach(p =>"
  
  // Reemplazo para index.html
  content = content.replace('data.forEach(product => {', 'data.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));\n\n    data.forEach(product => {');
  
  // Reemplazo para hombres y mujeres si usan products
  content = content.replace('products.forEach(p => {', 'products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));\n\n    products.forEach(p => {');
  
  // Reemplazo extra si copiamos index.html tal cual (entonces usan data.forEach)
  // Como en mi script copie la base de index.html, hombres.html y mujeres.html usan "data.forEach(product =>" 
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
