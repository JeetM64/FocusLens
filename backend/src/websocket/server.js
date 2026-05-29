const { WebSocketServer } = require('ws')
const logger = require('../utils/logger')
const TelemetryService = require('../services/telemetryService')
const SessionService = require('../services/sessionService')
const AdaptiveEngine = require('../services/adaptiveEngine')

class WSServer {
  constructor({ port }) {
    this.port = port
    this.wss = null
    this.clients = new Map()  // sessionId → ws
  }

  async start() {
    this.wss = new WebSocketServer({ port: this.port })

    this.wss.on('connection', (ws, req) => {
      const sessionId = req.headers['x-session-id'] || 'unknown'
      const userId = req.headers['x-user-id'] || 'anonymous'

      logger.info(`[WS] Client connected: session=${sessionId}`)
      this.clients.set(sessionId, ws)

      ws.on('message', async (raw) => {
        try {
          const event = JSON.parse(raw)
          await this._handleEvent(event, ws, sessionId, userId)
        } catch (err) {
          logger.error('[WS] Message parse error:', err.message)
        }
      })

      ws.on('close', () => {
        logger.info(`[WS] Client disconnected: session=${sessionId}`)
        this.clients.delete(sessionId)
      })

      ws.on('error', (err) => {
        logger.error(`[WS] Client error (${sessionId}):`, err.message)
      })

      // Confirm connection
      this._send(ws, { type: 'ACK', message: 'Connected to FocusLens backend' })
    })

    logger.info(`[WS] Server listening on port ${this.port}`)
  }

  async _handleEvent(event, ws, sessionId, userId) {
    // HANDSHAKE — register session
    if (event.type === 'HANDSHAKE') {
      await SessionService.createOrResume({ sessionId, userId })
      this._send(ws, { type: 'ACK', message: 'Session registered' })
      return
    }

    // Validate event has required fields
    if (!event.type || !event.timestamp) {
      logger.warn('[WS] Invalid event received:', event)
      return
    }

    // Persist telemetry event to MongoDB
    await TelemetryService.ingest(event)

    // Run adaptive engine on every CONTEXT_SNAPSHOT
    if (event.type === 'CONTEXT_SNAPSHOT' || event.type === 'TYPING_SNAPSHOT') {
      const action = await AdaptiveEngine.evaluate(sessionId, event)
      if (action) {
        this._send(ws, { type: 'ACTION', action })
      }
    }
  }

  _send(ws, data) {
    try {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify(data))
      }
    } catch (err) {
      logger.error('[WS] Send error:', err.message)
    }
  }

  broadcast(data) {
    this.clients.forEach((ws) => this._send(ws, data))
  }

  getConnectedCount() {
    return this.clients.size
  }
}

module.exports = WSServer