const STATE_COLORS = {
  focused:    { bg: "#0d2b0d", border: "#2a6b2a", text: "#4ade80" },
  distracted: { bg: "#2b1a0d", border: "#6b4a1a", text: "#fb923c" },
  fatigued:   { bg: "#0d1a2b", border: "#1a3a6b", text: "#60a5fa" },
  overloaded: { bg: "#2b0d0d", border: "#6b1a1a", text: "#f87171" },
  neutral:    { bg: "#1a1a1a", border: "#444",    text: "#aaa" }
}

export default function StatusBar({ liveState, prediction }) {
  const label = prediction?.label || "neutral"
  const colors = STATE_COLORS[label] || STATE_COLORS.neutral
  const conf = prediction ? `${(prediction.confidence * 100).toFixed(0)}% confidence` : "Waiting for data..."

  return (
    <div style={{
      background: colors.bg, border: `1px solid ${colors.border}`,
      borderRadius: 10, padding: "12px 18px",
      display: "flex", alignItems: "center", justifyContent: "space-between"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: colors.text }} />
        <span style={{ color: colors.text, fontWeight: 600, fontSize: 14, textTransform: "capitalize" }}>
          {label}
        </span>
        <span style={{ color: "#555", fontSize: 12 }}>{conf}</span>
      </div>
      {liveState?.lastEventType && (
        <span style={{ fontSize: 11, color: "#555" }}>
          Last: {liveState.lastEventType}
        </span>
      )}
    </div>
  )
}