const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tienda.db');

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log("Tables:", tables);
    if (tables.length > 0) {
      db.all(`SELECT * FROM ${tables[0].name}`, (err, rows) => {
        if (err) {
          console.error(err.message);
          return;
        }
        console.log("Rows in first table:", rows);
        db.close();
      });
    } else {
      db.close();
    }
  });
});
