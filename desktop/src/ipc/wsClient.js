const WebSocket = require('ws')

const MAX_QUEUE = 500
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]

class WSClient {
  constructor({ url, sessionId, userId }) {
    this.url = url
    this.sessionId = sessionId
    this.userId = userId || 'anonymous'
    this.ws = null
    this.connected = false
    this.queue = []          // buffer events while disconnected
    this.reconnectAttempt = 0
    this.reconnectHandle = null
    this.intentionalClose = false
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`[WSClient] Connecting to ${this.url}`)

      this.ws = new WebSocket(this.url, {
        headers: {
          'x-session-id': this.sessionId,
          'x-user-id': this.userId
        }
      })

      this.ws.on('open', () => {
        console.log('[WSClient] Connected')
        this.connected = true
        this.reconnectAttempt = 0

        // Flush queued events
        this._flushQueue()

        // Send session handshake
        this._send({
          type: 'HANDSHAKE',
          sessionId: this.sessionId,
          userId: this.userId,
          timestamp: Date.now()
        })

        resolve()
      })

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data)
          this._handleMessage(msg)
        } catch {}
      })

      this.ws.on('close', (code, reason) => {
        this.connected = false
        console.log(`[WSClient] Disconnected (${code})`)
        if (!this.intentionalClose) this._scheduleReconnect()
      })

      this.ws.on('error', (err) => {
        console.error('[WSClient] Error:', err.message)
        if (!this.connected) resolve() // don't hang startup
      })
    })
  }

  send(event) {
    if (this.connected) {
      this._send(event)
    } else {
      // Queue with cap to avoid unbounded memory
      if (this.queue.length < MAX_QUEUE) {
        this.queue.push(event)
      }
    }
  }

  _send(data) {
    try {
      this.ws.send(JSON.stringify(data))
    } catch (err) {
      console.error('[WSClient] Send error:', err.message)
    }
  }

  _flushQueue() {
    console.log(`[WSClient] Flushing ${this.queue.length} queued events`)
    while (this.queue.length > 0) {
      this._send(this.queue.shift())
    }
  }

  _handleMessage(msg) {
    // Backend can push adaptive actions back to the desktop
    if (msg.type === 'ACTION') {
      console.log('[WSClient] Received action:', msg.action)
      // Emit to main process via event — handled in main.js
      require('electron').ipcMain.emit('action:received', null, msg)
    }
  }

  _scheduleReconnect() {
    const delay = RECONNECT_DELAYS[
      Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)
    ]
    this.reconnectAttempt++
    console.log(`[WSClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`)
    this.reconnectHandle = setTimeout(() => this.connect(), delay)
  }

  disconnect() {
    this.intentionalClose = true
    clearTimeout(this.reconnectHandle)
    if (this.ws) this.ws.close()
  }

  getStatus() {
    return {
      connected: this.connected,
      queuedEvents: this.queue.length,
      reconnectAttempt: this.reconnectAttempt,
      url: this.url
    }
  }
}

module.exports = WSClient