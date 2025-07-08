const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

// Avvia il bot Discord in background
require('dotenv').config({ path: './.env' });
require('./bot/index.js');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('web'));

let db;

(async () => {
  // Inizializza database
  db = await open({
    filename: path.join(__dirname, 'db/casino.db'),
    driver: sqlite3.Database
  });

  console.log('✅ Database connesso');

  // ENDPOINT PER UPTIMEROBOT
  app.get('/ping', (req, res) => {
    res.json({ 
      status: 'online', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Homepage
  app.get('/', (req, res) => {
    res.send(`
      <html>
      <head>
        <title>🎰 Casino Manager</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; text-align: center; }
          .status { background: #4CAF50; color: white; padding: 10px; border-radius: 5px; margin: 20px 0; }
          .link { display: inline-block; margin: 10px; padding: 15px 30px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; }
          .link:hover { background: #1976D2; }
        </style>
      </head>
      <body>
        <h1>🎰 Casino Manager Discord Bot</h1>
        <div class="status">✅ Bot Online e Funzionante</div>
        <p>Sistema di gestione casinò per Discord con database SQLite</p>
        
        <a href="/utenti" class="link">📋 Lista Utenti</a>
        <a href="/dashboard" class="link">📊 Dashboard</a>
        <a href="/ping" class="link">🏓 Status API</a>
        
        <hr style="margin: 40px 0;">
        <p><small>Uptime: ${Math.floor(process.uptime())} secondi</small></p>
      </body>
      </html>
    `);
  });

  // Lista utenti
  app.get('/utenti', async (req, res) => {
    try {
      const utenti = await db.all('SELECT nome, pass, fish_residui FROM utenti ORDER BY nome');
      
      let html = `
        <html>
        <head>
          <title>📋 Lista Utenti</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background: #f2f2f2; }
            .back { display: inline-block; margin: 20px 0; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>📋 Lista Utenti Registrati</h1>
          <table>
            <tr><th>Nome</th><th>Pass</th><th>Fish Residui</th></tr>
      `;
      
      utenti.forEach(u => {
        html += `<tr><td>${u.nome}</td><td>${u.pass}</td><td>${u.fish_residui}</td></tr>`;
      });
      
      html += `
          </table>
          <a href="/" class="back">🔙 Torna alla Home</a>
        </body>
        </html>
      `;
      
      res.send(html);
    } catch (err) {
      res.status(500).send('Errore nel recupero utenti: ' + err.message);
    }
  });

  // Dashboard con statistiche
  app.get('/dashboard', async (req, res) => {
    try {
      const stats = await db.get(`
        SELECT 
          COUNT(*) as totale_utenti,
          SUM(fish_residui) as totale_fish,
          AVG(fish_residui) as media_fish
        FROM utenti
      `);
      
      const ultimiCambi = await db.all(`
        SELECT nome, data_ora, fish_cambiati 
        FROM cambi 
        ORDER BY data_ora DESC 
        LIMIT 10
      `);
      
      res.send(`
        <html>
        <head>
          <title>📊 Dashboard Casino</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 1000px; margin: 20px auto; }
            .stats { display: flex; gap: 20px; margin: 20px 0; }
            .stat-card { flex: 1; background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
            .stat-number { font-size: 2em; font-weight: bold; color: #2196F3; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f2f2f2; }
            .back { display: inline-block; margin: 20px 0; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>📊 Dashboard Casino Manager</h1>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${stats.totale_utenti}</div>
              <div>Utenti Totali</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${stats.totale_fish || 0}</div>
              <div>Fish Totali</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${Math.round(stats.media_fish || 0)}</div>
              <div>Media Fish/Utente</div>
            </div>
          </div>
          
          <h2>🔄 Ultimi Cambi Fish</h2>
          <table>
            <tr><th>Utente</th><th>Data/Ora</th><th>Fish Cambiati</th></tr>
            ${ultimiCambi.map(c => `<tr><td>${c.nome}</td><td>${c.data_ora}</td><td>${c.fish_cambiati}</td></tr>`).join('')}
          </table>
          
          <a href="/" class="back">🔙 Torna alla Home</a>
        </body>
        </html>
      `);
    } catch (err) {
      res.status(500).send('Errore nel caricamento dashboard: ' + err.message);
    }
  });

  // API per dati utente (per il frontend esistente)
  app.get('/api/utenti/:nome', async (req, res) => {
    try {
      const nome = req.params.nome;
      const utente = await db.get('SELECT * FROM utenti WHERE nome = ?', nome);
      if (!utente) return res.status(404).json({ message: 'Utente non trovato' });
  
      const cambi = await db.all('SELECT data_ora, fish_cambiati FROM cambi WHERE nome = ? ORDER BY data_ora DESC', nome);
      res.json({ utente, cambi });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Avvia server
  app.listen(port, () => {
    console.log(`🌐 Server avviato su porta ${port}`);
    console.log(`🤖 Bot Discord attivo`);
    console.log(`📊 Dashboard disponibile su /dashboard`);
    console.log(`🏓 Endpoint UptimeRobot: /ping`);
  });
})();