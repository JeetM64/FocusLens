const TelemetryService = require('./telemetryService')
const MLService = require('./mlService')
const { getRedis } = require('../db/redis')
const logger = require('../utils/logger')

/**
 * AdaptiveEngine
 *
 * Flow:
 *  1. Get feature window for session
 *  2. Call ML service for prediction (falls back to rule-based if offline)
 *  3. Map prediction label → intervention action
 *  4. Enforce cooldown so we don't spam the client
 *  5. Return action to WS server → sent to desktop client
 */

const ACTION_COOLDOWN_MS = 300000  // 5 min per action type

const THRESHOLDS = {
  HIGH_SWITCH_DENSITY:  8,
  HIGH_TYPING_VARIANCE: 40,
  HIGH_IDLE_RATIO:      0.4,
  HIGH_ENTROPY:         2.5,
  LOW_FOCUS_CONTINUITY: 0.15,
  HIGH_CORRECTION_RATE: 0.12
}

class AdaptiveEngine {
  static async evaluate(sessionId, latestEvent) {
    try {
      const features = await TelemetryService.getFeatureWindow(sessionId)
      if (features.eventCount < 5) return null   // not enough data yet

      // Try ML service first
      let label, confidence
      const prediction = await MLService.predict({ ...features, sessionId })

      if (prediction) {
        label      = prediction.label
        confidence = prediction.confidence
      } else {
        // Rule-based fallback
        const result = AdaptiveEngine._ruleClassify(features)
        label      = result.label
        confidence = result.confidence
      }

      const action = AdaptiveEngine._labelToAction(label, confidence, features)
      if (!action) return null

      const clear = await AdaptiveEngine._cooldownClear(sessionId, action.type)
      if (!clear) return null

      await AdaptiveEngine._recordAction(sessionId, action)
      logger.info(`[AdaptiveEngine] ${sessionId.slice(0,8)} → ${action.type} (${label} ${(confidence*100).toFixed(0)}%)`)

      return action

    } catch (err) {
      logger.error('[AdaptiveEngine] Error:', err.message)
      return null
    }
  }

  // ── Rule-based fallback (used before ML model is trained) ──────────────
  static _ruleClassify(features) {
    const { switchDensity, typingVariance, idleRatio, focusContinuity,
            interactionEntropy, meanCorrectionRate } = features

    let focused    = 1.0
    let distracted = 0.0
    let fatigued   = 0.0
    let overloaded = 0.0

    if (switchDensity > THRESHOLDS.HIGH_SWITCH_DENSITY)      { distracted += 2.0; focused -= 1.0 }
    if (interactionEntropy > THRESHOLDS.HIGH_ENTROPY)         { distracted += 1.5 }
    if (focusContinuity < THRESHOLDS.LOW_FOCUS_CONTINUITY)    { distracted += 1.0 }
    if (idleRatio > THRESHOLDS.HIGH_IDLE_RATIO)               { fatigued += 2.5;  focused -= 1.5 }
    if (typingVariance > THRESHOLDS.HIGH_TYPING_VARIANCE &&
        meanCorrectionRate > THRESHOLDS.HIGH_CORRECTION_RATE) { overloaded += 2.0 }

    const scores = { focused, distracted, fatigued, overloaded, neutral: 0.5 }
    const total  = Object.values(scores).reduce((a, b) => a + b, 0)
    const probs  = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v / total]))
    const label  = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0]

    return { label, confidence: probs[label] }
  }

  // ── Map cognitive label → desktop action ───────────────────────────────
  static _labelToAction(label, confidence, features) {
    // Only act if confidence is meaningful
    if (confidence < 0.45) return null

    const actionMap = {
      distracted: { type: 'SUPPRESS_NOTIFICATIONS', threshold: 0.50 },
      fatigued:   { type: 'SUGGEST_BREAK',           threshold: 0.45 },
      overloaded: { type: 'SUGGEST_SIMPLIFY',         threshold: 0.50 }
    }

    const entry = actionMap[label]
    if (!entry || confidence < entry.threshold) return null

    return {
      type:       entry.type,
      label,
      confidence,
      reason:     AdaptiveEngine._buildReason(features),
      features
    }
  }

  static _buildReason(f) {
    const parts = []
    if (f.switchDensity > THRESHOLDS.HIGH_SWITCH_DENSITY)
      parts.push(`${f.switchDensity.toFixed(1)} switches/min`)
    if (f.idleRatio > THRESHOLDS.HIGH_IDLE_RATIO)
      parts.push(`${(f.idleRatio * 100).toFixed(0)}% idle`)
    if (f.interactionEntropy > THRESHOLDS.HIGH_ENTROPY)
      parts.push(`entropy ${f.interactionEntropy.toFixed(2)}`)
    if (f.meanCorrectionRate > THRESHOLDS.HIGH_CORRECTION_RATE)
      parts.push(`correction rate ${(f.meanCorrectionRate * 100).toFixed(0)}%`)
    return parts.join(', ') || 'behavioral pattern detected'
  }

  static async _cooldownClear(sessionId, actionType) {
    const redis = getRedis()
    const key   = `cooldown:${sessionId}:${actionType}`
    const exists = await redis.exists(key)
    return exists === 0
  }

  static async _recordAction(sessionId, action) {
    const redis = getRedis()
    await redis.set(
      `cooldown:${sessionId}:${action.type}`,
      '1',
      'PX',
      ACTION_COOLDOWN_MS
    )

    // Persist for research/analytics
    try {
      const { getPool } = require('../db/postgres')
      await getPool().query(
        `INSERT INTO adaptive_actions (session_id, action_type, reason, features)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, action.type, action.reason, JSON.stringify(action.features)]
      )
    } catch (err) {
      logger.warn('[AdaptiveEngine] Failed to persist action:', err.message)
    }
  }
}

module.exports = AdaptiveEngine