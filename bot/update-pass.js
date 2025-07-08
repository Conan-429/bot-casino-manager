const sqlite3 = require("sqlite3");
const path = require("path");

const db = new sqlite3.Database(path.join(__dirname, "../db/casino.db"));

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getFishByPass(pass) {
  switch (pass.toLowerCase()) {
    case "platinum":
      return 100000;
    case "gold":
      return 50000;
    case "silver":
      return 25000;
    case "nessuno":
      return 15000;
    default:
      return 0;
  }
}

async function updatePasses() {
  try {
    // Mappa vecchi pass a nuovi pass (modifica se hai altri vecchi nomi)
    const mappings = {
      "oro": "gold",
      "argento": "silver",
      "platino": "platinum",
      "nessuno": "nessuno"
    };

    for (const [oldPass, newPass] of Object.entries(mappings)) {
      const fish_max = getFishByPass(newPass);
      const sql = `UPDATE utenti SET pass = ?, fish_max = ?, fish_residui = ? WHERE pass = ?`;
      await runQuery(sql, [newPass, fish_max, fish_max, oldPass]);
      console.log(`Aggiornati utenti da pass "${oldPass}" a "${newPass}" con fish_max ${fish_max}`);
    }

    console.log("Aggiornamento completato!");
    db.close();
  } catch (err) {
    console.error("Errore durante aggiornamento:", err);
    db.close();
  }
}

updatePasses();
