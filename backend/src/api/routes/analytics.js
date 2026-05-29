const router = require('express').Router()
const TelemetryService = require('../../services/telemetryService')
const SessionService = require('../../services/sessionService')
const TelemetryEvent = require('../../models/TelemetryEvent')

// GET /api/analytics/:sessionId/summary
// Full session summary: event counts, feature window, label distribution
router.get('/:sessionId/summary', async (req, res) => {
  try {
    const { sessionId } = req.params

    const [session, features, labels] = await Promise.all([
      SessionService.getById(sessionId),
      TelemetryService.getFeatureWindow(sessionId),
      SessionService.getLabelsBySession(sessionId)
    ])

    // Label distribution
    const labelDist = labels.reduce((acc, l) => {
      acc[l.label] = (acc[l.label] || 0) + 1
      return acc
    }, {})

    res.json({
      session,
      features,
      labels: { count: labels.length, distribution: labelDist }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/analytics/:sessionId/timeline
// Hourly feature windows for the session — powers the dashboard chart
router.get('/:sessionId/timeline', async (req, res) => {
  try {
    const { sessionId } = req.params
    const session = await SessionService.getById(sessionId)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const startMs = new Date(session.started_at).getTime()
    const endMs = session.ended_at ? new Date(session.ended_at).getTime() : Date.now()
    const windowMs = 300000 // 5-min buckets

    const buckets = []
    for (let t = startMs; t < endMs; t += windowMs) {
      const events = await TelemetryEvent.find({
        sessionId,
        timestamp: { $gte: t, $lt: t + windowMs }
      }).lean()

      if (events.length > 0) {
        buckets.push({
          windowStart: t,
          ...TelemetryService._computeFeatures(events, windowMs)
        })
      }
    }

    res.json({ timeline: buckets, windowMs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/analytics/:sessionId/export
// Export labeled dataset row — used for ML training
router.get('/:sessionId/export', async (req, res) => {
  try {
    const { sessionId } = req.params
    const labels = await SessionService.getLabelsBySession(sessionId)
    const windowMs = 300000

    const rows = []
    for (const label of labels) {
      const labelTime = new Date(label.labeled_at).getTime()
      const windowStart = labelTime - windowMs

      const events = await TelemetryEvent.find({
        sessionId,
        timestamp: { $gte: windowStart, $lt: labelTime }
      }).lean()

      if (events.length > 5) {
        const features = TelemetryService._computeFeatures(events, windowMs)
        rows.push({
          sessionId,
          labeledAt: label.labeled_at,
          label: label.label,
          confidence: label.confidence,
          ...features
        })
      }
    }

    res.json({ rows, count: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router