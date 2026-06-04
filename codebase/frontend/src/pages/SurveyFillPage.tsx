import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { C } from "../theme/tokens";
import { formatUserGroup } from "../constants/labels";
import { LIKERT_OPTIONS } from "../constants/likertScale";
import { getPublicSurvey, submitPublicSurvey, type SurveyQuestion } from "../api/client";
import { SurveyChat, type AskQuestionPayload } from "../components/SurveyChat";

export function SurveyFillPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [survey, setSurvey] = useState<Awaited<ReturnType<typeof getPublicSurvey>> | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [demoDemographic, setDemoDemographic] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ acknowledgementText?: string; submissionId: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [otherText, setOtherText] = useState<Record<string, string>>({});

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<AskQuestionPayload | null>(null);

  useEffect(() => {
    if (!token) return;
    getPublicSurvey(token, searchParams.toString())
      .then((data) => {
        setSurvey(data);
        if (data.prefillAnswers && Object.keys(data.prefillAnswers).length) {
          setAnswers((prev) => ({ ...data.prefillAnswers, ...prev }));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Survey unavailable"));
  }, [token, searchParams]);

  function setAnswer(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const result = await submitPublicSurvey(token, {
        answers: {
          ...answers,
          attestation: answers.attestation === true || answers.attestation === "on",
          attested: answers.attestation === true || answers.attestation === "on",
        },
        demoDemographic: demoDemographic || undefined,
      });
      setDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  function isReferenceField(q: SurveyQuestion): boolean {
    return q.id === "filing_reference" || q.id === "placement_id" || q.id === "placement_ref";
  }

  function askAssistant(q: SurveyQuestion) {
    setPendingQuestion({ questionId: q.id, questionLabel: q.label });
    if (!chatOpen) setChatOpen(true);
  }

  function handleSelectSuggestion(questionId: string, value: unknown) {
    setAnswer(questionId, value);
  }

  function renderQuestion(q: SurveyQuestion, idx: number) {
    const desc = q.description?.trim() || null;
    const required = q.required;

    const header = (
      <>
        <p className="gf-q-label">
          <span className="gf-q-num">{idx + 1}</span>
          {q.label}
          {required && <span className="gf-q-required" aria-hidden>*</span>}
          {!isReferenceField(q) && (
            <button
              type="button"
              className="sc-help-icon"
              onClick={() => askAssistant(q)}
              aria-label="Ask assistant for help"
              title="Ask assistant for help"
            >
              ?
            </button>
          )}
        </p>
        {desc && <p className="gf-q-desc">{desc}</p>}
      </>
    );

    if (q.type === "likert") {
      return (
        <div key={q.id} className="gf-question-card">
          {header}
          <div className="gf-likert-scale">
            {LIKERT_OPTIONS.map((opt) => {
              const sel = answers[q.id] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`gf-likert-btn${sel ? " gf-likert-btn--selected" : ""}`}
                  style={{
                    borderColor: sel ? opt.color : `${opt.color}55`,
                    background: sel ? `${opt.color}22` : `${opt.color}0d`,
                  }}
                  onClick={() => setAnswer(q.id, opt.value)}
                  aria-pressed={sel}
                >
                  <span
                    className="gf-likert-emoji"
                    role="img"
                    aria-hidden="true"
                    style={sel ? { filter: "none" } : undefined}
                  >
                    {opt.emoji}
                  </span>
                  <span
                    className="gf-likert-word"
                    style={{ color: sel ? opt.color : `${opt.color}cc`, fontWeight: sel ? 700 : 500 }}
                  >
                    {opt.label}
                  </span>
                  {sel && (
                    <span className="gf-likert-check" style={{ background: opt.color }} aria-hidden>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (q.type === "dropdown") {
      const dropVal = String(answers[q.id] ?? "");
      return (
        <div key={q.id} className="gf-question-card">
          {header}
          <select
            className="gf-select"
            value={dropVal}
            onChange={(e) => setAnswer(q.id, e.target.value)}
          >
            <option value="">Choose</option>
            {(q.options ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {dropVal.toLowerCase() === "other" && (
            <input
              className="gf-text-input"
              style={{ marginTop: 10 }}
              placeholder="Please specify…"
              value={otherText[q.id] ?? ""}
              onChange={(e) => {
                setOtherText((t) => ({ ...t, [q.id]: e.target.value }));
                setAnswer(`${q.id}_other`, e.target.value);
              }}
            />
          )}
        </div>
      );
    }

    if (q.type === "multi_select") {
      const sel = (answers[q.id] as string[]) ?? [];
      return (
        <div key={q.id} className="gf-question-card">
          {header}
          <div className="gf-options-list">
            {(q.options ?? []).map((o) => (
              <label key={o} className="gf-option-row">
                <input
                  type="checkbox"
                  className="gf-checkbox"
                  checked={sel.includes(o)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...sel, o] : sel.filter((x) => x !== o);
                    setAnswer(q.id, next);
                  }}
                />
                <span className="gf-option-label">{o}</span>
              </label>
            ))}
          </div>
          {sel.includes("Other") && (
            <input
              className="gf-text-input"
              style={{ marginTop: 10 }}
              placeholder="Please specify…"
              value={otherText[q.id] ?? ""}
              onChange={(e) => {
                setOtherText((t) => ({ ...t, [q.id]: e.target.value }));
                setAnswer(`${q.id}_other`, e.target.value);
              }}
            />
          )}
        </div>
      );
    }

    if (q.type === "attestation") {
      return (
        <div key={q.id} className="gf-question-card gf-question-card--attest">
          {desc && <p className="gf-q-desc" style={{ marginBottom: 10 }}>{desc}</p>}
          <label className="gf-option-row">
            <input
              type="checkbox"
              className="gf-checkbox"
              checked={answers[q.id] === true}
              onChange={(e) => setAnswer(q.id, e.target.checked)}
            />
            <span className="gf-option-label">{q.label}</span>
          </label>
        </div>
      );
    }

    return (
      <div key={q.id} className="gf-question-card">
        {header}
        <input
          className="gf-text-input"
          value={String(answers[q.id] ?? "")}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          readOnly={isReferenceField(q)}
          aria-readonly={isReferenceField(q)}
          style={isReferenceField(q) ? { color: C.textMid, cursor: "default" } : undefined}
          placeholder={isReferenceField(q) ? undefined : "Your answer"}
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className="gf-shell">
        <div className="gf-done-card">
          <div className="gf-done-icon" aria-hidden>✓</div>
          <h1 className="gf-done-title">Thank you for the response.</h1>
        </div>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="gf-shell">
        <div className="gf-error-card">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Show spinner while survey is loading — avoid "invalid" flash before data arrives
  if (!survey) {
    return (
      <div className="gf-shell">
        <div className="gf-loading-card">
          <span className="gf-spinner" aria-label="Loading survey" />
          <p>Loading survey…</p>
        </div>
      </div>
    );
  }

  if (!survey.valid) {
    return (
      <div className="gf-shell">
        <div className="gf-error-card">
          <p>This survey link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const questions = (survey.questions ?? []) as SurveyQuestion[];
  const ctx = survey.linkContext;

  return (
    <div className="gf-shell">
      {/* Header banner — full width */}
      <div className="gf-form-header">
        <h1 className="gf-form-title">{survey.templateName}</h1>
        {ctx?.ref && (
          <p className="gf-form-meta">
            Reference: {ctx.ref}
            {ctx.role ? ` · ${formatUserGroup(String(ctx.role))}` : ""}
          </p>
        )}
        <p className="gf-form-meta">Secure single-use survey · responses are processed to route your feedback appropriately</p>
      </div>

      {/* Two-column body: form left, chat right */}
      <div className="gf-layout">
        <form className="gf-form-body" onSubmit={handleSubmit}>
          {/* Disclaimer banner */}
          <div className="gf-disclaimer">
            <svg className="gf-disclaimer-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <p>
              Your responses are handled confidentially and used solely to improve service quality.
              Submissions are automatically analysed using AI to help route your feedback to the appropriate team.
              No personally identifiable information is shared beyond what you provide in this form.
            </p>
          </div>

          {/* Optional demographic */}
          <div className="gf-question-card" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <p className="gf-settings-label" style={{ marginBottom: 0 }}>Optional — role or region (for equity monitoring)</p>
            <input
              className="gf-text-input"
              placeholder="e.g. Northern region, supervisor role"
              value={demoDemographic}
              onChange={(e) => setDemoDemographic(e.target.value)}
              style={{ marginTop: 10 }}
            />
          </div>

          {/* Questions */}
          {questions.map((q, i) => renderQuestion(q, i))}

          {error && <p className="gf-submit-error">{error}</p>}

          <div className="gf-submit-row">
            <button type="submit" className="gf-submit-btn" disabled={loading}>
              {loading ? "Submitting…" : "Submit"}
            </button>
            <p className="gf-submit-note">Never submit passwords or sensitive personal data through this form.</p>
          </div>
        </form>

        {/* Chat sidebar (desktop) + FAB (mobile) */}
        {token && (
          <SurveyChat
            token={token}
            pendingQuestion={pendingQuestion}
            onClearPendingQuestion={() => setPendingQuestion(null)}
            onSelectSuggestion={handleSelectSuggestion}
            isOpen={chatOpen}
            onToggle={() => setChatOpen((o) => !o)}
          />
        )}
      </div>
    </div>
  );
}
