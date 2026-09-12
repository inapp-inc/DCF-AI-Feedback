import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { C } from "../theme/tokens";
import { login } from "../api/client";
import {
  SESSION_KEYS,
  getLoggedInPlatform,
  isStaffPlatform,
  staffHomePath,
  type StaffPlatform,
} from "../auth/platform";

const PLATFORM_COPY: Record<
  StaffPlatform,
  { title: string; subtitle: string; brandLine: string }
> = {
  workflow: {
    title: "Case Workflow sign-in",
    subtitle: "Staff workflow — triggers, dispatch, and milestone surveys",
    brandLine: "Case workflow and survey dispatch for staff.",
  },
  admin: {
    title: "Feedback Analytics sign-in",
    subtitle: "Administrative console — dashboards, queue, and form configuration",
    brandLine: "Operations, analytics, and survey administration.",
  },
};

const ADMIN_DEMO_ACCOUNTS = [
  { label: "Admin", username: "admin_demo", color: "#5b21b6" },
  { label: "Supervisor", username: "supervisor_demo", color: "#1d4ed8" },
  { label: "Legal", username: "legal_demo", color: "#b45309" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { platform: platformParam } = useParams<{ platform: string }>();
  const [username, setUsername] = useState("admin_demo");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isStaffPlatform(platformParam)) {
    return <Navigate to="/" replace />;
  }

  const platform = platformParam;
  const copy = PLATFORM_COPY[platform];
  const loggedPlatform = getLoggedInPlatform();
  const loggedUsername = sessionStorage.getItem(SESSION_KEYS.username);

  useEffect(() => {
    if (loggedUsername && loggedPlatform === platform) {
      navigate(staffHomePath(platform), { replace: true });
    }
  }, [loggedUsername, loggedPlatform, platform, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await login(username, password);
      sessionStorage.setItem(SESSION_KEYS.username, session.username);
      sessionStorage.setItem(SESSION_KEYS.role, session.role);
      sessionStorage.setItem(SESSION_KEYS.platform, platform);
      navigate(staffHomePath(platform));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <p style={{ marginBottom: 14 }}>
          <Link to="/" style={{ color: "rgba(255,255,255,0.90)", fontSize: 15, textDecoration: "none", fontWeight: 500 }}>
            ← All platforms
          </Link>
        </p>
        <h1>Feedback Analytics Solution</h1>
        <p>{copy.brandLine}</p>
      </div>
      <div className="auth-form-wrap">
        <form className="card card-elevated auth-form" onSubmit={handleSubmit}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: C.navy }}>{copy.title}</h2>
          <p style={{ fontSize: 15, color: C.textMid, marginBottom: 24 }}>{copy.subtitle}</p>

          {platform === "admin" && (
            <div style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#7a8fa8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Demo quick-fill
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ADMIN_DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => { setUsername(acc.username); setPassword("demo"); }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      border: `1.5px solid ${acc.color}33`,
                      background: `${acc.color}11`,
                      color: acc.color,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="admin-field-label">Username</label>
          <input className="dcf-input" value={username} onChange={(e) => setUsername(e.target.value)} style={{ marginBottom: 14 }} />
          <label className="admin-field-label">Password</label>
          <input
            className="dcf-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: 18 }}
          />
          {error && <p style={{ color: C.coral, fontSize: 14, marginBottom: 12 }} role="alert">{error}</p>}
          <button type="submit" className="dcf-btn dcf-btn-primary" style={{ width: "100%", fontSize: 17 }} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ fontSize: 13, color: C.textLight, marginTop: 16, lineHeight: 1.6 }}>
            All demo accounts use <span className="mono">demo</span> as the password.
          </p>
        </form>
      </div>
    </div>
  );
}
