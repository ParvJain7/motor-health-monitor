const express = require('express');
const db = require('../db');
const { requireDevice, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const STATUSES = ['NORMAL', 'WARNING', 'CRITICAL', 'UNKNOWN'];
const DEFAULT_DEVICE = process.env.DEFAULT_DEVICE_ID || 'motor-01';
const OFFLINE_AFTER = Number(process.env.OFFLINE_AFTER_SECONDS || 30);
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const isNum = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

const toReading = (r) => r && {
  id: Number(r.id),
  deviceId: r.device_id,
  deviceTimestamp: r.device_ts,
  receivedAt: r.received_at,
  vibrationRms: r.vibration_rms,
  baselineRms: r.baseline_rms,
  status: r.status,
  sensorOk: r.sensor_ok,
  rssi: r.rssi
};

function deviceFrom(req) {
  const d = req.query.deviceId;
  return typeof d === 'string' && ID_RE.test(d) ? d : DEFAULT_DEVICE;
}

async function thresholds() {
  const { rows } = await db.query('SELECT key, value FROM settings');
  const o = {};
  rows.forEach((r) => { o[r.key] = r.value; });
  return { warning: o.warning, critical: o.critical };
}

function validateReading(b) {
  const bad = [];
  if (!b || typeof b !== 'object') return ['body'];
  if (typeof b.deviceId !== 'string' || !ID_RE.test(b.deviceId)) bad.push('deviceId');
  if (!Number.isInteger(b.timestamp) || b.timestamp < 0) bad.push('timestamp');
  if (b.vibrationRms !== null && !isNum(b.vibrationRms, 0, 100)) bad.push('vibrationRms');
  if (b.baselineRms !== null && !isNum(b.baselineRms, 0, 100)) bad.push('baselineRms');
  if (!STATUSES.includes(b.status)) bad.push('status');
  if (typeof b.sensorOk !== 'boolean') bad.push('sensorOk');
  if (!Number.isInteger(b.rssi) || b.rssi < -120 || b.rssi > 0) bad.push('rssi');
  return bad;
}

router.post('/readings', requireDevice, wrap(async (req, res) => {
  const bad = validateReading(req.body);
  if (bad.length) return res.status(400).json({ ok: false, error: 'Invalid fields', fields: bad });
  const b = req.body;
  const ts = b.timestamp > 1600000000 ? b.timestamp : null;
  const { rows } = await db.query(
    `INSERT INTO readings (device_id, device_ts, vibration_rms, baseline_rms, status, sensor_ok, rssi)
     VALUES ($1, to_timestamp($2::double precision), $3, $4, $5, $6, $7) RETURNING id`,
    [b.deviceId, ts, b.vibrationRms, b.baselineRms, b.status, b.sensorOk, b.rssi]
  );
  res.status(201).json({ ok: true, id: Number(rows[0].id) });
}));

router.get('/latest', wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM readings WHERE device_id = $1 ORDER BY received_at DESC LIMIT 1', [deviceFrom(req)]);
  res.json({ ok: true, reading: toReading(rows[0]) || null });
}));

router.get('/history', wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const { rows } = await db.query(
    'SELECT * FROM readings WHERE device_id = $1 ORDER BY received_at DESC LIMIT $2 OFFSET $3',
    [deviceFrom(req), limit, offset]);
  res.json({ ok: true, count: rows.length, limit, offset, readings: rows.map(toReading) });
}));

router.get('/status', wrap(async (req, res) => {
  const dev = deviceFrom(req);
  const { rows } = await db.query(
    `SELECT sensor_ok, status, received_at, EXTRACT(EPOCH FROM (NOW() - received_at)) AS age
     FROM readings WHERE device_id = $1 ORDER BY received_at DESC LIMIT 1`, [dev]);
  if (!rows.length) {
    return res.json({ ok: true, deviceId: dev, online: false, lastSeen: null, secondsSinceLastSeen: null,
      sensorOk: null, status: 'UNKNOWN', offlineAfterSeconds: OFFLINE_AFTER });
  }
  const age = Math.round(Number(rows[0].age));
  res.json({ ok: true, deviceId: dev, online: age <= OFFLINE_AFTER, lastSeen: rows[0].received_at,
    secondsSinceLastSeen: age, sensorOk: rows[0].sensor_ok, status: rows[0].status, offlineAfterSeconds: OFFLINE_AFTER });
}));

router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'up', time: new Date().toISOString() });
  } catch (e) {
    console.error('Health check failed:', e.message);
    res.status(503).json({ ok: false, db: 'down' });
  }
});

router.get('/config', wrap(async (req, res) => {
  const t = await thresholds();
  res.json({ ok: true, warning: t.warning, critical: t.critical, unit: 'g', offlineAfterSeconds: OFFLINE_AFTER });
}));

router.put('/config', requireAdmin, wrap(async (req, res) => {
  const { warning, critical } = req.body || {};
  if (!isNum(warning, 0.001, 50) || !isNum(critical, 0.001, 50) || warning >= critical) {
    return res.status(400).json({ ok: false, error: 'Need numbers with 0 < warning < critical <= 50' });
  }
  await db.query("UPDATE settings SET value = $1 WHERE key = 'warning'", [warning]);
  await db.query("UPDATE settings SET value = $1 WHERE key = 'critical'", [critical]);
  res.json({ ok: true, warning, critical });
}));

module.exports = router;
