# IoT Motor Health Monitoring System

Vibration-based anomaly monitoring prototype: ESP8266 + MPU6050 -> HTTPS -> Node.js/Express -> PostgreSQL -> Chart.js dashboard.

## Run locally
1. Open this folder in VS Code, then a terminal: `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env` and set DATABASE_URL, DEVICE_TOKEN, ADMIN_TOKEN
   (free Postgres: neon.tech; for a local non-SSL DB set DB_SSL=false)
4. `npm start`, then open http://localhost:3000

## Deploy (Render + Neon)
Build command: `npm install --prefix backend`
Start command: `npm start --prefix backend`
Set the same environment variables in Render.

The ESP8266 firmware (`firmware/motor_monitor.ino`) is in the project document.
