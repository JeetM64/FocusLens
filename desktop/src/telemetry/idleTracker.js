const { powerMonitor } = require('electron')

class IdleTracker {
  constructor(idleThresholdSec = 30) {
    this.idleThresholdSec = idleThresholdSec
    this.isIdle = false
    this.idleStartTime = null
    this.idleDurationMs = 0
    this._pendingTransition = null
    this.intervalHandle = null
  }

  start() {
    // Poll idle state every 5 seconds
    this.intervalHandle = setInterval(() => this._check(), 5000)
  }

  _check() {
    const idleSec = powerMonitor.getSystemIdleTime()
    const wasIdle = this.isIdle

    if (idleSec >= this.idleThresholdSec && !this.isIdle) {
      this.isIdle = true
      this.idleStartTime = Date.now() - (idleSec * 1000)
      this._pendingTransition = {
        type: 'IDLE_START',
        payload: {
          idleThresholdMs: this.idleThresholdSec * 1000,
          idleSec
        }
      }
    } else if (idleSec < this.idleThresholdSec && this.isIdle) {
      this.isIdle = false
      this.idleDurationMs = Date.now() - this.idleStartTime
      this._pendingTransition = {
        type: 'IDLE_END',
        payload: {
          idleDurationMs: this.idleDurationMs
        }
      }
      this.idleStartTime = null
    }

    if (!this.isIdle) {
      this.idleDurationMs = 0
    } else if (this.idleStartTime) {
      this.idleDurationMs = Date.now() - this.idleStartTime
    }
  }

  flushTransition() {
    const t = this._pendingTransition
    this._pendingTransition = null
    return t
  }

  getStats() {
    return {
      isIdle: this.isIdle,
      idleDurationMs: this.idleDurationMs,
      idleThresholdSec: this.idleThresholdSec
    }
  }

  stop() {
    clearInterval(this.intervalHandle)
  }
}

module.exports = IdleTracker