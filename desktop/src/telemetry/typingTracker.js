/**
 * TypingTracker
 * Hooks into globalShortcut / uiohook-napi for keystroke events.
 * Measures: WPM, burst patterns, pause frequency, correction rate.
 */

let uiohook
try {
  uiohook = require('uiohook-napi')
} catch {
  // uiohook not available — use mock in dev
  uiohook = null
}

class TypingTracker {
  constructor() {
    this.keystrokes = []
    this.corrections = 0  // backspace count
    this.windowStart = Date.now()
    this.lastKeyTime = null
    this.bursts = []
    this.currentBurstStart = null
    this.BURST_GAP_MS = 1500  // gap > 1.5s = new burst
    this.running = false
  }

  start() {
    this.running = true
    this.windowStart = Date.now()

    if (uiohook) {
      uiohook.on('keydown', (e) => this._onKey(e))
      uiohook.start()
    } else {
      console.warn('[TypingTracker] uiohook not available — using mock data')
      this._startMock()
    }
  }

  _onKey(event) {
    const now = Date.now()
    const gap = this.lastKeyTime ? now - this.lastKeyTime : 0

    // Track corrections (backspace = keycode 14)
    if (event.keycode === 14) {
      this.corrections++
    }

    // Burst detection
    if (gap > this.BURST_GAP_MS || !this.currentBurstStart) {
      if (this.currentBurstStart) {
        this.bursts.push({
          start: this.currentBurstStart,
          end: this.lastKeyTime,
          duration: this.lastKeyTime - this.currentBurstStart
        })
      }
      this.currentBurstStart = now
    }

    this.keystrokes.push({ time: now, gap })
    this.lastKeyTime = now
  }

  _startMock() {
    // Simulate realistic typing for development
    this._mockHandle = setInterval(() => {
      if (Math.random() > 0.3) {
        const mockEvent = { keycode: Math.random() > 0.05 ? 65 : 14 }
        this._onKey(mockEvent)
      }
    }, 200 + Math.random() * 400)
  }

  flush() {
    const now = Date.now()
    const windowMs = now - this.windowStart
    const count = this.keystrokes.length

    if (count === 0) {
      this.windowStart = now
      return { keystrokesInWindow: 0, wordsPerMinute: 0, burstCount: 0, pauseCount: 0, longestPauseMs: 0, correctionRate: 0, typingVariance: 0 }
    }

    const gaps = this.keystrokes.map(k => k.gap).filter(g => g > 0)
    const pauses = gaps.filter(g => g > 1000)
    const longestPause = pauses.length ? Math.max(...pauses) : 0

    // Variance of inter-key intervals (signal for consistency)
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const variance = gaps.reduce((a, b) => a + Math.pow(b - meanGap, 2), 0) / gaps.length

    const wordsPerMinute = Math.round((count / 5) / (windowMs / 60000))
    const correctionRate = count > 0 ? this.corrections / count : 0

    // Reset window
    const result = {
      keystrokesInWindow: count,
      wordsPerMinute,
      burstCount: this.bursts.length,
      pauseCount: pauses.length,
      longestPauseMs: longestPause,
      correctionRate: parseFloat(correctionRate.toFixed(3)),
      typingVariance: parseFloat(Math.sqrt(variance).toFixed(2))
    }

    this.keystrokes = []
    this.corrections = 0
    this.bursts = []
    this.currentBurstStart = null
    this.windowStart = now

    return result
  }

  getStatus() {
    return {
      running: this.running,
      keystrokeCount: this.keystrokes.length
    }
  }

  stop() {
    this.running = false
    if (uiohook) uiohook.stop()
    if (this._mockHandle) clearInterval(this._mockHandle)
  }
}

module.exports = TypingTracker