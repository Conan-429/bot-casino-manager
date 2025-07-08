const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { inviaDashboard } = require('./dashboard.js');
dayjs.extend(utc);
dayjs.extend(timezone);

const CANALE_WIDGET_ID = "1387786149447340084";
const CANALE_IMMAGINI_ID = "1391906848168214669";
const widgetsPath = "./widgets.json";

// Fuso orario italiano
const TZ = "Europe/Rome";

// Configurazione per i test: true = usa minuti, false = usa giorni (default)
const TEST_MODE = false; // Imposta a false per disattivare la modalità test
// Intervallo di reset in minuti (per test) o giorni (produzione)
const RESET_INTERVAL = 7; // Cambia questo valore per modificare l'intervallo di reset in giorni

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const sqlite3 = require("sqlite3");
const path = require("path");
require("dotenv").config();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

// Apri il DB (modifica il path se serve)
const db = new sqlite3.Database(path.join(__dirname, "..", "db", "casino.db"));

// Promisify per run, get, all
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Funzione mancante per i pulsanti
async function prendiTuttiGliUtentiDalDB() {
  return await getAll("SELECT nome, pass, fish_residui FROM utenti ORDER BY nome");
}

// Pass possibili da assegnare agli utenti
function getFishByPass(pass) {
  switch (pass.toLowerCase()) {
    case "nessuno":
      return 15000;
    case "silver":
      return 25000;
    case "gold":
      return 50000;
    case "platinum":
      return 100000;
    default:
      return 0;
  }
}

// Funzione per creare le tabelle se non esistono
const createTables = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS utenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE NOT NULL,
      pass TEXT NOT NULL,
      fish_max INTEGER NOT NULL,
      fish_residui INTEGER NOT NULL,
      ultima_reset DATE NOT NULL,
      image_url TEXT
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS cambi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      data_ora TEXT NOT NULL,
      fish_cambiati INTEGER NOT NULL
    )
  `);

  console.log("✅ Tabelle controllate/creare correttamente.");
};

// EVENTO READY UNIFICATO
client.once("ready", async () => {
  await createTables();
  console.log(`🤖 Bot pronto come ${client.user.tag}`);
  await inviaDashboard(client);

  // Aggiorna la dashboard ogni ora
  setInterval(async () => {
    try {
      await inviaDashboard(client);
      console.log('📊 Dashboard aggiornata automaticamente');
    } catch (error) {
      console.error('Errore aggiornamento automatico dashboard:', error);
    }
  }, 60 * 60 * 1000); // 1 ora in millisecondi

  // Controlla e resetta le fish in base alla modalità configurata
  setInterval(async () => {
    try {
      await checkAndResetFish();
      console.log(`🔄 Controllo automatico reset fish completato (modalità ${TEST_MODE ? 'TEST' : 'PRODUZIONE'})`);
    } catch (error) {
      console.error('Errore controllo automatico reset fish:', error);
    }
  }, TEST_MODE ? (1 * 60 * 1000) : (12 * 60 * 60 * 1000)); // 1 minuto in test mode, 12 ore in produzione

  // Esegui un controllo all'avvio
  await checkAndResetFish();
});

// EVENT HANDLER UNIFICATO PER TUTTE LE INTERAZIONI
client.on('interactionCreate', async interaction => {
  // Gestione pulsanti
  if (interaction.isButton()) {
    if (interaction.customId === 'espandi_lista') {
      const utenti = await prendiTuttiGliUtentiDalDB();
      const descrizione = utenti.map(u => `• ${u.nome} (${u.pass}) - ${u.fish_residui}🎲`).join('\n');

      const nuovoEmbed = new EmbedBuilder()
        .setTitle('📋 Lista Membri Completa')
        .setDescription(descrizione)
        .setColor(0x00b0f4)
        .setFooter({ text: 'Elenco completo' });

      await interaction.update({ embeds: [nuovoEmbed], components: [] });
    }
    // Gestione pulsanti di conferma rimozione
    else if (interaction.customId.startsWith('conferma_rimozione_')) {
      const nome = interaction.customId.replace('conferma_rimozione_', '');

      try {
        // Rimuovi l'utente dal database
        await runQuery('DELETE FROM utenti WHERE nome = ?', [nome]);

        // Rimuovi anche lo storico dell'utente (tabella cambi)
        await runQuery('DELETE FROM cambi WHERE nome = ?', [nome]);

        await interaction.update({
          content: `✅ **Utente rimosso con successo!**\n\nL'utente **${nome}** è stato eliminato dal database insieme a tutto il suo storico.`,
          components: []
        });

        // Aggiorna la dashboard
        await inviaDashboard(client);

      } catch (error) {
        console.error('Errore durante la rimozione utente:', error);
        await interaction.update({
          content: `❌ **Errore durante la rimozione!**\n\nSi è verificato un errore durante la rimozione dell'utente **${nome}**.`,
          components: []
        });
      }
    }
    else if (interaction.customId.startsWith('annulla_rimozione_')) {
      const nome = interaction.customId.replace('annulla_rimozione_', '');

      await interaction.update({
        content: `✅ **Operazione annullata**\n\nLa rimozione dell'utente **${nome}** è stata annullata. Nessuna modifica è stata apportata al database.`,
        components: []
      });
    }
    // NUOVI GESTORI PER CAMBIA PASS
    else if (interaction.customId.startsWith('conferma_cambio_pass_')) {
      const [nome, nuovo_pass] = interaction.customId.replace('conferma_cambio_pass_', '').split('_');
      const fish_max = getFishByPass(nuovo_pass);

      try {
        await runQuery(
          "UPDATE utenti SET pass = ?, fish_max = ?, fish_residui = ? WHERE nome = ?",
          [nuovo_pass, fish_max, fish_max, nome]
        );

        await interaction.update({
          content: `✅ **Pass modificato con successo!**\n\nIl pass di **${nome}** è stato aggiornato a **${nuovo_pass}** (fish massimi: ${fish_max}). Fish residui resettati.`,
          components: []
        });

        // Aggiorna la dashboard
        await inviaDashboard(client);

      } catch (error) {
        console.error('Errore durante il cambio pass:', error);
        await interaction.update({
          content: `❌ **Errore durante il cambio pass!**\n\nSi è verificato un errore durante l'aggiornamento del pass per l'utente **${nome}**.`,
          components: []
        });
      }
    }
    else if (interaction.customId.startsWith('annulla_cambio_pass_')) {
      const [nome, nuovo_pass] = interaction.customId.replace('annulla_cambio_pass_', '').split('_');

      await interaction.update({
        content: `✅ **Operazione annullata**\n\nIl cambio pass per l'utente **${nome}** è stato annullato. Nessuna modifica è stata apportata al database.`,
        components: []
      });
    }
    // NUOVI GESTORI PER RESET FISH
    else if (interaction.customId.startsWith('conferma_reset_fish_')) {
      const nome = interaction.customId.replace('conferma_reset_fish_', '');

      try {
        const utente = await get(
          "SELECT pass, fish_residui FROM utenti WHERE nome = ?",
          [nome],
        );

        await runQuery(
          `UPDATE utenti SET fish_residui = ?, ultima_reset = ? WHERE nome = ?`,
          [utente.fish_max, dayjs().tz(TZ).format(), nome]
        );

        await interaction.update({
          content: `✅ **Fish resettate con successo!**\n\nLe fish di **${nome}** sono state resettate a **${utente.fish_max}** (valore massimo del pass).`,
          components: []
        });

        // Aggiorna la dashboard
        await inviaDashboard(client);

      } catch (error) {
        console.error('Errore durante il reset fish:', error);
        await interaction.update({
          content: `❌ **Errore durante il reset!**\n\nSi è verificato un errore durante il reset delle fish per l'utente **${nome}**.`,
          components: []
        });
      }
    }
    else if (interaction.customId.startsWith('annulla_reset_fish_')) {
      const nome = interaction.customId.replace('annulla_reset_fish_', '');

      await interaction.update({
        content: `✅ **Operazione annullata**\n\nIl reset delle fish per l'utente **${nome}** è stato annullato. Nessuna modifica è stata apportata al database.`,
        components: []
      });
    }
    // NUOVI GESTORI PER RESET ALL
    else if (interaction.customId === 'conferma_reset_all') {
      try {
        await runQuery(
          `UPDATE utenti SET fish_residui = fish_max, ultima_reset = DATE('now')`
        );

        await interaction.update({
          content: `✅ **Reset globale completato con successo!**\n\nLe fish residue di **tutti gli utenti** sono state resettate al valore massimo del loro pass.`,
          components: []
        });

        // Aggiorna la dashboard
        await inviaDashboard(client);

      } catch (error) {
        console.error('Errore durante il reset globale:', error);
        await interaction.update({
          content: `❌ **Errore durante il reset globale!**\n\nSi è verificato un errore durante il reset delle fish per tutti gli utenti.`,
          components: []
        });
      }
    }
    else if (interaction.customId === 'annulla_reset_all') {
      await interaction.update({
        content: `✅ **Operazione annullata**\n\nIl reset globale delle fish è stato annullato. Nessuna modifica è stata apportata al database.`,
        components: []
      });
    }
    return;
  }

  // Gestione comandi slash
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Verifica dei permessi basati sui ruoli
  const requiredRole = commandPermissions[commandName];
  if (requiredRole && !hasRole(interaction.member, requiredRole) && !hasRole(interaction.member, "admin")) {
    await interaction.reply({ 
      content: `⛔ **Permesso negato!**\n\nHai bisogno del ruolo **${requiredRole}** per utilizzare questo comando.`, 
      ephemeral: true 
    });
    return;
  }

  try {
    if (commandName === "statistiche") {
      await interaction.deferReply();

      const totalUsers = await get("SELECT COUNT(*) AS count FROM utenti");
      const totalFish = await get(
        "SELECT SUM(fish_residui) AS sum FROM utenti",
      );

      await interaction.editReply(
        `📊 Statistiche:\n• Utenti registrati: **${totalUsers.count}**\n• Fish totali residui: **${totalFish.sum || 0}**`,
      );
    } else if (commandName === "reset_all") {
      await interaction.deferReply();

      // Aggiungiamo la richiesta di conferma
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('conferma_reset_all')
            .setLabel('✅ Conferma Reset Globale')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('annulla_reset_all')
            .setLabel('❌ Annulla')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.editReply({
        content: `⚠️ **ATTENZIONE!**\n\nStai per resettare le fish residue di **TUTTI GLI UTENTI** al valore massimo del loro pass.\n\nQuesta operazione non può essere annullata. Sei sicuro di voler procedere?`,
        components: [row]
      });
    } else if (commandName === "cambia_pass") {
      await interaction.deferReply();
      const nome = interaction.options.getString("nome");
      const nuovo_pass = interaction.options.getString("nuovo_pass");

      // Verifica che il tipo di pass sia valido
      const tipiPassValidi = ["nessuno", "silver", "gold", "platinum"];
      if (!tipiPassValidi.includes(nuovo_pass.toLowerCase())) {
        await interaction.editReply(`⚠️ Tipo di pass non valido. I tipi di pass disponibili sono: ${tipiPassValidi.join(", ")}.`);
        return;
      }

      // Verifica che l'utente esista
      const utente = await get("SELECT * FROM utenti WHERE nome = ?", [nome]);
      if (!utente) {
        await interaction.editReply(`⚠️ Utente **${nome}** non trovato.`);
        return;
      }

      // Aggiungiamo la richiesta di conferma
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`conferma_cambio_pass_${nome}_${nuovo_pass}`)
            .setLabel('✅ Conferma Cambio Pass')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`annulla_cambio_pass_${nome}_${nuovo_pass}`)
            .setLabel('❌ Annulla')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.editReply({
        content: `⚠️ **ATTENZIONE!**\n\nStai per cambiare il pass di **${nome}** da **${utente.pass}** a **${nuovo_pass}**.\n\nQuesta operazione resetterà anche i fish residui. Sei sicuro di voler procedere?`,
        components: [row]
      });
    } else if (commandName === "reset_fish") {
      await interaction.deferReply();
      const nome = interaction.options.getString("nome");

      // Verifica che l'utente esista
      const utente = await get(
        "SELECT nome, pass, fish_max, fish_residui FROM utenti WHERE nome = ?",
        [nome],
      );
      if (!utente) {
        await interaction.editReply(`⚠️ Utente **${nome}** non trovato.`);
        return;
      }

      // Aggiungiamo la richiesta di conferma
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`conferma_reset_fish_${nome}`)
            .setLabel('✅ Conferma Reset Fish')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`annulla_reset_fish_${nome}`)
            .setLabel('❌ Annulla')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.editReply({
        content: `⚠️ **ATTENZIONE!**\n\nStai per resettare le fish di **${nome}** da **${utente.fish_residui}** a **${utente.fish_max}** (valore massimo del pass).\n\nQuesta operazione non può essere annullata. Sei sicuro di voler procedere?`,
        components: [row]
      });
    } else if (commandName === "aggiungiutente") {
      await interaction.deferReply();
      const nome = interaction.options.getString("nome");
      const pass = interaction.options.getString("pass") || "nessuno";
      const attachment = interaction.options.getAttachment("immagine");
  
      // Verifica che il tipo di pass sia valido
      const tipiPassValidi = ["nessuno", "silver", "gold", "platinum"];
      if (!tipiPassValidi.includes(pass.toLowerCase())) {
        await interaction.editReply(`⚠️ Tipo di pass non valido. I tipi di pass disponibili sono: ${tipiPassValidi.join(", ")}`);
        return;
      }
  
      const fish_max = getFishByPass(pass);
      let imageUrl = null;
  
      try {
        // Verifica se l'utente esiste già
        const utenteEsistente = await get("SELECT nome FROM utenti WHERE nome = ?", [nome]);
        if (utenteEsistente) {
          await interaction.editReply(`⚠️ Utente **${nome}** già presente nel database.`);
          return;
        }
  
        // Carica l'immagine se fornita
        if (attachment) {
          // Verifica che sia un'immagine
          if (!attachment.contentType.startsWith('image/')) {
            await interaction.editReply(`⚠️ Il file caricato non è un'immagine valida.`);
            return;
          }
          
          imageUrl = await uploadImageToDiscord(attachment);
        }
  
        // Aggiungi il nuovo utente
        await runQuery(
          "INSERT INTO utenti (nome, pass, fish_max, fish_residui, ultima_reset, image_url) VALUES (?, ?, ?, ?, ?, ?)",
          [nome, pass, fish_max, fish_max, dayjs().tz(TZ).format(), imageUrl]
        );
  
        let risposta = `✅ Utente **${nome}** aggiunto con successo!\n• Pass: **${pass}**\n• Fish: **${fish_max}**`;
        if (imageUrl) {
          risposta += `\n• Immagine: Caricata con successo`;
        }
  
        await interaction.editReply(risposta);
  
        // Aggiorna la dashboard
        await inviaDashboard(client);
      } catch (error) {
        console.error('Errore durante l\'aggiunta utente:', error);
        await interaction.editReply(`❌ Errore durante l'aggiunta dell'utente **${nome}**.`);
      }
    } else if (commandName === "rimuoviutente") {
      await interaction.deferReply();
      const nome = interaction.options.getString("nome");

      // Verifica che l'utente esista
      const utente = await get("SELECT nome FROM utenti WHERE nome = ?", [nome]);
      if (!utente) {
        await interaction.editReply(`⚠️ Utente **${nome}** non trovato.`);
        return;
      }

      // Aggiungiamo la richiesta di conferma
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`conferma_rimozione_${nome}`)
            .setLabel('✅ Conferma Rimozione')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`annulla_rimozione_${nome}`)
            .setLabel('❌ Annulla')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.editReply({
        content: `⚠️ **ATTENZIONE!**\n\nStai per rimuovere l'utente **${nome}** dal database.\n\nQuesta operazione eliminerà anche tutto lo storico dell'utente e non può essere annullata. Sei sicuro di voler procedere?`,
        components: [row]
      });
    } else if (commandName === "lista_utenti") {
      await interaction.deferReply();

      const utenti = await prendiTuttiGliUtentiDalDB();

      if (utenti.length === 0) {
        await interaction.editReply("⚠️ Nessun utente registrato nel database.");
        return;
      }

      // Mostra solo i primi 10 utenti per non intasare la chat
      const utentiVisibili = utenti.slice(0, 10);
      const descrizioneBreve = utentiVisibili.map(u => `• ${u.nome} (${u.pass}) - ${u.fish_residui}🎲`).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('📋 Lista Membri')
        .setDescription(descrizioneBreve)
        .setColor(0x00b0f4)
        .setFooter({ text: `Mostrando ${utentiVisibili.length} di ${utenti.length} utenti` });

      // Se ci sono più di 10 utenti, aggiungi un pulsante per espandere la lista
      let components = [];
      if (utenti.length > 10) {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('espandi_lista')
              .setLabel(`Mostra tutti gli utenti (${utenti.length})`)
              .setStyle(ButtonStyle.Primary)
          );
        components = [row];
      }

      await interaction.editReply({ embeds: [embed], components });
    } else if (commandName === "cambio_fish") {
      await interaction.deferReply();
      const nome = interaction.options.getString("nome");
      const quantita = interaction.options.getInteger("quantita");
      const data_ora = interaction.options.getString("data_ora") || dayjs().tz(TZ).format();

      // Verifica che l'utente esista
      const utente = await get(
        "SELECT nome, fish_residui FROM utenti WHERE nome = ?",
        [nome],
      );
      if (!utente) {
        await interaction.editReply(`⚠️ Utente **${nome}** non trovato.`);
        return;
      }

      // Verifica che ci siano abbastanza fish
      if (utente.fish_residui < quantita) {
        await interaction.editReply(
          `⚠️ Fish insufficienti per **${nome}**!\n• Fish residui: **${utente.fish_residui}**\n• Fish richiesti: **${quantita}**`
        );
        return;
      }

      try {
        // Aggiorna le fish residue dell'utente
        await runQuery(
          "UPDATE utenti SET fish_residui = fish_residui - ? WHERE nome = ?",
          [quantita, nome]
        );

        // Registra il cambio nella tabella cambi
        await runQuery(
          "INSERT INTO cambi (nome, data_ora, fish_cambiati) VALUES (?, ?, ?)",
          [nome, data_ora, quantita]
        );

        // Ottieni le fish residue aggiornate
        const utenteAggiornato = await get(
          "SELECT fish_residui FROM utenti WHERE nome = ?",
          [nome]
        );

        await interaction.editReply(
          `✅ Cambio fish registrato per **${nome}**!\n• Fish cambiate: **${quantita}**\n• Fish residue: **${utenteAggiornato.fish_residui}**`
        );

        // Aggiorna la dashboard
        await inviaDashboard(client);
      } catch (error) {
        console.error('Errore durante il cambio fish:', error);
        await interaction.editReply(`❌ Errore durante il cambio fish per l'utente **${nome}**.`);
      }
    } else if (commandName === "storico_utente") {
      await interaction.deferReply();
      const nome = interaction.options.getString("nome");
      const limite = interaction.options.getInteger("limite") || 10;

      const utente = await get(
        "SELECT nome, fish_residui, image_url FROM utenti WHERE nome = ?",
        [nome],
      );
      if (!utente) {
        await interaction.editReply(`⚠️ Utente **${nome}** non trovato.`);
        return;
      }

      const cambi = await getAll(
        "SELECT data_ora, fish_cambiati FROM cambi WHERE nome = ? ORDER BY data_ora DESC LIMIT ?",
        [nome, limite],
      );

      if (cambi.length === 0) {
        // Crea un embed con l'immagine se disponibile
        if (utente.image_url) {
          const embed = new EmbedBuilder()
            .setTitle(`Informazioni utente: ${nome}`)
            .setDescription(`📋 Nessun cambio fish registrato\n🎣 Fish residui: **${utente.fish_residui}**`)
            .setThumbnail(utente.image_url)
            .setColor('#0099ff');
          
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.editReply(
            `📋 Nessun cambio fish registrato per **${nome}**. Fish residui: **${utente.fish_residui}**`,
          );
        }
        return;
      }

      const storico = cambi
        .map(
          (c) =>
            `• **${dayjs(c.data_ora).tz(TZ).format("DD/MM/YYYY HH:mm")}**: ${c.fish_cambiati} fish`,
        )
        .join("\n");

      // Crea un embed con l'immagine se disponibile
      if (utente.image_url) {
        const embed = new EmbedBuilder()
          .setTitle(`Storico cambi fish: ${nome}`)
          .setDescription(`${storico}\n\n🎣 Fish residui: **${utente.fish_residui}**`)
          .setThumbnail(utente.image_url)
          .setColor('#0099ff');
        
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply(
          `📋 Storico cambi fish per **${nome}**:\n${storico}\n\n🎣 Fish residui: **${utente.fish_residui}**`,
        );
      }
    } else if (commandName === 'refresh-dashboard') {
      await interaction.deferReply();

      try {
        await inviaDashboard(client);
        await interaction.editReply('✅ Dashboard aggiornata con successo!');
      } catch (error) {
        console.error('Errore aggiornamento dashboard:', error);
        await interaction.editReply('❌ Errore durante l\'aggiornamento della dashboard.');
      }
    } else if (commandName === "aggiorna_immagine") {
      await interaction.deferReply();
      const nome = interaction.options.getString("nome");
      const attachment = interaction.options.getAttachment("immagine");
  
      // Verifica che l'utente esista
      const utente = await get("SELECT nome FROM utenti WHERE nome = ?", [nome]);
      if (!utente) {
        await interaction.editReply(`⚠️ Utente **${nome}** non trovato.`);
        return;
      }
  
      // Verifica che sia un'immagine
      if (!attachment.contentType.startsWith('image/')) {
        await interaction.editReply(`⚠️ Il file caricato non è un'immagine valida.`);
        return;
      }
  
      try {
        // Carica la nuova immagine
        const imageUrl = await uploadImageToDiscord(attachment);
        
        if (!imageUrl) {
          await interaction.editReply(`❌ Errore durante il caricamento dell'immagine.`);
          return;
        }
  
        // Aggiorna l'URL dell'immagine nel database
        await runQuery(
          "UPDATE utenti SET image_url = ? WHERE nome = ?",
          [imageUrl, nome]
        );
  
        await interaction.editReply(`✅ Immagine aggiornata con successo per l'utente **${nome}**!`);
      } catch (error) {
        console.error('Errore durante l\'aggiornamento dell\'immagine:', error);
        await interaction.editReply(`❌ Errore durante l'aggiornamento dell'immagine per l'utente **${nome}**.`);
      }
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      await interaction.editReply("⚠️ Si è verificato un errore interno.");
    }
  }
});

client.login(process.env.BOT_TOKEN);

// Funzione per verificare i permessi basati sui ruoli
function hasRole(member, roleName) {
  // Se l'utente ha esattamente il ruolo richiesto
  if (member.roles.cache.some(role => role.name.toLowerCase() === roleName.toLowerCase())) {
    return true;
  }

  // Ottieni il ruolo richiesto dal server
  const requiredRole = member.guild.roles.cache.find(role => role.name.toLowerCase() === roleName.toLowerCase());

  // Se il ruolo richiesto non esiste nel server, ritorna false
  if (!requiredRole) return false;

  // Controlla se l'utente ha un ruolo con posizione più alta del ruolo richiesto
  return member.roles.cache.some(role => role.position > requiredRole.position);
}

// Funzione per verificare i permessi basati sugli ID dei ruoli
//function hasRole(member, roleId) {
//  return member.roles.cache.some(role => role.id === roleId);
//}

// Mappa dei comandi con i ruoli richiesti
const commandPermissions = {
  "aggiungiutente": "Vice Direttore",
  "rimuoviutente": "Admin",
  "cambia_pass": "Vice Direttore",
  "reset_fish": "Admin",
  "reset_all": "Admin",
  "cambio_fish": "Vice Direttore",
  "lista_utenti": "Vice Direttore",
  "statistiche": "Vice Direttore",
  "storico_utente": "Vice Direttore",
  "refresh-dashboard": "Vice Direttore",
  "aggiorna_immagine": "Vice Direttore"
};

// Funzione per controllare e resettare le fish automaticamente
async function checkAndResetFish() {
  try {
    // Ottieni tutti gli utenti dal database
    const utenti = await getAll("SELECT * FROM utenti");

    // Data corrente nel fuso orario italiano
    const now = dayjs().tz(TZ);

    // Controlla ogni utente
    for (const utente of utenti) {
      // Data dell'ultimo reset
      const ultimoReset = dayjs(utente.ultima_reset).tz(TZ);

      // Calcola la differenza in giorni o minuti in base alla modalità
      const unitaDiTempo = TEST_MODE ? 'minute' : 'day';
      const tempoPassato = now.diff(ultimoReset, unitaDiTempo);
      const intervalloReset = TEST_MODE ? RESET_INTERVAL : 7; // 7 giorni di default

      // Se è passato l'intervallo configurato, resetta le fish al valore di default
      if (tempoPassato >= intervalloReset) {
        console.log(`🔄 Reset automatico fish per ${utente.nome} dopo ${tempoPassato} ${TEST_MODE ? 'minuti' : 'giorni'}`);

        // Imposta le fish al valore di default
        const fishDefault = getFishByPass("nessuno");

        // Aggiorna il database
        await runQuery(
          "UPDATE utenti SET fish_residui = ?, pass = 'nessuno', fish_max = ?, ultima_reset = ? WHERE nome = ?",
          [fishDefault, fishDefault, now.format(), utente.nome]
        );
      }
    }

    // Aggiorna la dashboard dopo eventuali modifiche
    await inviaDashboard(client);

  } catch (error) {
    console.error('Errore durante il controllo automatico delle fish:', error);
  }
}

async function uploadImageToDiscord(attachment) {
  try {
    // Ottieni il canale delle immagini
    const imageChannel = await client.channels.fetch(CANALE_IMMAGINI_ID);
    if (!imageChannel) {
      console.error('Canale immagini non trovato!');
      return null;
    }
    
    // Invia l'immagine al canale
    const message = await imageChannel.send({
      files: [{
        attachment: attachment.url,
        name: attachment.name
      }]
    });
    
    // Restituisci l'URL dell'immagine caricata
    return message.attachments.first().url;
  } catch (error) {
    console.error('Errore durante il caricamento dell\'immagine:', error);
    return null;
  }
}
