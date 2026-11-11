#!/data/data/com.termux/files/usr/bin/bash
set -e
pkg update -y
pkg install nodejs-lts unzip -y
npm install
if [ ! -f .env ]; then cp .env.example .env; fi
echo "RAXBOT siap. Edit .env lalu jalankan: npm start"
