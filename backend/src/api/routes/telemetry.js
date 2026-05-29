const router = require('express').Router()
const TelemetryService = require('../../services/telemetryService')
const SessionService = require('../../services/sessionService')

// GET /api/telemetry/:sessionId/events
router.get('/:sessionId/events', async (req, res) => {
  try {
    const { sessionId } = req.params
    const { limit = 100, type } = req.query
    const events = await TelemetryService.getBySession(sessionId, { limit: parseInt(limit), type })
    res.json({ events, count: events.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/telemetry/:sessionId/features
// Returns the current 5-min feature window — used by ML service
router.get('/:sessionId/features', async (req, res) => {
  try {
    const { sessionId } = req.params
    const { windowMs = 300000 } = req.query
    const features = await TelemetryService.getFeatureWindow(sessionId, parseInt(windowMs))
    res.json(features)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/telemetry/:sessionId/live
// Returns real-time state from Redis
router.get('/:sessionId/live', async (req, res) => {
  try {
    const state = await TelemetryService.getLiveState(req.params.sessionId)
    res.json(state || {})
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/telemetry/:sessionId/label
// Manual cognitive state label submission
router.post('/:sessionId/label', async (req, res) => {
  try {
    const { sessionId } = req.params
    const { label, confidence, userId } = req.body

    if (!['focused', 'distracted', 'fatigued', 'overloaded', 'neutral'].includes(label)) {
      return res.status(400).json({ error: 'Invalid label value' })
    }

    await SessionService.saveCognitiveStateLabel({
      sessionId,
      userId: userId || 'anonymous',
      label,
      confidence: parseInt(confidence) || 3,
      timestamp: Date.now()
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router