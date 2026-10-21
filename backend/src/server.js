require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const api = require('./routes/api');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      upgradeInsecureRequests: null
    }
  }
}));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false }));
app.use(express.json({ limit: '2kb' }));

const opts = { standardHeaders: true, legacyHeaders: false };
app.use('/api/readings', rateLimit({ ...opts, windowMs: 60000, limit: 60, skip: (req) => req.method !== 'POST' }));
app.use('/api', rateLimit({ ...opts, windowMs: 60000, limit: 240 }));

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));
app.use(express.static(path.join(__dirname, '../../frontend')));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  console.error('Unhandled error:', err.message);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
db.init()
  .then(() => app.listen(PORT, () => console.log('Server listening on port ' + PORT)))
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
