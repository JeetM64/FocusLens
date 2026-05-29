const { getPool } = require('../db/postgres')
const logger = require('../utils/logger')

class SessionService {
  static async createOrResume({ sessionId, userId }) {
    const pool = getPool()
    try {
      await pool.query(
        `INSERT INTO sessions (id, user_id, started_at, status)
         VALUES ($1, $2, NOW(), 'active')
         ON CONFLICT (id) DO UPDATE SET status = 'active'`,
        [sessionId, userId]
      )
      logger.info(`[SessionService] Session registered: ${sessionId}`)
    } catch (err) {
      logger.error('[SessionService] createOrResume error:', err.message)
    }
  }

  static async end(sessionId) {
    const pool = getPool()
    await pool.query(
      `UPDATE sessions SET ended_at = NOW(), status = 'ended'
       WHERE id = $1`,
      [sessionId]
    )
  }

  static async getById(sessionId) {
    const pool = getPool()
    const { rows } = await pool.query(
      'SELECT * FROM sessions WHERE id = $1',
      [sessionId]
    )
    return rows[0] || null
  }

  static async getAllByUser(userId, limit = 20) {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT * FROM sessions WHERE user_id = $1
       ORDER BY started_at DESC LIMIT $2`,
      [userId, limit]
    )
    return rows
  }

  static async saveCognitiveStateLabel({ sessionId, userId, label, confidence, timestamp }) {
    const pool = getPool()
    await pool.query(
      `INSERT INTO cognitive_labels (session_id, user_id, label, confidence, labeled_at)
       VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))`,
      [sessionId, userId, label, confidence, timestamp]
    )
  }

  static async getLabelsBySession(sessionId) {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT * FROM cognitive_labels WHERE session_id = $1 ORDER BY labeled_at ASC`,
      [sessionId]
    )
    return rows
  }
}

module.exports = SessionService