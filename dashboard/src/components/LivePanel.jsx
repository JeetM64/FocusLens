export default function LivePanel({ liveState }) {
  const s = liveState || {}

  const stats = [
    { label: "Active app", value: s.activeApp || "—" },
    { label: "Switches / min", value: s.switchesInLastMinute ?? "—" },
    { label: "Focus streak", value: s.focusStreakMs ? `${Math.round(s.focusStreakMs / 60000)}m` : "—" },
    { label: "WPM", value: s.wpm ?? "—" },
    { label: "Typing variance", value: s.typingVariance ?? "—" },
    { label: "Correction rate", value: s.correctionRate ? `${(s.correctionRate * 100).toFixed(1)}%` : "—" },
    { label: "Idle", value: s.isIdle === "1" ? "Yes" : "No" }
  ]

  return (
    <div style={{ background: "#111", borderRadius: 12, padding: 20 }}>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#888" }}>Live state</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stats.map(({ label, value }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#666" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#ddd" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}