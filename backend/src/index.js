require('dotenv').config()
const express = require('express')
const http = require('http')
const cors = require('cors')
const logger = require('./utils/logger')
const { connectPostgres } = require('./db/postgres')
const { connectMongo } = require('./db/mongo')
const { connectRedis } = require('./db/redis')
const WSServer = require('./websocket/server')
const telemetryRoutes = require('./api/routes/telemetry')
const sessionRoutes = require('./api/routes/sessions')
const analyticsRoutes = require('./api/routes/analytics')
const errorHandler = require('./api/middleware/errorHandler')

const app = express()
const server = http.createServer(app)

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`)
  next()
})

// Routes
app.use('/api/telemetry', telemetryRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/analytics', analyticsRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})


// Progress tracker UI — open http://localhost:3001/progress in browser
app.get('/progress', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../../progress.html'))
})

app.use(errorHandler)

// WebSocket server (separate port)
const wsServer = new WSServer({ server: null, port: parseInt(process.env.WS_PORT) || 3002 })

async function start() {
  try {
    await connectPostgres()
    await connectMongo()
    await connectRedis()

    const PORT = parseInt(process.env.PORT) || 3001
    server.listen(PORT, () => {
      logger.info(`HTTP server running on port ${PORT}`)
    })

    await wsServer.start()
    logger.info(`WebSocket server running on port ${process.env.WS_PORT || 3002}`)

  } catch (err) {
    logger.error('Startup failed:', err)
    process.exit(1)
  }
}

start()

module.exports = { app, server }