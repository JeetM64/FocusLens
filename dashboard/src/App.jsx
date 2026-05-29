import { useState, useEffect, useCallback } from "react"
import LivePanel from "./components/LivePanel"
import SessionChart from "./components/charts/SessionChart"
import LabelModal from "./components/LabelModal"
import StatusBar from "./components/StatusBar"

const BACKEND = "http://127.0.0.1:3001"
const ML      = "http://127.0.0.1:8000"

export default function App() {
  const [sessionId, setSessionId]         = useState(null)
  const [userId, setUserId]               = useState(null)
  const [liveState, setLiveState]         = useState(null)
  const [timeline, setTimeline]           = useState([])
  const [prediction, setPrediction]       = useState(null)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [status, setStatus]               = useState("Searching for active session...")

  // ── 1. Auto-discover latest session ──────────────────────────────────────
  useEffect(() => {
    async function findSession() {
      try {
        const r = await fetch(`${BACKEND}/api/sessions/latest`)
        if (!r.ok) { setStatus("No sessions yet — start the Electron app"); return }
        const session = await r.json()
        setSessionId(session.id)
        setUserId(session.user_id)
        setStatus("Live")
      } catch {
        setStatus("Cannot reach backend — make sure npm run dev is running in /backend")
      }
    }
    findSession()
    const t = setInterval(findSession, 10000)
    return () => clearInterval(t)
  }, [])

  // ── 2. Poll live Redis state every 2s ─────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`${BACKEND}/api/telemetry/${sessionId}/live`)
        const d = await r.json()
        if (d && Object.keys(d).length > 0) setLiveState(d)
      } catch {}
    }, 2000)
    return () => clearInterval(iv)
  }, [sessionId])

  // ── 3. Poll ML prediction every 10s ──────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    const predict = async () => {
      try {
        const fr = await fetch(`${BACKEND}/api/telemetry/${sessionId}/features`)
        const features = await fr.json()
        if ((features.eventCount || 0) < 5) return
        const pr = await fetch(`${ML}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...features, sessionId })
        })
        if (pr.ok) setPrediction(await pr.json())
      } catch {}
    }
    predict()
    const iv = setInterval(predict, 10000)
    return () => clearInterval(iv)
  }, [sessionId])

  // ── 4. Load session timeline every 30s ───────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    const load = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/analytics/${sessionId}/timeline`)
        const d = await r.json()
        setTimeline(d.timeline || [])
      } catch {}
    }
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [sessionId])

  // ── Label submit ──────────────────────────────────────────────────────────
  const handleLabel = useCallback(async (label, confidence) => {
    if (!sessionId) return
    await fetch(`${BACKEND}/api/telemetry/${sessionId}/label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, confidence, userId: userId || "anonymous" })
    })
    setShowLabelModal(false)
  }, [sessionId, userId])

  return (
    <div style={{ fontFamily: "sans-serif", padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#e5e5e5" }}>FocusLens</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#555" }}>Cognitive Telemetry Platform</p>
        </div>
        <div style={{ display:"flex", gap: 10, alignItems:"center" }}>
          {sessionId && (
            <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace" }}>
              session: {sessionId.slice(0,8)}…
            </span>
          )}
          <button
            onClick={() => setShowLabelModal(true)}
            disabled={!sessionId}
            style={{
              padding: "8px 16px",
              background: sessionId ? "#5B47E0" : "#333",
              color: "#fff", border: "none", borderRadius: 8,
              cursor: sessionId ? "pointer" : "default", fontSize: 13
            }}
          >
            Label State
          </button>
        </div>
      </div>

      {/* Status when no session */}
      {!sessionId && (
        <div style={{
          background:"#111", border:"1px solid #222", borderRadius: 10,
          padding: 20, marginBottom: 20, color:"#666", fontSize: 13, textAlign:"center"
        }}>
          {status}
        </div>
      )}

      <StatusBar liveState={liveState} prediction={prediction} />

      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap: 16, marginTop: 16 }}>
        <LivePanel liveState={liveState} />
        <SessionChart timeline={timeline} />
      </div>

      {showLabelModal && (
        <LabelModal onSubmit={handleLabel} onClose={() => setShowLabelModal(false)} />
      )}
    </div>
  )
}