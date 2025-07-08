const sqlite3 = require("sqlite3");
const path = require("path");

// Apri il DB
const db = new sqlite3.Database(path.join(__dirname, "..", "db", "casino.db"));

// Funzione per eseguire query
function runQuery(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, function (err) {
      if (err) {
        console.error("Errore SQL:", err);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

// Funzione per ottenere tutti i record
function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function updateDatabase() {
  try {
    // Verifica se la colonna image_url esiste già
    const rows = await getAll("PRAGMA table_info(utenti)");
    
    if (!rows) {
      console.error("Errore: impossibile ottenere informazioni sulla tabella");
      db.close();
      return;
    }
    
    // Controlla se la colonna image_url esiste già
    const columnExists = rows.some(row => row.name === 'image_url');
    
    if (!columnExists) {
      console.log("Aggiunta della colonna image_url alla tabella utenti...");
      await runQuery("ALTER TABLE utenti ADD COLUMN image_url TEXT");
      console.log("✅ Colonna image_url aggiunta con successo!");
    } else {
      console.log("La colonna image_url esiste già nella tabella utenti.");
    }
    
    console.log("✅ Aggiornamento del database completato.");
    db.close();
  } catch (error) {
    console.error("Errore durante l'aggiornamento del database:", error);
    db.close();
  }
}

updateDatabase();