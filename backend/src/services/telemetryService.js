const TelemetryEvent = require('../models/TelemetryEvent')
const { getRedis } = require('../db/redis')
const logger = require('../utils/logger')

class TelemetryService {
  /**
   * Persist a single telemetry event to MongoDB.
   * Also update live session state in Redis.
   */
  static async ingest(event) {
    try {
      // Save to MongoDB
      await TelemetryEvent.create(event)

      // Update live state in Redis (TTL 24h)
      const redis = getRedis()
      const key = `session:${event.sessionId}:live`
      await redis.hset(key, {
        lastEventType: event.type,
        lastEventTime: event.timestamp,
        ...(event.type === 'CONTEXT_SNAPSHOT' ? {
          activeApp: event.payload.activeApp,
          switchesInLastMinute: event.payload.switchesInLastMinute,
          focusStreakMs: event.payload.focusStreakMs,
          isIdle: event.payload.isIdle ? '1' : '0'
        } : {}),
        ...(event.type === 'TYPING_SNAPSHOT' ? {
          wpm: event.payload.wordsPerMinute,
          typingVariance: event.payload.typingVariance,
          correctionRate: event.payload.correctionRate
        } : {})
      })
      await redis.expire(key, 86400)

    } catch (err) {
      logger.error('[TelemetryService] Ingest error:', err.message)
    }
  }

  /**
   * Get recent events for a session.
   */
  static async getBySession(sessionId, { limit = 100, type = null } = {}) {
    const query = { sessionId }
    if (type) query.type = type
    return TelemetryEvent
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
  }

  /**
   * Get a 5-minute feature window for ML inference.
   * Returns aggregated stats over the window.
   */
  static async getFeatureWindow(sessionId, windowMs = 300000) {
    const since = Date.now() - windowMs

    const events = await TelemetryEvent
      .find({
        sessionId,
        timestamp: { $gte: since }
      })
      .lean()

    return TelemetryService._computeFeatures(events, windowMs)
  }

  static _computeFeatures(events, windowMs) {
    const snapshots = events.filter(e => e.type === 'CONTEXT_SNAPSHOT')
    const typingEvents = events.filter(e => e.type === 'TYPING_SNAPSHOT')
    const switches = events.filter(e => e.type === 'APP_SWITCH')
    const idleEvents = events.filter(e => e.type === 'IDLE_START')

    // Switch density: switches per minute
    const switchDensity = switches.length / (windowMs / 60000)

    // Typing variance: std dev of WPM samples
    const wpms = typingEvents.map(e => e.payload.wordsPerMinute)
    const meanWpm = wpms.length ? wpms.reduce((a, b) => a + b, 0) / wpms.length : 0
    const typingVariance = wpms.length
      ? Math.sqrt(wpms.reduce((a, b) => a + Math.pow(b - meanWpm, 2), 0) / wpms.length)
      : 0

    // Idle ratio
    const idleMs = idleEvents.reduce((sum, e) => sum + (e.payload.idleDurationMs || 0), 0)
    const idleRatio = idleMs / windowMs

    // Focus continuity: longest streak without a switch
    const maxStreak = snapshots.length
      ? Math.max(...snapshots.map(e => e.payload.focusStreakMs || 0))
      : 0
    const focusContinuity = maxStreak / windowMs

    // Correction rate (mean)
    const corrRates = typingEvents.map(e => e.payload.correctionRate || 0)
    const meanCorrectionRate = corrRates.length
      ? corrRates.reduce((a, b) => a + b, 0) / corrRates.length
      : 0

    // Interaction entropy: diversity of apps used
    const appCounts = {}
    switches.forEach(e => {
      const app = e.payload.toApp || 'unknown'
      appCounts[app] = (appCounts[app] || 0) + 1
    })
    const total = Object.values(appCounts).reduce((a, b) => a + b, 0)
    const entropy = total > 0
      ? -Object.values(appCounts).reduce((sum, count) => {
          const p = count / total
          return sum + p * Math.log2(p)
        }, 0)
      : 0

    return {
      windowMs,
      eventCount: events.length,
      switchDensity: parseFloat(switchDensity.toFixed(3)),
      typingVariance: parseFloat(typingVariance.toFixed(2)),
      meanWpm: parseFloat(meanWpm.toFixed(1)),
      idleRatio: parseFloat(idleRatio.toFixed(3)),
      focusContinuity: parseFloat(focusContinuity.toFixed(3)),
      meanCorrectionRate: parseFloat(meanCorrectionRate.toFixed(3)),
      interactionEntropy: parseFloat(entropy.toFixed(3)),
      uniqueApps: Object.keys(appCounts).length,
      computedAt: Date.now()
    }
  }

  /**
   * Get live session state from Redis.
   */
  static async getLiveState(sessionId) {
    const redis = getRedis()
    return redis.hgetall(`session:${sessionId}:live`)
  }
}

module.exports = TelemetryService