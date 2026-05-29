const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('focusLens', {
  // One-way: renderer → main
  submitLabel: (payload) => ipcRenderer.send('label:submit', payload),
  endSession: () => ipcRenderer.send('session:end'),

  // Two-way: renderer asks main for data
  getSessionInfo: () => ipcRenderer.invoke('session:info'),
  getTelemetryStatus: () => ipcRenderer.invoke('telemetry:status'),
  getWSStatus: () => ipcRenderer.invoke('ws:status'),

  // Subscriptions: main → renderer
  onTelemetryEvent: (cb) => ipcRenderer.on('telemetry:event', (_, event) => cb(event)),
  onLabelPrompt: (cb) => ipcRenderer.on('prompt:label', (_, data) => cb(data)),
  onActionReceived: (cb) => ipcRenderer.on('action:received', (_, action) => cb(action)),

  // Cleanup
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
})