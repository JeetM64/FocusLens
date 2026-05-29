const { app, BrowserWindow, ipcMain, Notification, powerMonitor } = require('electron')
const path = require('path')
const TelemetryCollector = require('./telemetry/collector')
const EventEmitter = require('./events/emitter')
const WSClient = require('./ipc/wsClient')
const SessionManager = require('./utils/sessionManager')
const store = require('./config/store')

let mainWindow = null
let trayWindow = null
let collector = null
let wsClient = null
let session = null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'ipc/preload.js')
    }
  })

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

  if (process.env.DEV_MODE === 'true') {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

async function initTelemetry() {
  session = new SessionManager()
  await session.start()

  wsClient = new WSClient({
    url: process.env.BACKEND_WS_URL || 'ws://localhost:3002',
    sessionId: session.id,
    userId: store.get('userId')
  })

  await wsClient.connect()

  collector = new TelemetryCollector({
    intervalMs: parseInt(process.env.TELEMETRY_INTERVAL_MS) || 1000,
    onEvent: (event) => {
      // Send to backend via WebSocket
      wsClient.send(event)
      // Forward to renderer for live display
      if (mainWindow) {
        mainWindow.webContents.send('telemetry:event', event)
      }
    }
  })

  // Critical: tag all events with the correct session ID
  collector.sessionId = session.id

  collector.start()

  // Power monitor events
  powerMonitor.on('suspend', () => {
    collector.pause()
    wsClient.send(EventEmitter.system('SYSTEM_SUSPEND', session.id))
  })

  powerMonitor.on('resume', () => {
    collector.resume()
    wsClient.send(EventEmitter.system('SYSTEM_RESUME', session.id))
  })

  // Periodic self-labeling prompt (every 20 min)
  const labelInterval = parseInt(process.env.SESSION_LABEL_INTERVAL_MS) || 1200000
  setInterval(() => {
    if (mainWindow) {
      mainWindow.webContents.send('prompt:label', { timestamp: Date.now() })
      new Notification({
        title: 'FocusLens',
        body: 'How focused are you right now?'
      }).show()
    }
  }, labelInterval)
}

// IPC handlers
ipcMain.handle('session:info', () => session?.toJSON())
ipcMain.handle('telemetry:status', () => collector?.getStatus())
ipcMain.handle('ws:status', () => wsClient?.getStatus())

ipcMain.on('label:submit', (event, payload) => {
  const labelEvent = EventEmitter.build('STATE_LABEL', session.id, payload)
  wsClient.send(labelEvent)
  collector.recordLabel(payload)
})

ipcMain.on('session:end', () => {
  collector?.stop()
  wsClient?.send(EventEmitter.system('SESSION_END', session.id))
  wsClient?.disconnect()
})

app.whenReady().then(async () => {
  require('dotenv').config({ path: path.join(__dirname, '../.env') })
  createMainWindow()
  await initTelemetry()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    collector?.stop()
    wsClient?.disconnect()
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})