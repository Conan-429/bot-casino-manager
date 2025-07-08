const express = require("express");
const sqlite3 = require("sqlite3");
const path = require("path");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Europe/Rome";

const app = express();
const port = process.env.PORT || 3000;

// Connessione al database (PATH CORRETTO)
const db = new sqlite3.Database(path.join(__dirname, "..", "db", "casino.db"), (err) => {
  if (err) {
    console.error("❌ Errore nel collegamento al DB:", err.message);
  } else {
    console.log("✅ Connessione al DB riuscita.");
  }
});

// Homepage
app.get("/", (req, res) => {
  res.send(`
    <h1>🎰 Pannello Casinò Discord</h1>
    <p>Vai su <a href="/utenti">/utenti</a> per vedere la lista utenti registrati nel database.</p>
  `);
});

// Lista utenti
app.get("/utenti", (req, res) => {
  db.all("SELECT nome, pass, fish_residui FROM utenti ORDER BY nome", (err, rows) => {
    if (err) {
      res.status(500).send("Errore nel recupero utenti dal database.");
      return;
    }

    let html = `<h1>📋 Lista Utenti</h1><ul>`;
    rows.forEach((u) => {
      html += `<li><strong>${u.nome}</strong> - Pass: ${u.pass} - Fish residui: ${u.fish_residui}</li>`;
    });
    html += `</ul><p><a href="/">🔙 Torna alla home</a></p>`;
    res.send(html);
  });
});

// Avvio server
app.listen(port, () => {
  console.log(`🌐 Server web avviato su http://localhost:${port}`);
});
