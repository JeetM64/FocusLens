import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

function fmt(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function SessionChart({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div style={{ background: "#111", borderRadius: 12, padding: 24, color: "#555", minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
        No session data yet — start the desktop client
      </div>
    )
  }

  const data = timeline.map(w => ({
    time: fmt(w.windowStart),
    switchDensity: w.switchDensity,
    focusContinuity: parseFloat((w.focusContinuity * 100).toFixed(1)),
    idleRatio: parseFloat((w.idleRatio * 100).toFixed(1)),
    entropy: w.interactionEntropy
  }))

  return (
    <div style={{ background: "#111", borderRadius: 12, padding: 20 }}>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#888" }}>Session timeline (5-min windows)</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="time" tick={{ fill: "#666", fontSize: 11 }} />
          <YAxis tick={{ fill: "#666", fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />
          <Line type="monotone" dataKey="focusContinuity" stroke="#5B47E0" dot={false} name="Focus %" strokeWidth={2} />
          <Line type="monotone" dataKey="switchDensity" stroke="#E05B5B" dot={false} name="Switches/min" strokeWidth={1.5} />
          <Line type="monotone" dataKey="idleRatio" stroke="#E0A05B" dot={false} name="Idle %" strokeWidth={1.5} />
          <Line type="monotone" dataKey="entropy" stroke="#5BE0A0" dot={false} name="Entropy" strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}