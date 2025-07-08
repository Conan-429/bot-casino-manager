#!/bin/bash
echo "📦 Avvio sistema Casinò..."

# Ottieni la directory corrente (root del progetto)
PROJECT_DIR=$(pwd)

# Avvia API in background
cd "$PROJECT_DIR/api" && node index.js &
API_PID=$!

# Avvia BOT
cd "$PROJECT_DIR/bot" && DOTENV_CONFIG_PATH="$PROJECT_DIR/.env" node -r dotenv/config index.js &
BOT_PID=$!

# Aspetta che entrambi i processi terminino
wait $API_PID $BOT_PID