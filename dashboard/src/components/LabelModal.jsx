import { useState } from "react"

const LABELS = [
  { value: "focused",    emoji: "🎯", desc: "Deep in the zone" },
  { value: "distracted", emoji: "🌀", desc: "Mind wandering" },
  { value: "fatigued",   emoji: "😴", desc: "Low energy, slow" },
  { value: "overloaded", emoji: "🤯", desc: "Too much at once" },
  { value: "neutral",    emoji: "😐", desc: "Neither here nor there" }
]

export default function LabelModal({ onSubmit, onClose }) {
  const [selected, setSelected] = useState(null)
  const [confidence, setConfidence] = useState(3)

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{ background: "#1a1a1a", borderRadius: 16, padding: 28, width: 360, border: "1px solid #333" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>How focused are you right now?</h3>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#666" }}>This label trains the AI model</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LABELS.map(l => (
            <button
              key={l.value}
              onClick={() => setSelected(l.value)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                borderRadius: 10, border: selected === l.value ? "1.5px solid #5B47E0" : "1px solid #333",
                background: selected === l.value ? "#2a2545" : "#111",
                cursor: "pointer", textAlign: "left"
              }}
            >
              <span style={{ fontSize: 20 }}>{l.emoji}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#ddd" }}>{l.value}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{l.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ margin: "16px 0" }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>
            Confidence: {confidence}/5
          </label>
          <input type="range" min={1} max={5} value={confidence}
            onChange={e => setConfidence(parseInt(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "10px", background: "#222", border: "1px solid #333", borderRadius: 8, color: "#888", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onSubmit(selected, confidence)}
            style={{
              flex: 1, padding: "10px", background: selected ? "#5B47E0" : "#333",
              border: "none", borderRadius: 8, color: "#fff", cursor: selected ? "pointer" : "default", fontWeight: 500
            }}>
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}