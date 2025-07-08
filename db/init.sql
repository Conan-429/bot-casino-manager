CREATE TABLE IF NOT EXISTS utenti (
  nome TEXT PRIMARY KEY,
  pass TEXT,
  fish_max INTEGER,
  fish_residui INTEGER,
  ultima_reset TEXT
);

CREATE TABLE IF NOT EXISTS cambi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  data_ora TEXT,
  fish_cambiati INTEGER
);
