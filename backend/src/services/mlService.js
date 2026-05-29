const config = require('../config/env')
const logger = require('../utils/logger')

/**
 * MLService
 * Bridges the Node.js backend to the Python FastAPI inference service.
 * Called by AdaptiveEngine after feature extraction.
 */
class MLService {
  /**
   * Send a feature window to the ML service and get a prediction back.
   * @param {object} features - output of TelemetryService.getFeatureWindow()
   * @returns {object|null} prediction { label, confidence, probabilities, modelType }
   */
  static async predict(features) {
    try {
      const url = `${config.ml.serviceUrl}/predict`

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
        signal: AbortSignal.timeout(3000)   // 3s timeout — don't block WS loop
      })

      if (!res.ok) {
        logger.warn(`[MLService] HTTP ${res.status} from inference service`)
        return null
      }

      const prediction = await res.json()
      logger.debug(`[MLService] Prediction: ${prediction.label} (${(prediction.confidence * 100).toFixed(0)}%)`)
      return prediction

    } catch (err) {
      // ML service offline is non-fatal — adaptive engine falls back to rules
      logger.warn(`[MLService] Unavailable: ${err.message}`)
      return null
    }
  }

  /**
   * Check if the ML service is running.
   */
  static async healthCheck() {
    try {
      const res = await fetch(`${config.ml.serviceUrl}/health`, {
        signal: AbortSignal.timeout(2000)
      })
      const data = await res.json()
      return { online: true, modelLoaded: data.model_loaded }
    } catch {
      return { online: false, modelLoaded: false }
    }
  }
}

module.exports = MLService