const EventEmitter = require('../events/emitter')

class WindowTracker {
  constructor() {
    this.currentApp = null
    this.currentTitle = null
    this.appStartTime = null
    this.switchLog = []           // rolling log of switches for rate calc
    this.streakStart = Date.now() // current uninterrupted focus streak
    this.sessionId = null
  }

  /**
   * Called every tick with the latest activeWin result.
   * Returns an APP_SWITCH event if the app changed, null otherwise.
   */
  update(winInfo) {
    if (!winInfo) return null

    const appName = winInfo?.owner?.name || 'unknown'
    const title = winInfo?.title || ''

    // No change
    if (appName === this.currentApp) return null

    const now = Date.now()
    const durationMs = this.appStartTime ? now - this.appStartTime : 0

    const switchEvent = this.currentApp
      ? EventEmitter.build('APP_SWITCH', this.sessionId, {
          fromApp: this.currentApp,
          fromTitle: this.currentTitle,
          toApp: appName,
          toTitle: title,
          durationMs
        })
      : null

    // Log the switch for rate calculation (keep last 60 sec only)
    this.switchLog.push(now)
    this._pruneLog()

    // Update state
    this.currentApp = appName
    this.currentTitle = title
    this.appStartTime = now

    // Reset streak on every switch
    this.streakStart = now

    return switchEvent
  }

  _pruneLog() {
    const cutoff = Date.now() - 60000
    this.switchLog = this.switchLog.filter(t => t > cutoff)
  }

  switchesInLastMinute() {
    this._pruneLog()
    return this.switchLog.length
  }

  currentStreakMs() {
    return Date.now() - this.streakStart
  }

  setSessionId(id) {
    this.sessionId = id
  }
}

module.exports = WindowTracker