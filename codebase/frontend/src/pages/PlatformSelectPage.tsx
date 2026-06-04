import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../theme/tokens";
import {
  clearStaffSession,
  getLoggedInPlatform,
  loginPath,
  SESSION_KEYS,
  staffHomePath,
  type StaffPlatform,
} from "../auth/platform";
import { login, logout } from "../api/client";
import inappLogo from "../assets/inapp-logo.png";

const STAFF_PLATFORMS: {
  id: StaffPlatform;
  badge: string;
  title: string;
  description: string;
  className: string;
  icon: string;
}[] = [
  {
    id: "ifamilynet",
    badge: "Workflow",
    title: "Client's core solution",
    description: "Case workflow, trigger surveys, dispatch, and milestone feedback.",
    className: "platform-card--teal",
    icon: "⚡",
  },
  {
    id: "admin",
    badge: "Administration",
    title: "Feedback Analytics",
    description: "Completion dashboards, form configuration, queue console, and exports.",
    className: "platform-card--purple",
    icon: "📊",
  },
];

const DEMO_ROLES = [
  {
    username: "admin_demo",
    label: "Admin",
    icon: "🛡",
    color: "#5b21b6",
    colorPale: "#ede9ff",
    colorBorder: "rgba(91,33,182,0.3)",
    description: "Full administrative access — dashboards, form editing, exports, all approvals.",
  },
  {
    username: "supervisor_demo",
    label: "Supervisor",
    icon: "👤",
    color: "#1d4ed8",
    colorPale: "#dbeafe",
    colorBorder: "rgba(29,78,216,0.3)",
    description: "Supervisor queue management, approval gate, and analytics dashboards.",
  },
  {
    username: "legal_demo",
    label: "Legal Reviewer",
    icon: "⚖",
    color: "#b45309",
    colorPale: "#fffbeb",
    colorBorder: "rgba(180,83,9,0.3)",
    description: "Legal review gate for attorney submissions — approve or reject before supervisor.",
  },
];

export function PlatformSelectPage() {
  const navigate = useNavigate();
  const activePlatform = getLoggedInPlatform();
  const [quickLoginLoading, setQuickLoginLoading] = useState<string | null>(null);
  const [quickLoginError, setQuickLoginError] = useState("");
  const [otherPlatformsOpen, setOtherPlatformsOpen] = useState(false);

  function openStaffPlatform(platform: StaffPlatform) {
    if (activePlatform === platform) {
      navigate(staffHomePath(platform));
      return;
    }
    navigate(loginPath(platform));
  }

  async function handleSignOutAll() {
    try { await logout(); } catch { /* best effort */ }
    clearStaffSession();
    setQuickLoginError("");
    navigate("/", { replace: true });
    // force re-render by reloading (session state is external to component)
    window.location.reload();
  }

  async function handleQuickLogin(username: string) {
    setQuickLoginLoading(username);
    setQuickLoginError("");
    try {
      const session = await login(username, "demo");
      sessionStorage.setItem(SESSION_KEYS.username, session.username);
      sessionStorage.setItem(SESSION_KEYS.role, session.role);
      sessionStorage.setItem(SESSION_KEYS.platform, "admin");
      navigate(staffHomePath("admin"));
    } catch (err) {
      setQuickLoginError(err instanceof Error ? err.message : "Login failed. Is the backend running?");
    } finally {
      setQuickLoginLoading(null);
    }
  }

  return (
    <div className="platform-shell">
      {/* ── Vivid hero banner ── */}
      <div className="home-hero-banner">
        <div className="home-hero-topbar">
          <span className="demo-pill">Demo</span>
          <div className="inapp-hero-brand">
            <img src={inappLogo} alt="InApp" />
            <span className="inapp-hero-brand-label">InApp<br />demo</span>
          </div>
        </div>
        <div className="home-hero-inner">
          <h1>Feedback Analytics Solution</h1>
          <p>Centralized feedback collection and analytics for your service network.</p>

          {activePlatform ? (
            <div className="home-user-chip">
              Signed in for{" "}
              <strong>{activePlatform === "admin" ? "Feedback Analytics" : "Client's core solution"}</strong>
              <span className="chip-sep">·</span>
              <button
                type="button"
                className="dcf-btn dcf-btn-ghost"
                onClick={() => navigate(loginPath(activePlatform))}
              >
                Switch account
              </button>
              <span className="chip-sep">·</span>
              <button
                type="button"
                className="dcf-btn dcf-btn-ghost chip-signout"
                onClick={handleSignOutAll}
              >
                Sign out of all
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Primary: Feedback Analytics card (always visible) ── */}
      <p className="platform-section-label">Feedback Analytics platform:</p>
      <div className="platform-grid platform-grid--single">
        <button
          type="button"
          className={`card platform-card ${STAFF_PLATFORMS[1].className} hover-lift`}
          onClick={() => openStaffPlatform(STAFF_PLATFORMS[1].id)}
        >
          <div className="platform-card-icon-strip">{STAFF_PLATFORMS[1].icon}</div>
          <div className="platform-card-inner">
            <div className="platform-card-badge">{STAFF_PLATFORMS[1].badge}</div>
            <h2>{STAFF_PLATFORMS[1].title}</h2>
            <p>{STAFF_PLATFORMS[1].description}</p>
            <div className="platform-card-arrow">
              {activePlatform === STAFF_PLATFORMS[1].id ? "Continue →" : "Sign in to open →"}
            </div>
          </div>
        </button>
      </div>

      {/* ── Demo quick-login ── */}
      <div className="demo-access-section">
        <div className="demo-access-header">
          <div>
            <div className="demo-access-title">Log in as a role — one click</div>
            <div className="demo-access-sub">
              All three accounts use the same <span className="mono">demo</span> password.
            </div>
          </div>
          {activePlatform && (
            <button
              type="button"
              className="dcf-btn demo-signout-btn"
              onClick={handleSignOutAll}
            >
              Sign out of all accounts
            </button>
          )}
        </div>

        {quickLoginError && (
          <p className="demo-access-error" role="alert">{quickLoginError}</p>
        )}

        <div className="demo-role-grid">
          {DEMO_ROLES.map((role) => (
            <div
              key={role.username}
              className="demo-role-card"
              style={{
                borderColor: role.colorBorder,
                background: `linear-gradient(155deg, ${role.colorPale} 0%, #fff 60%)`,
              }}
            >
              <div className="demo-role-icon" style={{ color: role.color, background: `${role.colorPale}` }}>
                {role.icon}
              </div>
              <div className="demo-role-label" style={{ color: role.color }}>{role.label}</div>
              <div className="demo-role-desc">{role.description}</div>
              <button
                type="button"
                className="dcf-btn demo-role-btn"
                style={{
                  background: role.color,
                  color: "#fff",
                  boxShadow: `0 2px 8px ${role.colorBorder}`,
                }}
                onClick={() => handleQuickLogin(role.username)}
                disabled={quickLoginLoading !== null}
                aria-busy={quickLoginLoading === role.username}
              >
                {quickLoginLoading === role.username
                  ? "Signing in…"
                  : `Log in as ${role.label} →`}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Collapsible: other platforms ── */}
      <div className="platform-other-section">
        <button
          type="button"
          className="platform-other-toggle"
          onClick={() => setOtherPlatformsOpen((v) => !v)}
          aria-expanded={otherPlatformsOpen}
        >
          {otherPlatformsOpen ? "▲" : "▼"} Other platforms — Client's core solution &amp; Survey List
        </button>
        {otherPlatformsOpen && (
          <div className="platform-grid" style={{ marginTop: 12 }}>
            {/* Client's core solution */}
            <button
              type="button"
              className={`card platform-card ${STAFF_PLATFORMS[0].className} hover-lift`}
              onClick={() => openStaffPlatform(STAFF_PLATFORMS[0].id)}
            >
              <div className="platform-card-icon-strip">{STAFF_PLATFORMS[0].icon}</div>
              <div className="platform-card-inner">
                <div className="platform-card-badge">{STAFF_PLATFORMS[0].badge}</div>
                <h2>{STAFF_PLATFORMS[0].title}</h2>
                <p>{STAFF_PLATFORMS[0].description}</p>
                <div className="platform-card-arrow">
                  {activePlatform === STAFF_PLATFORMS[0].id ? "Continue →" : "Sign in to open →"}
                </div>
              </div>
            </button>

            {/* Survey List */}
            <button
              type="button"
              className="card platform-card platform-card--slate hover-lift"
              onClick={() => navigate("/portal")}
            >
              <div className="platform-card-icon-strip">📋</div>
              <div className="platform-card-inner">
                <div className="platform-card-badge">Respondents</div>
                <h2>Survey List</h2>
                <p>Role-based survey access with live completion status for each respondent group.</p>
                <div className="platform-card-arrow">Open without sign-in →</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── InApp footer ── */}
      <div className="inapp-footer-bar">
        <img src={inappLogo} alt="InApp" />
        <div className="inapp-footer-sep" />
        <span>InApp demo · Feedback Analytics Solution</span>
      </div>
    </div>
  );
}
