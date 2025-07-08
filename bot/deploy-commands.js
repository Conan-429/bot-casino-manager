const { REST, Routes } = require("discord.js");
require("dotenv").config();

const commands = [
  {
    name: "aggiungiutente",
    description: "Aggiunge un utente al database",
    options: [
      {
        name: "nome",
        type: 3, // STRING
        description: "Nome dell'utente",
        required: true,
      },
      {
        name: "pass",
        type: 3, // STRING
        description: "Tipo di pass (nessuno, silver, gold o platinum.)",
        required: false,
      },
      {
        name: "immagine",
        type: 11, // ATTACHMENT
        description: "Immagine dell'utente (opzionale)",
        required: false,
      },
    ],
  },
  {
    name: "rimuoviutente",
    description: "Rimuove un utente dal database",
    options: [
      {
        name: "nome",
        type: 3, // STRING
        description: "Nome dell'utente da rimuovere",
        required: true,
      },
    ],
  },
  {
    name: "lista_utenti",
    description: "Mostra la lista degli utenti registrati",
  },
  {
    name: "cambio_fish",
    description: "Registra un cambio fish per un utente",
    options: [
      {
        name: "nome",
        type: 3, // string
        description: "Nome utente",
        required: true,
      },
      {
        name: "quantita",
        type: 4, // integer
        description: "Quantità di fish da scalare",
        required: true,
      },
      {
        name: "data_ora",
        type: 3, // string ISO o formattata, opzionale
        description: "Data e ora del cambio (opzionale)",
        required: false,
      },
    ],
  },
  {
    name: "statistiche",
    description: "Mostra statistiche base del casinò",
  },
  {
    name: "reset_fish",
    description: "Resetta i fish di un utente al valore massimo",
    options: [
      {
        name: "nome",
        type: 3, // STRING
        description: "Nome dell'utente",
        required: true,
      },
    ],
  },
  {
    name: "reset_all",
    description: "Resetta le fish residue di tutti gli utenti al valore massimo",
  },
  {
    name: "storico_utente",
    description: "Mostra lo storico dei cambi fish di un utente",
    options: [
      {
        name: "nome",
        type: 3, // STRING
        description: "Nome dell'utente",
        required: true,
      },
      {
        name: "limite",
        type: 4, // INTEGER
        description: "Numero massimo di record da mostrare",
        required: false,
      },
    ],
  },
  {
    name: "cambia_pass",
    description: "Cambia il tipo di pass di un utente",
    options: [
      {
        name: "nome",
        type: 3, // STRING
        description: "Nome dell'utente",
        required: true,
      },
      {
        name: "nuovo_pass",
        type: 3, // STRING
        description: "Nuovo tipo di pass (nessuno, silver, gold o platinum.)",
        required: true,
      },
    ],
  },
  {
    name: "aggiorna_immagine",
    description: "Aggiorna l'immagine di un utente esistente",
    options: [
      {
        name: "nome",
        type: 3, // STRING
        description: "Nome dell'utente",
        required: true,
      },
      {
        name: "immagine",
        type: 11, // ATTACHMENT
        description: "Nuova immagine dell'utente",
        required: true,
      },
    ],
  },
  {
    name: 'refresh-dashboard',
    description: 'Ricarica manualmente il widget della dashboard'
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log("🚀 Registrazione comandi slash in corso...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID,
      ),
      { body: commands },
    );
    console.log("✅ Comandi slash registrati correttamente!");
  } catch (error) {
    console.error(error);
  }
})();