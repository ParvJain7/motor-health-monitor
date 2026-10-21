'use strict';
const POLL_MS = 5000;
const HISTORY = 60;
const $ = (id) => document.getElementById(id);
let rmsChart, ratioChart, thrFilled = false;

async function api(path, opts) {
  const r = await fetch(path, opts);
  let j = {};
  try { j = await r.json(); } catch (e) { /* not JSON */ }
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

function dataset(label, color, dashed) {
  return { label, data: [], borderColor: color, backgroundColor: color, borderWidth: 2,
    pointRadius: dashed ? 0 : 2, borderDash: dashed ? [6, 4] : [], tension: 0.25 };
}

function makeChart(id, datasets) {
  return new Chart($(id), {
    type: 'line',
    data: { labels: [], datasets },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
  });
}

function setBadge(cls, text) { const b = $('online'); b.className = 'badge ' + cls; b.textContent = text; }

function statusClass(s) { return s === 'NORMAL' ? 'ok' : s === 'WARNING' ? 'warn' : s === 'CRITICAL' ? 'crit' : 'unknown'; }

function fmtTime(iso) { return iso ? new Date(iso).toLocaleString() : '--'; }

function render(st, latest, history, cfg) {
  setBadge(st.online ? 'ok' : 'crit', st.online ? 'Device ONLINE' : 'Device OFFLINE');
  const stat = latest ? latest.status : 'UNKNOWN';
  $('status').textContent = stat;
  $('status').className = 'big pill ' + statusClass(stat);
  $('rms').textContent = latest && latest.vibrationRms !== null ? latest.vibrationRms.toFixed(3) : '--';
  $('ratio').textContent = latest && latest.baselineRms > 0 && latest.vibrationRms !== null
    ? (latest.vibrationRms / latest.baselineRms).toFixed(2) + 'x baseline (' + latest.baselineRms.toFixed(3) + ' g)'
    : 'Baseline not available yet';
  $('ts').textContent = latest ? fmtTime(latest.receivedAt) : 'No data yet';
  $('ago').textContent = st.secondsSinceLastSeen !== null ? 'Last communication ' + st.secondsSinceLastSeen + ' s ago' : '';
  $('sensor').textContent = st.sensorOk === null ? '--' : st.sensorOk ? 'Sensor OK' : 'SENSOR DISCONNECTED';
  $('rssi').textContent = latest ? 'Wi-Fi signal ' + latest.rssi + ' dBm' : '';

  const labels = history.map((r) => new Date(r.receivedAt).toLocaleTimeString());
  rmsChart.data.labels = labels;
  rmsChart.data.datasets[0].data = history.map((r) => r.vibrationRms);
  rmsChart.data.datasets[1].data = history.map(() => cfg.warning);
  rmsChart.data.datasets[2].data = history.map(() => cfg.critical);
  rmsChart.update();
  ratioChart.data.labels = labels;
  ratioChart.data.datasets[0].data = history.map((r) =>
    r.baselineRms > 0 && r.vibrationRms !== null ? r.vibrationRms / r.baselineRms : null);
  ratioChart.update();

  if (!thrFilled) { $('warn').value = cfg.warning; $('crit').value = cfg.critical; thrFilled = true; }

  const tbody = $('rows');
  tbody.textContent = '';
  if (!history.length) {
    const tr = tbody.insertRow(); const td = tr.insertCell(); td.colSpan = 5; td.textContent = 'No readings yet';
  }
  history.slice().reverse().slice(0, 10).forEach((r) => {
    const tr = tbody.insertRow();
    [fmtTime(r.receivedAt), r.vibrationRms === null ? '--' : r.vibrationRms.toFixed(3), r.status,
      r.sensorOk ? 'OK' : 'DISCONNECTED', String(r.rssi)].forEach((v) => { tr.insertCell().textContent = v; });
  });
}

async function refresh() {
  try {
    const [st, lt, hi, cfg] = await Promise.all([
      api('/api/status'), api('/api/latest'), api('/api/history?limit=' + HISTORY), api('/api/config')
    ]);
    $('banner').hidden = true;
    render(st, lt.reading, hi.readings.slice().reverse(), cfg);
  } catch (e) {
    $('banner').hidden = false;
    $('banner').textContent = 'Cannot reach the server (' + e.message + '). Retrying every 5 s...';
    setBadge('unknown', 'Server unreachable');
  }
}

$('thr').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = $('thrMsg');
  try {
    const r = await api('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': $('admin').value },
      body: JSON.stringify({ warning: Number($('warn').value), critical: Number($('crit').value) })
    });
    msg.textContent = 'Saved: warning ' + r.warning + ' g, critical ' + r.critical + ' g';
    refresh();
  } catch (e) {
    msg.textContent = 'Could not save: ' + e.message;
  }
});

rmsChart = makeChart('rmsChart', [dataset('RMS (g)', '#2563eb'), dataset('Warning', '#d97706', true), dataset('Critical', '#dc2626', true)]);
ratioChart = makeChart('ratioChart', [dataset('RMS / baseline', '#7c3aed')]);
refresh();
setInterval(refresh, POLL_MS);
