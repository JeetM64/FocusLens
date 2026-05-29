const { v4: uuidv4 } = require('uuid')

const VALID_TYPES = new Set([
  'APP_SWITCH',
  'TYPING_SNAPSHOT',
  'IDLE_START',
  'IDLE_END',
  'CONTEXT_SNAPSHOT',
  'STATE_LABEL',
  'SYSTEM_SUSPEND',
  'SYSTEM_RESUME',
  'SESSION_START',
  'SESSION_END'
])

class EventEmitter {
  /**
   * Build a standard telemetry event envelope.
   */
  static build(type, sessionId, payload = {}) {
    if (!VALID_TYPES.has(type)) {
      throw new Error(`[EventEmitter] Unknown event type: ${type}`)
    }

    return {
      id: uuidv4(),
      sessionId: sessionId || 'unknown',
      type,
      timestamp: Date.now(),
      payload
    }
  }

  /**
   * Shorthand for system-level events (no payload customization needed).
   */
  static system(type, sessionId) {
    return EventEmitter.build(type, sessionId, { source: 'system' })
  }

  /**
   * Validate an event object has required fields.
   */
  static validate(event) {
    const required = ['id', 'sessionId', 'type', 'timestamp', 'payload']
    for (const field of required) {
      if (event[field] === undefined) {
        return { valid: false, error: `Missing field: ${field}` }
      }
    }
    if (!VALID_TYPES.has(event.type)) {
      return { valid: false, error: `Invalid type: ${event.type}` }
    }
    return { valid: true }
  }
}

module.exports = EventEmitter