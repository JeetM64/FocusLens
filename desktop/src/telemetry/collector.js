const activeWin = require('active-win')
const { powerMonitor } = require('electron')
const EventEmitter = require('../events/emitter')
const TypingTracker = require('./typingTracker')
const IdleTracker = require('./idleTracker')
const WindowTracker = require('./windowTracker')

class TelemetryCollector {
  constructor({ intervalMs = 1000, onEvent }) {
    this.intervalMs = intervalMs
    this.onEvent = onEvent
    this.running = false
    this.paused = false
    this.intervalHandle = null

    this.typing = new TypingTracker()
    this.idle = new IdleTracker()
    this.window = new WindowTracker()

    this.lastLabel = null
    this.snapshotCount = 0
  }

  start() {
    if (this.running) return
    this.running = true

    this.typing.start()
    this.idle.start()

    this.intervalHandle = setInterval(() => {
      if (!this.paused) this._tick()
    }, this.intervalMs)

    console.log(`[TelemetryCollector] Started — interval ${this.intervalMs}ms`)
  }

  async _tick() {
    try {
      this.snapshotCount++
      const winInfo = await activeWin()
      const typingStats = this.typing.flush()
      const idleStats = this.idle.getStats()

      // Window switch event
      const switchEvent = this.window.update(winInfo)
      if (switchEvent) {
        this.onEvent(switchEvent)
      }

      // Context snapshot every tick
      const snapshot = EventEmitter.build('CONTEXT_SNAPSHOT', this._sessionId, {
        activeApp: winInfo?.owner?.name || 'unknown',
        activeWindowTitle: winInfo?.title || '',
        switchesInLastMinute: this.window.switchesInLastMinute(),
        focusStreakMs: this.window.currentStreakMs(),
        isIdle: idleStats.isIdle,
        idleDurationMs: idleStats.idleDurationMs
      })
      this.onEvent(snapshot)

      // Typing snapshot if there was activity
      if (typingStats.keystrokesInWindow > 0) {
        const typingEvent = EventEmitter.build('TYPING_SNAPSHOT', this._sessionId, typingStats)
        this.onEvent(typingEvent)
      }

      // Idle transitions
      const idleEvent = this.idle.flushTransition()
      if (idleEvent) {
        this.onEvent(EventEmitter.build(idleEvent.type, this._sessionId, idleEvent.payload))
      }

    } catch (err) {
      console.error('[TelemetryCollector] Tick error:', err.message)
    }
  }

  pause() {
    this.paused = true
    console.log('[TelemetryCollector] Paused')
  }

  resume() {
    this.paused = false
    console.log('[TelemetryCollector] Resumed')
  }

  stop() {
    this.running = false
    clearInterval(this.intervalHandle)
    this.typing.stop()
    this.idle.stop()
    console.log('[TelemetryCollector] Stopped')
  }

  recordLabel(payload) {
    this.lastLabel = { ...payload, timestamp: Date.now() }
  }

  set sessionId(id) {
    this._sessionId = id
  }

  getStatus() {
    return {
      running: this.running,
      paused: this.paused,
      snapshotCount: this.snapshotCount,
      lastLabel: this.lastLabel,
      typing: this.typing.getStatus(),
      idle: this.idle.getStats()
    }
  }
}

module.exports = TelemetryCollector