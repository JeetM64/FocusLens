const { v4: uuidv4 } = require('uuid')
const store = require('../config/store')

class SessionManager {
  constructor() {
    this.id = uuidv4()
    this.startTime = null
    this.endTime = null
    this.labelCount = 0
    this.eventCount = 0
  }

  async start() {
    this.startTime = Date.now()

    // Persist session history
    const history = store.get('sessions', [])
    history.push({ id: this.id, startTime: this.startTime })
    store.set('sessions', history.slice(-50)) // keep last 50 sessions

    console.log(`[SessionManager] Session started: ${this.id}`)
    return this
  }

  end() {
    this.endTime = Date.now()
    const history = store.get('sessions', [])
    const idx = history.findIndex(s => s.id === this.id)
    if (idx !== -1) {
      history[idx].endTime = this.endTime
      history[idx].durationMs = this.endTime - this.startTime
      store.set('sessions', history)
    }
    console.log(`[SessionManager] Session ended: ${this.id} — ${this.durationMs()}ms`)
  }

  durationMs() {
    return (this.endTime || Date.now()) - this.startTime
  }

  toJSON() {
    return {
      id: this.id,
      startTime: this.startTime,
      durationMs: this.durationMs(),
      labelCount: this.labelCount,
      eventCount: this.eventCount
    }
  }
}

module.exports = SessionManager