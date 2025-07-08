const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

let db;

(async () => {
  db = await open({
    filename: path.join(__dirname, '../db/casino.db'),
    driver: sqlite3.Database
  });

  // Endpoint per ottenere i dati di un singolo utente
  app.get('/utenti/:nome', async (req, res) => {
    try {
      const nome = req.params.nome;
      console.log("🔍 Cerco utente:", nome); // <--- AGGIUNTO LOG
      const utente = await db.get('SELECT * FROM utenti WHERE nome = ?', nome);
      if (!utente) return res.status(404).json({ message: 'Utente non trovato' });
  
      const cambi = await db.all('SELECT data_ora, fish_cambiati FROM cambi WHERE nome = ? ORDER BY data_ora DESC', nome);
  
      res.json({ utente, cambi });
    } catch (err) {
      console.error("❌ ERRORE:", err); // <--- AGGIUNTO LOG
      res.status(500).json({ error: err.message });
    }
  });
  

  // Endpoint per registrare un cambio fish
  app.post('/cambio', async (req, res) => {
    try {
      const { nome, data_ora, fish_cambiati } = req.body;
      if (!nome || !data_ora || !fish_cambiati) {
        return res.status(400).json({ error: 'Dati incompleti' });
      }

      const utente = await db.get('SELECT fish_residui FROM utenti WHERE nome = ?', nome);
      if (!utente) return res.status(404).json({ error: 'Utente non trovato' });

      if (utente.fish_residui < fish_cambiati) {
        return res.status(400).json({ error: 'Fish residui insufficienti' });
      }

      await db.run('INSERT INTO cambi (nome, data_ora, fish_cambiati) VALUES (?, ?, ?)', [nome, data_ora, fish_cambiati]);

      await db.run('UPDATE utenti SET fish_residui = fish_residui - ? WHERE nome = ?', [fish_cambiati, nome]);

      res.json({ message: 'Cambio fish registrato correttamente' });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => console.log(`🌐 API avviata su http://localhost:${port}`));
})();
