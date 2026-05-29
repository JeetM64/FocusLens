/**
 * FocusLens Renderer
 * Runs in the Electron renderer process (no Node access — uses preload bridge).
 */

const STATE_COLORS = {
  focused:    { dot: '#4ade80', border: '#2a6b2a' },
  distracted: { dot: '#fb923c', border: '#6b4a1a' },
  fatigued:   { dot: '#60a5fa', border: '#1a3a6b' },
  overloaded: { dot: '#f87171', border: '#6b1a1a' },
  neutral:    { dot: '#888',    border: '#444'    }
}

// ── State ──────────────────────────────────────────────────────────────────
let selectedLabel = null
let latestState   = {}
let eventCount    = 0

// ── DOM refs ───────────────────────────────────────────────────────────────
const statusDot    = document.getElementById('status-dot')
const statusLabel  = document.getElementById('status-label')
const statusConf   = document.getElementById('status-conf')
const statStreak   = document.getElementById('stat-streak')
const statSwitches = document.getElementById('stat-switches')
const statWpm      = document.getElementById('stat-wpm')
const statApp      = document.getElementById('stat-app')
const eventFeed    = document.getElementById('event-feed')
const labelBtn     = document.getElementById('label-btn')
const labelModal   = document.getElementById('label-modal')
const modalSubmit  = document.getElementById('modal-submit')
const modalCancel  = document.getElementById('modal-cancel')
const wsDot        = document.getElementById('ws-dot')
const wsText       = document.getElementById('ws-text')
const statusPill   = document.getElementById('status-pill')

// ── Telemetry event listener ───────────────────────────────────────────────
window.focusLens.onTelemetryEvent((event) => {
  eventCount++
  appendFeedItem(event)

  if (event.type === 'CONTEXT_SNAPSHOT') {
    const p = event.payload
    latestState = p

    statStreak.textContent   = p.focusStreakMs ? Math.round(p.focusStreakMs / 60000) : '0'
    statSwitches.textContent = p.switchesInLastMinute ?? '0'
    statApp.textContent      = truncate(p.activeApp, 10)

    // Poll WS status every 10 events
    if (eventCount % 10 === 0) refreshWSStatus()
  }

  if (event.type === 'TYPING_SNAPSHOT') {
    statWpm.textContent = event.payload.wordsPerMinute ?? '—'
  }
})

// ── Label prompt from main process ────────────────────────────────────────
window.focusLens.onLabelPrompt(() => openModal())

// ── Adaptive action from backend ──────────────────────────────────────────
window.focusLens.onActionReceived((msg) => {
  const action = msg.action
  showActionBanner(action.type, action.reason)

  // Update state pill with backend's assessment
  const label = actionToLabel(action.type)
  if (label) updateStatePill(label, null)
})

// ── Label modal ────────────────────────────────────────────────────────────
labelBtn.addEventListener('click', openModal)

document.querySelectorAll('.lbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lbtn').forEach(b => b.classList.remove('selected'))
    btn.classList.add('selected')
    selectedLabel = btn.dataset.label
    modalSubmit.disabled = false
  })
})

modalCancel.addEventListener('click', closeModal)

modalSubmit.addEventListener('click', () => {
  if (!selectedLabel) return
  window.focusLens.submitLabel({ label: selectedLabel, confidence: 3 })
  closeModal()
  showActionBanner('LABEL_SAVED', `Labeled as: ${selectedLabel}`)
})

function openModal() {
  selectedLabel = null
  modalSubmit.disabled = true
  document.querySelectorAll('.lbtn').forEach(b => b.classList.remove('selected'))
  labelModal.classList.add('open')
}

function closeModal() {
  labelModal.classList.remove('open')
}

// ── Helpers ────────────────────────────────────────────────────────────────
function updateStatePill(label, confidence) {
  const c = STATE_COLORS[label] || STATE_COLORS.neutral
  statusDot.style.background   = c.dot
  statusPill.style.borderColor = c.border
  statusLabel.textContent      = label
  statusLabel.style.color      = c.dot
  if (confidence !== null) {
    statusConf.textContent = confidence ? `${Math.round(confidence * 100)}% conf` : ''
  }
}

function appendFeedItem(event) {
  const div = document.createElement('div')
  div.className = 'feed-item'
  const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  div.innerHTML = `<span class="ft">${time}</span><span class="ftype">${event.type}</span><span>${summarize(event)}</span>`
  eventFeed.prepend(div)

  // Keep feed capped at 60 items
  while (eventFeed.children.length > 60) {
    eventFeed.removeChild(eventFeed.lastChild)
  }
}

function summarize(event) {
  const p = event.payload
  switch (event.type) {
    case 'APP_SWITCH':       return `${p.fromApp} → ${p.toApp}`
    case 'CONTEXT_SNAPSHOT': return `${p.activeApp} | ${p.switchesInLastMinute} sw/min`
    case 'TYPING_SNAPSHOT':  return `${p.wordsPerMinute} WPM | var ${p.typingVariance}`
    case 'IDLE_START':       return 'Idle started'
    case 'IDLE_END':         return `Idle ${Math.round(p.idleDurationMs / 1000)}s`
    case 'STATE_LABEL':      return `→ ${p.label}`
    default:                 return ''
  }
}

function showActionBanner(type, reason) {
  const existing = document.getElementById('action-banner')
  if (existing) existing.remove()

  const msgs = {
    SUPPRESS_NOTIFICATIONS: '🔕 Notifications suppressed — distraction detected',
    SUGGEST_BREAK:          '☕ Time for a break — fatigue detected',
    SUGGEST_SIMPLIFY:       '🧘 Consider simplifying — overload detected',
    LABEL_SAVED:            `✓ ${reason}`
  }

  const banner = document.createElement('div')
  banner.id = 'action-banner'
  banner.style.cssText = `
    position: fixed; bottom: 14px; left: 16px; right: 16px;
    background: #1a1a2e; border: 1px solid #5B47E0; border-radius: 10px;
    padding: 10px 14px; font-size: 12px; color: #bbb; z-index: 200;
    animation: slideUp 0.2s ease;
  `
  banner.textContent = msgs[type] || type
  document.body.appendChild(banner)
  setTimeout(() => banner.remove(), 5000)
}

function actionToLabel(actionType) {
  const map = {
    SUPPRESS_NOTIFICATIONS: 'distracted',
    SUGGEST_BREAK:          'fatigued',
    SUGGEST_SIMPLIFY:       'overloaded'
  }
  return map[actionType] || null
}

async function refreshWSStatus() {
  try {
    const status = await window.focusLens.getWSStatus()
    if (status?.connected) {
      wsDot.classList.add('connected')
      wsText.textContent = `Connected · ${status.queuedEvents} queued`
    } else {
      wsDot.classList.remove('connected')
      wsText.textContent = `Reconnecting (attempt ${status?.reconnectAttempt || 0})`
    }
  } catch {}
}

function truncate(str, n) {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  updateStatePill('neutral', null)
  statusConf.textContent = 'Starting...'
  await refreshWSStatus()

  const session = await window.focusLens.getSessionInfo()
  if (session) {
    wsText.textContent = `Session: ${session.id.slice(0, 8)}…`
  }
}

init()