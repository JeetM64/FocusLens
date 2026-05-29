const router = require('express').Router()
const SessionService = require('../../services/sessionService')

// GET /api/sessions/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const sessions = await SessionService.getAllByUser(req.params.userId)
    res.json({ sessions })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/sessions/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await SessionService.getById(req.params.sessionId)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    res.json(session)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/sessions/:sessionId/labels
router.get('/:sessionId/labels', async (req, res) => {
  try {
    const labels = await SessionService.getLabelsBySession(req.params.sessionId)
    res.json({ labels })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/sessions/:sessionId/end
router.patch('/:sessionId/end', async (req, res) => {
  try {
    await SessionService.end(req.params.sessionId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

// GET /api/sessions/latest — returns the most recent active session (any user)
router.get('/latest', async (req, res) => {
  try {
    const { getPool } = require('../../db/postgres')
    const { rows } = await getPool().query(
      `SELECT * FROM sessions ORDER BY started_at DESC LIMIT 1`
    )
    if (!rows[0]) return res.status(404).json({ error: 'No sessions found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})