const mongoose = require('mongoose')

const telemetryEventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'APP_SWITCH', 'TYPING_SNAPSHOT', 'IDLE_START', 'IDLE_END',
      'CONTEXT_SNAPSHOT', 'STATE_LABEL', 'SYSTEM_SUSPEND',
      'SYSTEM_RESUME', 'SESSION_START', 'SESSION_END'
    ]
  },
  timestamp: { type: Number, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  collection: 'telemetry_events',
  versionKey: false
})

// Compound index for the most common query pattern
telemetryEventSchema.index({ sessionId: 1, timestamp: -1 })
telemetryEventSchema.index({ sessionId: 1, type: 1, timestamp: -1 })

// Auto-expire raw events after 90 days to save space
telemetryEventSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 }
)

module.exports = mongoose.model('TelemetryEvent', telemetryEventSchema)