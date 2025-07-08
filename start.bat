@echo off
echo 📦 Preparazione ambiente Casino Manager...

:: Imposta il percorso assoluto del progetto
set PROJECT_PATH=%~dp0
cd /d %PROJECT_PATH%

:: Installa le dipendenze nella cartella principale
echo 🔄 Installazione dipendenze nella cartella principale...
call npm install

:: Avvia il server come su Replit
echo 🌐 Avvio server e bot...
node server.js

pause