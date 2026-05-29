const { Pool } = require('pg')
const logger = require('../utils/logger')

let pool = null

async function connectPostgres() {
  pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT) || 5432,
    database: process.env.PG_DATABASE || 'focuslens',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  })

  await pool.query('SELECT 1')  // verify connection
  logger.info('[Postgres] Connected')

  await initSchema()
  return pool
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      started_at    TIMESTAMPTZ DEFAULT NOW(),
      ended_at      TIMESTAMPTZ,
      status        TEXT DEFAULT 'active',
      metadata      JSONB DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS cognitive_labels (
      id            SERIAL PRIMARY KEY,
      session_id    TEXT REFERENCES sessions(id),
      user_id       TEXT NOT NULL,
      label         TEXT NOT NULL CHECK (label IN ('focused','distracted','fatigued','overloaded','neutral')),
      confidence    INTEGER CHECK (confidence BETWEEN 1 AND 5),
      labeled_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS adaptive_actions (
      id            SERIAL PRIMARY KEY,
      session_id    TEXT REFERENCES sessions(id),
      action_type   TEXT NOT NULL,
      reason        TEXT,
      features      JSONB DEFAULT '{}',
      triggered_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_labels_session ON cognitive_labels(session_id);
    CREATE INDEX IF NOT EXISTS idx_actions_session ON adaptive_actions(session_id);
  `)
  logger.info('[Postgres] Schema initialized')
}

function getPool() {
  if (!pool) throw new Error('Postgres not connected')
  return pool
}

module.exports = { connectPostgres, getPool }