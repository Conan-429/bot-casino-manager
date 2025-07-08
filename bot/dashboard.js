const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Configurazione database
const dbPath = path.join(__dirname, '..', 'db', 'casino.db');
const db = new sqlite3.Database(dbPath);

// Promisify delle funzioni del database
const get = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const DASHBOARD_FILE = path.join(__dirname, 'dashboard.json');
const CHANNEL_ID = '1387786149447340084'; // <-- QUI il tuo ID canale Discord

function salvaDashboard(ids) {
  fs.writeFileSync(DASHBOARD_FILE, JSON.stringify(ids, null, 2));
}

function caricaDashboard() {
  if (!fs.existsSync(DASHBOARD_FILE)) return {};
  return JSON.parse(fs.readFileSync(DASHBOARD_FILE));
}

async function inviaDashboard(client) {
  const canale = await client.channels.fetch(CHANNEL_ID);
  if (!canale) return console.error("❌ Canale non trovato!");

  const ids = caricaDashboard();

  // 📋 Lista Membri
  let listaMsg;
  if (ids.listaMembri) {
    try {
      listaMsg = await canale.messages.fetch(ids.listaMembri);
      await listaMsg.edit(await creaEmbedMembri());
    } catch {
      listaMsg = await canale.send(await creaEmbedMembri());
    }
  } else {
    listaMsg = await canale.send(await creaEmbedMembri());
  }

  // 📊 Statistiche
  let statsMsg;
  if (ids.statistiche) {
    try {
      statsMsg = await canale.messages.fetch(ids.statistiche);
      await statsMsg.edit(await creaEmbedStats());
    } catch {
      statsMsg = await canale.send(await creaEmbedStats());
    }
  } else {
    statsMsg = await canale.send(await creaEmbedStats());
  }

  salvaDashboard({
    listaMembri: listaMsg.id,
    statistiche: statsMsg.id
  });
}

async function creaEmbedMembri() {
  const embed = new EmbedBuilder()
    .setTitle('📋 Lista Membri')
    .setDescription('Visualizza i membri registrati.\nMostrati i primi 5...')
    .setColor(0x00b0f4)
    .setFooter({ text: 'Clicca per espandere la lista' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('espandi_lista')
      .setLabel('Espandi elenco')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

async function creaEmbedStats() {
  // Recupera le statistiche dal database
  const totalUsers = await get("SELECT COUNT(*) AS count FROM utenti");
  const totalFish = await get("SELECT SUM(fish_residui) AS sum FROM utenti");
  
  // Recupera il conteggio degli utenti e la somma delle fish per ogni tipo di pass
  const passStats = await getAll("SELECT pass, COUNT(*) AS count, SUM(fish_residui) AS total_fish FROM utenti GROUP BY pass ORDER BY count DESC");
  
  // Crea la stringa per mostrare i pass con conteggio utenti e fish totali
  let passText = '';
  if (passStats.length > 0) {
    passText = passStats.map(p => `**${p.pass}**: ${p.count} utenti (${p.total_fish || 0}🎲)`).join('\n');
  } else {
    passText = 'Nessun pass registrato';
  }

  const embed = new EmbedBuilder()
    .setTitle('📊 Statistiche Casinò')
    .addFields(
      { name: 'Utenti registrati', value: `**${totalUsers.count}**`, inline: true },
      { name: 'Fish totali', value: `**${totalFish.sum || 0}**`, inline: true },
      { name: '🎫 Distribuzione Pass', value: passText, inline: false }
    )
    .setColor(0x43b581)
    .setFooter({ text: 'Aggiornato ogni ora' });

  return { embeds: [embed] };
}

module.exports = {
  inviaDashboard
};

