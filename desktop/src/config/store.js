const Store = require('electron-store')
const { v4: uuidv4 } = require('uuid')

const store = new Store({
  name: 'focuslens-config',
  defaults: {
    userId: uuidv4(),       // generated once, persists forever
    sessions: [],
    settings: {
      telemetryIntervalMs: 1000,
      labelIntervalMs: 1200000,
      idleThresholdSec: 30,
      backendUrl: 'http://localhost:3001',
      wsUrl: 'ws://localhost:3002'
    }
  }
})

module.exports = store