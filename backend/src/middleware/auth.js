const crypto = require('crypto');
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();

function make(envName, header) {
  return (req, res, next) => {
    const expected = process.env[envName];
    if (!expected) {
      console.error(envName + ' is not configured');
      return res.status(500).json({ ok: false, error: 'Server not configured' });
    }
    const given = req.get(header) || '';
    if (crypto.timingSafeEqual(hash(given), hash(expected))) return next();
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  };
}

module.exports = {
  requireDevice: make('DEVICE_TOKEN', 'x-device-token'),
  requireAdmin: make('ADMIN_TOKEN', 'x-admin-token')
};
