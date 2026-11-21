@echo off
cd "%1"
npm approve-scripts -a
npm install
cd node_modules/electron/
bash install.sh
