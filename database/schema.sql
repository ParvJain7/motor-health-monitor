CREATE TABLE IF NOT EXISTS readings (
  id            BIGSERIAL PRIMARY KEY,
  device_id     VARCHAR(32) NOT NULL,
  device_ts     TIMESTAMPTZ,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vibration_rms REAL CHECK (vibration_rms >= 0),
  baseline_rms  REAL CHECK (baseline_rms >= 0),
  status        VARCHAR(10) NOT NULL CHECK (status IN ('NORMAL','WARNING','CRITICAL','UNKNOWN')),
  sensor_ok     BOOLEAN NOT NULL,
  rssi          SMALLINT
);
CREATE INDEX IF NOT EXISTS idx_readings_device_received ON readings (device_id, received_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key   VARCHAR(32) PRIMARY KEY,
  value REAL NOT NULL
);
