import { useEffect, useRef } from "react";
import { C } from "../../theme/tokens";
import type { FormQuestion, SubmissionDetail, ApprovalHistoryEntry } from "../../api/client";

const LIKERT_LABELS: Record<number, string> = {
  1: "Strongly disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly agree",
};

const LIKERT_COLORS: Record<number, string> = {
  1: "#c62828",
  2: "#e64a19",
  3: "#f57c00",
  4: "#388e3c",
  5: "#1b5e20",
};

const ACTION_LABELS: Record<string, string> = {
  legal_approved:     "✓ Cleared by legal",
  legal_rejected:     "✗ Rejected by legal",
  supervisor_approved:"✓ Approved to analytics",
  supervisor_rejected:"✗ Rejected by supervisor",
  responded:          "↩ Response sent",
};

function renderAnswer(q: FormQuestion, raw: unknown): React.ReactNode {
  if (raw == null || raw === "") {
    return <span style={{ color: "#9aa5b4", fontStyle: "italic" }}>No answer provided</span>;
  }

  if (q.type === "likert") {
    const n = Number(raw);
    const color = LIKERT_COLORS[n] ?? "#4c607a";
    return (
      <span className="fbdraw-likert-answer" style={{ color, borderColor: `${color}55`, background: `${color}11` }}>
        <span className="fbdraw-likert-dot" style={{ background: color }} />
        <span className="fbdraw-likert-num">{n}/5</span>
      </span>
    );
  }

  if (q.type === "attestation") {
    const attested = Boolean(raw);
    return (
      <span style={{ color: attested ? "#2e7d32" : "#c62828", fontWeight: 700 }}>
        {attested ? "✓ Attested" : "✗ Not attested"}
      </span>
    );
  }

  if (q.type === "multi_select" && Array.isArray(raw)) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        {(raw as string[]).map((v, i) => (
          <span key={i} className="fbdraw-tag">{v}</span>
        ))}
      </div>
    );
  }

  return <span className="fbdraw-text-answer">{String(raw)}</span>;
}

interface Props {
  detail: SubmissionDetail | null;
  loading: boolean;
  onClose: () => void;
}

export function FeedbackDrawer({ detail, loading, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Trap focus inside drawer
  useEffect(() => {
    if (detail || loading) {
      drawerRef.current?.focus();
    }
  }, [detail, loading]);

  if (!detail && !loading) return null;

  const isOpen = Boolean(detail || loading);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fbdraw-backdrop"
        aria-hidden="true"
        onClick={onClose}
        style={{ opacity: isOpen ? 1 : 0 }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="fbdraw-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Feedback detail"
        tabIndex={-1}
        style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="fbdraw-header">
          <div>
            <div className="fbdraw-eyebrow">Feedback Review</div>
            {detail && (
              <div className="fbdraw-form-name">{detail.formName || "Survey submission"}</div>
            )}
          </div>
          <button
            type="button"
            className="fbdraw-close"
            onClick={onClose}
            aria-label="Close feedback drawer"
          >
            ✕
          </button>
        </div>

        {loading && !detail && (
          <div className="fbdraw-loading">Loading submission…</div>
        )}

        {detail && (
          <div className="fbdraw-body">
            {/* Meta row */}
            <div className="fbdraw-meta-row">
              <div className="fbdraw-meta-chip">
                <span className="fbdraw-meta-label">Group</span>
                <span className="fbdraw-meta-val">{detail.userGroup.replace(/_/g, " ")}</span>
              </div>
              {detail.officeId && (
                <div className="fbdraw-meta-chip">
                  <span className="fbdraw-meta-label">Office</span>
                  <span className="fbdraw-meta-val">{detail.officeId}</span>
                </div>
              )}
              {detail.demoDemographic && (
                <div className="fbdraw-meta-chip">
                  <span className="fbdraw-meta-label">Demographic</span>
                  <span className="fbdraw-meta-val">{detail.demoDemographic}</span>
                </div>
              )}
              <div className="fbdraw-meta-chip">
                <span className="fbdraw-meta-label">Submitted</span>
                <span className="fbdraw-meta-val">
                  {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "—"}
                </span>
              </div>
            </div>

            {/* AI analysis strip */}
            {(detail.sentimentScore != null || detail.urgency) && (
              <div className="fbdraw-ai-strip">
                <div className="fbdraw-ai-title">AI Analysis</div>
                <div className="fbdraw-ai-grid">
                  {detail.sentimentScore != null && (
                    <div className="fbdraw-ai-cell">
                      <span className="fbdraw-ai-label">Sentiment</span>
                      <span
                        className="fbdraw-ai-val"
                        style={{
                          color: detail.sentimentScore >= 4 ? "#2e7d32"
                            : detail.sentimentScore >= 2.5 ? "#f57c00"
                            : "#c62828",
                        }}
                      >
                        {detail.sentimentScore.toFixed(1)} / 5
                      </span>
                    </div>
                  )}
                  {detail.urgency && (
                    <div className="fbdraw-ai-cell">
                      <span className="fbdraw-ai-label">Urgency</span>
                      <span
                        className="fbdraw-ai-val"
                        style={{
                          color: detail.urgency === "high" ? "#c62828"
                            : detail.urgency === "medium" ? "#f57c00"
                            : "#2e7d32",
                        }}
                      >
                        {detail.urgency}
                      </span>
                    </div>
                  )}
                  {detail.recommendedRoute && (
                    <div className="fbdraw-ai-cell">
                      <span className="fbdraw-ai-label">Recommended route</span>
                      <span className="fbdraw-ai-val">{detail.recommendedRoute.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  {detail.privilegeTagged && (
                    <div className="fbdraw-ai-cell fbdraw-ai-cell--flag">
                      <span className="fbdraw-ai-label">Privilege</span>
                      <span className="fbdraw-ai-val" style={{ color: "#c62828" }}>⚠ Privilege tagged</span>
                    </div>
                  )}
                </div>
                {detail.explainabilitySummary && (
                  <div className="fbdraw-ai-explain">{detail.explainabilitySummary}</div>
                )}
              </div>
            )}

            {/* Q & A section */}
            <div className="fbdraw-section-label">Responses</div>
            {detail.questions.length === 0 ? (
              <p style={{ fontSize: 14, color: C.textLight, padding: "12px 0" }}>
                Form questions not available — raw answers below.
              </p>
            ) : (
              <div className="fbdraw-qa-list">
                {detail.questions.map((q) => (
                  <div key={q.id} className="fbdraw-qa-block">
                    <div className="fbdraw-q-label">{q.label}</div>
                    {q.description && (
                      <div className="fbdraw-q-desc">{q.description}</div>
                    )}
                    <div className="fbdraw-answer">
                      {renderAnswer(q, detail.answers[q.id])}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fallback: show raw answers if no template */}
            {detail.questions.length === 0 && Object.keys(detail.answers).length > 0 && (
              <pre className="fbdraw-raw-answers">
                {JSON.stringify(detail.answers, null, 2)}
              </pre>
            )}

            {/* Approval history */}
            {detail.approvalHistory.length > 0 && (
              <>
                <div className="fbdraw-section-label">Approval trail</div>
                <div className="fbdraw-history-list">
                  {detail.approvalHistory.map((h: ApprovalHistoryEntry, i: number) => (
                    <div key={i} className="fbdraw-history-item">
                      <div className="fbdraw-history-action">
                        {ACTION_LABELS[h.action] ?? h.action}
                      </div>
                      <div className="fbdraw-history-meta">
                        {h.reviewerUsername}
                        {h.reviewerRole && ` · ${h.reviewerRole.replace(/_/g, " ")}`}
                        {" · "}
                        {new Date(h.createdAt).toLocaleString()}
                      </div>
                      {h.note && <div className="fbdraw-history-note">"{h.note}"</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
