const fs = require('fs');

const indexHtmlPath = 'public/index.html';
const hombresHtmlPath = 'public/hombres.html';
const mujeresHtmlPath = 'public/mujeres.html';

try {
  const indexContent = fs.readFileSync(indexHtmlPath, 'utf8');

  // Remove carousel parts
  let baseContent = indexContent.replace(/\/\* CARRUSEL \*\/[\s\S]*?\/\* PRODUCTOS \*\//, '/* PRODUCTOS */');
  baseContent = baseContent.replace(/<!-- CARRUSEL -->[\s\S]*?<!-- PRODUCTOS -->/, '<!-- PRODUCTOS -->');
  baseContent = baseContent.replace(/\/\* CARRUSEL \*\/[\s\S]*?\/\* INICIO \*\//, '/* INICIO */');

  // Generate hombres.html
  let hombresHtml = baseContent.replace('<title>Tienda de Ropa</title>', '<title>Hombres</title>');
  hombresHtml = hombresHtml.replace('const API = "/products";', 'const API = "/products/category/hombre";');
  fs.writeFileSync(hombresHtmlPath, hombresHtml);
  console.log('hombres.html updated successfully.');

  // Generate mujeres.html
  let mujeresHtml = baseContent.replace('<title>Tienda de Ropa</title>', '<title>Mujeres</title>');
  mujeresHtml = mujeresHtml.replace('const API = "/products";', 'const API = "/products/category/mujer";');
  fs.writeFileSync(mujeresHtmlPath, mujeresHtml);
  console.log('mujeres.html updated successfully.');

} catch (err) {
  console.error('Error:', err);
}
