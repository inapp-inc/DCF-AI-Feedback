import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { C } from "../theme/tokens";
import { formatUserGroup } from "../constants/labels";
import { getPortalSurveys } from "../api/client";

const GROUPS = [
  { id: "mandated_reporter", title: "Mandated Reporters", desc: "Post-51A intake feedback", accent: C.purple },
  { id: "volunteer", title: "Volunteers", desc: "Training and event surveys", accent: "#d18d1f" },
  { id: "attorney", title: "Attorneys", desc: "Legal milestone forms", accent: C.coral },
  { id: "foster_parent", title: "Foster Parents", desc: "Placement and closure surveys", accent: C.teal },
];

function statusColor(label?: string): string {
  if (label === "Completed") return C.teal;
  if (label === "Awaiting response") return "#b07d24";
  if (label === "Sent") return C.purple;
  return C.textLight;
}

export function PortalLandingPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<
    Array<{
      customLink?: string;
      triggerRef?: string;
      statusLabel?: string;
      createdAt?: string;
    }>
  >([]);

  useEffect(() => {
    if (!selected) return;
    getPortalSurveys(selected).then((r) => setSurveys(r.items));
    const id = window.setInterval(() => {
      getPortalSurveys(selected)
        .then((r) => setSurveys(r.items))
        .catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [selected]);

  return (
    <div className="platform-shell">
      <header className="page-header">
        <Link to="/" className="page-header-back">
          ← Staff platforms
        </Link>
        <h1>Survey List</h1>
        <p>Select your role to view surveys and their completion status (demo RBAC).</p>
      </header>
      <main className="platform-main platform-main--narrow">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`card choice-tile${selected === g.id ? " selected" : ""}`}
              style={{ borderLeft: `4px solid ${g.accent}` }}
              onClick={() => setSelected(g.id)}
            >
              <div style={{ fontWeight: 600, color: C.navy, marginBottom: 6 }}>{g.title}</div>
              <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.45 }}>{g.desc}</div>
            </button>
          ))}
        </div>
        {selected && (
          <div className="card card-elevated" style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12, color: C.navy }}>
              Survey list — {GROUPS.find((g) => g.id === selected)?.title ?? formatUserGroup(selected)}
            </h2>
            {surveys.length === 0 ? (
              <p style={{ fontSize: 12, color: C.textLight }}>No surveys yet. Staff will dispatch after trigger events.</p>
            ) : (
              <ul style={{ listStyle: "none", display: "grid", gap: 10 }}>
                {surveys.map((s, i) => (
                  <li
                    key={`${s.triggerRef ?? i}-${s.createdAt ?? i}`}
                    className="card"
                    style={{
                      padding: 14,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: "none",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: C.navy }}>Ref: {s.triggerRef ?? "—"}</div>
                      {s.createdAt && (
                        <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>Created {s.createdAt}</div>
                      )}
                    </div>
                    <span className="status-badge" style={{ color: statusColor(s.statusLabel) }}>
                      {s.statusLabel ?? "Pending"}
                    </span>
                    {s.customLink && s.statusLabel !== "Completed" && (
                      <a
                        href={s.customLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: C.teal, wordBreak: "break-all", fontSize: 11, fontWeight: 600 }}
                      >
                        Open survey →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
