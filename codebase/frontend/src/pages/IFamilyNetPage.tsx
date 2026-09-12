import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { C } from "../theme/tokens";
import { formatTriggerJobStatus } from "../constants/labels";
import {
  createFormInstance,
  getAiResult,
  getTriggerJobs,
  listTemplates,
  sendSurvey,
  submitSurvey,
  type FormTemplate,
} from "../api/client";

type Phase = "idle" | "queued" | "inferencing" | "ready" | "failed" | "degraded";

type TriggerConfig = {
  key: string;
  title: string;
  subtitle: string;
  templateId: string;
  userGroup: string;
  triggerRef: string;
};

const TRIGGERS: Record<string, TriggerConfig> = {
  mr: {
    key: "mr",
    title: "Mandated reporter survey",
    subtitle: "Mandated reporter feedback",
    templateId: "tpl_mr_v1",
    userGroup: "mandated_reporter",
    triggerRef: "INT-2026-04412",
  },
  vol: {
    key: "vol",
    title: "Volunteer event survey",
    subtitle: "Volunteer feedback",
    templateId: "tpl_vol_v1",
    userGroup: "volunteer",
    triggerRef: "EVT-2026-0388",
  },
  fp: {
    key: "fp",
    title: "Foster parent milestone form",
    subtitle: "Foster parent feedback",
    templateId: "tpl_fp_v1",
    userGroup: "foster_parent",
    triggerRef: "PL-2839-day60",
  },
  "att-spr": {
    key: "att-spr",
    title: "Service plan review survey",
    subtitle: "Attorney · Service plan review",
    templateId: "tpl_att_v1",
    userGroup: "attorney",
    triggerRef: "CS-2026-1182-spr",
  },
  "att-dp": {
    key: "att-dp",
    title: "Document production survey",
    subtitle: "Attorney · Document production",
    templateId: "tpl_att_v1",
    userGroup: "attorney",
    triggerRef: "CS-2026-1182-dp",
  },
  closure: {
    key: "closure",
    title: "Foster parent closure survey",
    subtitle: "Foster parent closure feedback",
    templateId: "tpl_fp_v1",
    userGroup: "foster_parent",
    triggerRef: "closure-fp",
  },
  "closure-att": {
    key: "closure-att",
    title: "Attorney closure form",
    subtitle: "Attorney closure feedback",
    templateId: "tpl_att_v1",
    userGroup: "attorney",
    triggerRef: "closure-att",
  },
};

type PlacementMilestone = {
  id: string;
  label: string;
  triggerDate: string;
  status: string;
  action: "none" | "send" | "sent";
};

const WORKFLOW_STAGES = [
  "section-intake",
  "section-investigation",
  "section-placement",
  "section-legal",
  "section-closure",
] as const;

type WorkflowSectionId = (typeof WORKFLOW_STAGES)[number];

const NAV_STAGES: Array<{ id: WorkflowSectionId; label: string; num: number }> = [
  { id: "section-intake", label: "Hotline contact", num: 1 },
  { id: "section-intake", label: "Intake filing", num: 2 },
  { id: "section-investigation", label: "Investigation", num: 3 },
  { id: "section-placement", label: "Placement", num: 4 },
  { id: "section-legal", label: "Legal process", num: 5 },
  { id: "section-closure", label: "Case closure", num: 6 },
];

function workflowIndexForNav(navIndex: number): number {
  return WORKFLOW_STAGES.indexOf(NAV_STAGES[navIndex].id);
}

const INITIAL_PLACEMENT_MILESTONES: PlacementMilestone[] = [
  { id: "m1", label: "Initial milestone",       triggerDate: "Apr 27, 2026", status: "Not yet due", action: "none" },
  { id: "m2", label: "Mid-placement milestone", triggerDate: "May 27, 2026", status: "Pending",     action: "send" },
  { id: "m3", label: "Pre-discharge milestone", triggerDate: "Jun 26, 2026", status: "Upcoming",    action: "none" },
];

// ── Status pill colour definitions ────────────────────────────────────────────
type PillVariant = "green" | "red" | "orange" | "white";

function pillVariant(status: string): PillVariant {
  const s = status.toLowerCase();
  if (s.includes("complet") || s.includes("submitted") || s.includes("done")) return "green";
  if (s.includes("overdue") || s.includes("breach") || s.includes("failed") || s.includes("reject")) return "red";
  if (
    s.includes("await") || s.includes("in process") || s.includes("in review") ||
    s.includes("sent") || s.includes("pending") || s.includes("due soon") ||
    s.includes("inferen") || s.includes("queue") || s.includes("open")
  ) return "orange";
  return "white";
}

const PILL_STYLES: Record<PillVariant, { background: string; color: string; border: string }> = {
  green:  { background: "#e8f5e9", color: "#1b5e20",  border: "1.5px solid #a5d6a7" },
  red:    { background: "#ffebee", color: "#b71c1c",  border: "1.5px solid #ef9a9a" },
  orange: { background: "#fff3e0", color: "#bf360c",  border: "1.5px solid #ffcc80" },
  white:  { background: "#f5f7fa", color: "#4c607a",  border: "1.5px solid #d4deea" },
};

function StatusPill({ status }: { status: string }) {
  if (!status || status === "—") return <span style={{ color: "#9aa5b4" }}>—</span>;
  const variant = pillVariant(status);
  const s = PILL_STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 11px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...s,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: s.color,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

export function WorkflowPage() {
  const [triggerJobs, setTriggerJobs] = useState<Array<Record<string, unknown>>>([]);
  const [activeInstanceId, setActiveInstanceId] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [activatedStageIndex, setActivatedStageIndex] = useState(0);
  const [aiResult, setAiResult] = useState<{
    topic: string;
    sentimentScore: number;
    urgency: string;
    explainabilitySummary: string;
    recommendedRoute: string;
    confidence?: number;
    latencyMs?: number;
    fallbackUsed?: boolean;
    model?: string;
    errorMessage?: string;
  } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  // Per-trigger loading key — prevents all buttons showing "Sending…" when one is in flight
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [placementMilestones, setPlacementMilestones] = useState(INITIAL_PLACEMENT_MILESTONES);
  const [useLiveSurveyStatus, setUseLiveSurveyStatus] = useState(true);
  // Track which stages have had surveys dispatched (for status propagation)
  const [dispatchedKeys, setDispatchedKeys] = useState<Set<string>>(new Set());

  // Live template data — reflects admin edits immediately
  const [templateMap, setTemplateMap] = useState<Record<string, FormTemplate>>({});

  useEffect(() => {
    const refresh = () =>
      getTriggerJobs()
        .then((r) => setTriggerJobs(r.items))
        .catch(() => setTriggerJobs([]));
    refresh();
    const id = window.setInterval(refresh, 8_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    listTemplates()
      .then((r) => {
        const map: Record<string, FormTemplate> = {};
        for (const t of r.items) map[t.templateId] = t;
        setTemplateMap(map);
      })
      .catch(() => { /* non-critical — fallback to static text */ });
  }, []);

  function surveyStatusForRef(triggerRef: string): string {
    if (!useLiveSurveyStatus && triggerRef === TRIGGERS.fp.triggerRef) {
      const active = placementMilestones.find((m) => m.action === "send" || m.action === "sent");
      return active?.status ?? "Pending";
    }
    if (!useLiveSurveyStatus) return "Not scheduled";
    const job = triggerJobs.find((j) => String(j.trigger_ref ?? "") === triggerRef);
    if (!job) return "Not scheduled";
    if (String(job.instance_status ?? "") === "submitted") return "Completed";
    if (job.custom_link) return "Awaiting respondent";
    if (job.status === "completed" || job.status === "fired") return "Sent";
    return formatTriggerJobStatus(String(job.status ?? "scheduled"));
  }

  function isSurveyDispatched(triggerKey: string): boolean {
    if (!useLiveSurveyStatus) {
      if (triggerKey === "fp") return placementMilestones.some((m) => m.action === "sent");
      return false;
    }
    const cfg = TRIGGERS[triggerKey];
    if (!cfg) return false;
    const status = surveyStatusForRef(cfg.triggerRef);
    return status === "Awaiting respondent" || status === "Sent" || status === "Completed";
  }

  function sendSurveyLabel(triggerKey: string): string {
    if (sendingKey === triggerKey) return "Sending...";
    if (isSurveyDispatched(triggerKey) || dispatchedKeys.has(triggerKey)) return "Survey sent ✓";
    return "Send Survey";
  }

  function goToWorkflowIndex(workflowIdx: number) {
    if (workflowIdx < 0 || workflowIdx >= WORKFLOW_STAGES.length) return;
    setActivatedStageIndex(workflowIdx);
    const el = document.getElementById(WORKFLOW_STAGES[workflowIdx]);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function proceedToNextStage(fromSectionId: WorkflowSectionId) {
    const idx = WORKFLOW_STAGES.indexOf(fromSectionId);
    if (idx >= 0 && idx < WORKFLOW_STAGES.length - 1) goToWorkflowIndex(idx + 1);
  }

  function startOver() {
    setActiveInstanceId("");
    setSubmissionId("");
    setActivatedStageIndex(0);
    setAiResult(null);
    setPhase("idle");
    setLoading(false);
    setSendingKey(null);
    setError("");
    setPlacementMilestones(INITIAL_PLACEMENT_MILESTONES);
    setUseLiveSurveyStatus(false);
    setTriggerJobs([]);
    setDispatchedKeys(new Set());
  }

  function renderProceedButton(sectionId: WorkflowSectionId) {
    const idx = WORKFLOW_STAGES.indexOf(sectionId);
    if (idx < 0 || idx >= WORKFLOW_STAGES.length - 1) return null;
    return (
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
        <button type="button" className="dcf-btn dcf-btn-primary" onClick={() => proceedToNextStage(sectionId)}>
          Proceed to next stage →
        </button>
      </div>
    );
  }

  /** Trigger card showing live template info + status pill */
  function TriggerCard({
    triggerKey,
    accentColor,
    accentBg,
    dispatchNote,
  }: {
    triggerKey: string;
    accentColor: string;
    accentBg: string;
    dispatchNote: string;
  }) {
    const cfg = TRIGGERS[triggerKey];
    const tpl = templateMap[cfg.templateId];
    const surveyStatus = surveyStatusForRef(cfg.triggerRef);
    const dispatched = isSurveyDispatched(triggerKey);

    return (
      <div className="card trigger-card" style={{ background: accentBg, borderColor: `${accentColor}55` }}>
        <div style={{ fontSize: 13, color: accentColor, fontWeight: 700, marginBottom: 2 }}>{cfg.subtitle}</div>
        <div style={{ fontSize: 15, color: accentColor, fontWeight: 700, marginBottom: 6 }}>
          {tpl ? tpl.name : cfg.title}
        </div>
        {tpl && (
          <div style={{ fontSize: 12, color: "#4c607a", marginBottom: 6 }}>
            {tpl.questions.length} question{tpl.questions.length !== 1 ? "s" : ""} · v{tpl.version}
          </div>
        )}
        <p style={{ fontSize: 13, color: C.textMid, marginBottom: 10 }}>{dispatchNote}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <StatusPill status={surveyStatus} />
          <button
            type="button"
            className="dcf-btn"
            style={{
              background: dispatched ? "#2e7d32" : accentColor,
              color: "#fff",
              fontSize: 14,
            }}
            onClick={() => handleSendSurvey(triggerKey)}
            disabled={sendingKey === triggerKey || dispatched}
          >
            {sendSurveyLabel(triggerKey)}
          </button>
        </div>
      </div>
    );
  }

  async function handleSendSurvey(triggerKey: string) {
    const config = TRIGGERS[triggerKey];
    if (!config) return;
    setSendingKey(triggerKey);
    setLoading(true);
    setError("");
    try {
      const inst = await createFormInstance({
        templateId: config.templateId,
        userGroup: config.userGroup,
        triggerRef: config.triggerRef,
      });
      setActiveInstanceId(inst.surveyInstanceId);
      await sendSurvey(inst.surveyInstanceId);
      setUseLiveSurveyStatus(true);
      // Mark this specific trigger as dispatched immediately for UI feedback
      setDispatchedKeys((prev) => new Set([...prev, triggerKey]));
      if (triggerKey === "fp") {
        setPlacementMilestones((prev) =>
          prev.map((m) => (m.action === "send" ? { ...m, status: "Survey sent", action: "sent" as const } : m)),
        );
      }
      const jobs = await getTriggerJobs();
      setTriggerJobs(jobs.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendingKey(null);
      setLoading(false);
    }
  }

  async function handleSubmitDemoResponse() {
    if (!activeInstanceId) return;
    setLoading(true);
    setError("");
    setPhase("queued");
    try {
      const submitted = await submitSurvey(activeInstanceId, {
        hotline_wait: 2,
        professionalism: 3,
        comment: "There was a delay and some concern around response clarity. This feels urgent for follow-up.",
      });
      setSubmissionId(submitted.submissionId);
      setPhase("inferencing");
      const ai = await getAiResult(submitted.submissionId);
      setAiResult(ai);
      setPhase(ai.fallbackUsed ? "degraded" : "ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setPhase("failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="platform-shell">
      <header className="dcf-header">
        <Link to="/" className="dcf-header-link">← Platforms</Link>
        <span className="dcf-header-brand">Client's core solution</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <button type="button" className="dcf-header-btn" onClick={startOver}>Start Over</button>
          <span className="dcf-header-meta" style={{ marginLeft: 0 }}>Feedback Analytics Solution</span>
        </div>
      </header>

      <main className="platform-main">
        {/* Case record header */}
        <section className="card card-elevated" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em" }}>Case record</div>
          <h1 style={{ fontSize: 27, margin: "6px 0 8px", color: C.navy, fontWeight: 700 }}>Johnson family — active case</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13, color: C.textMid, alignItems: "center" }}>
            <span style={{ fontWeight: 700 }}>CS-2026-0847</span>
            <StatusPill status="In process" />
            <span>North Region</span>
            <span>Opened March 14, 2026</span>
            <span>Assigned caseworker: J. Torres</span>
          </div>
        </section>

        {/* Stage navigation rail */}
        <section className="card card-elevated" style={{ marginBottom: 16 }}>
          <div className="stage-rail">
            {NAV_STAGES.map((stage, idx) => {
              const workflowIdx = workflowIndexForNav(idx);
              const isDone = workflowIdx < activatedStageIndex;
              const isActive =
                workflowIdx === activatedStageIndex &&
                (workflowIdx !== 0 || (activatedStageIndex === 0 ? idx === 0 : idx === 1));
              const pillClass = ["stage-pill", isDone ? "stage-pill--done" : "", isActive ? "stage-pill--active" : ""]
                .filter(Boolean).join(" ");
              return (
                <button key={`${stage.label}-${idx}`} type="button" className={pillClass} onClick={() => goToWorkflowIndex(workflowIdx)}>
                  <div className="stage-pill-num">{stage.num}</div>
                  {stage.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Stage 1-2: Intake */}
        <section id="section-intake" className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase" }}>Stage 1-2</span>
            <h2 style={{ fontSize: 19, color: C.navy, fontWeight: 700 }}>Intake report & filing</h2>
            <StatusPill status="Completed" />
            <span style={{ fontSize: 13, color: C.textMid }}>Completed March 14, 2026</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  ["Filing reference", "INT-2026-04412"],
                  ["Filing outcome", "Accepted for investigation"],
                  ["Reporter category", "Healthcare professional"],
                  ["Screener assigned", "D. Nguyen"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: C.textLight }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <TriggerCard
              triggerKey="mr"
              accentColor={C.purple}
              accentBg={C.purplePale}
              dispatchNote="Auto-dispatched 7 days after intake filing."
            />
          </div>
          {renderProceedButton("section-intake")}
        </section>

        {/* Stage 3: Investigation */}
        <section id="section-investigation" className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase" }}>Stage 3</span>
            <h2 style={{ fontSize: 19, color: C.navy, fontWeight: 700 }}>Investigation & Casework</h2>
            <StatusPill status="Completed" />
            <span style={{ fontSize: 13, color: C.textMid }}>Completed April 2, 2026</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: C.textLight, marginBottom: 6 }}>Investigation summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <div><div style={{ fontSize: 11, color: C.textLight }}>Opened</div><div className="mono">Mar 14</div></div>
                <div><div style={{ fontSize: 11, color: C.textLight }}>Decision</div><div>Substantiated</div></div>
                <div><div style={{ fontSize: 11, color: C.textLight }}>Decision date</div><div className="mono">Apr 2</div></div>
              </div>
            </div>
            <TriggerCard
              triggerKey="vol"
              accentColor="#b07d24"
              accentBg="#fff8eb"
              dispatchNote="Survey fires within 48 hours of event completion."
            />
          </div>
          {renderProceedButton("section-investigation")}
        </section>

        {/* Stage 4: Placement */}
        <section id="section-placement" className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase" }}>Stage 4</span>
            <h2 style={{ fontSize: 19, color: C.navy, fontWeight: 700 }}>Placement & Foster Parent Milestones</h2>
            <StatusPill status="In process" />
            <span style={{ fontSize: 13, color: C.textMid }}>Active placement</span>
          </div>
          <div className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[["Placement ID","PL-2839"],["Foster family","Ferreira household"],["Placement date","Mar 28, 2026"]].map(([l,v]) => (
                <div key={l}>
                  <div style={{ fontSize: 11, color: C.textLight }}>{l}</div>
                  <div style={{ fontSize: 13, color: C.textMid, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="admin-table" style={{ fontSize: 14 }}>
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Trigger date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {placementMilestones.map((m) => {
                  const liveStatus = m.action === "send" && useLiveSurveyStatus
                    ? surveyStatusForRef(TRIGGERS.fp.triggerRef) : m.status;
                  return (
                    <tr key={m.id}>
                      <td>{m.label}</td>
                      <td className="mono">{m.triggerDate}</td>
                      <td><StatusPill status={liveStatus} /></td>
                      <td>
                        {m.action === "send" ? (
                          <button
                            type="button"
                            className="dcf-btn dcf-btn-primary"
                            onClick={() => handleSendSurvey("fp")}
                            disabled={sendingKey === "fp" || isSurveyDispatched("fp") || dispatchedKeys.has("fp")}
                            style={(isSurveyDispatched("fp") || dispatchedKeys.has("fp")) ? { background: "#2e7d32" } : undefined}
                          >
                            {sendSurveyLabel("fp")}
                          </button>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {renderProceedButton("section-placement")}
        </section>

        {/* Stage 5: Legal */}
        <section id="section-legal" className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase" }}>Stage 5</span>
            <h2 style={{ fontSize: 19, color: C.navy, fontWeight: 700 }}>Legal Process & Document Milestones</h2>
            <StatusPill status="Overdue" />
            <span style={{ fontSize: 13, color: C.textMid }}>2 milestones open</span>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="admin-table" style={{ fontSize: 14 }}>
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Due date</th>
                  <th>Attorney</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Service plan review", due: "May 24", att: "P. Nair", status: "Overdue",  key: "att-spr" },
                  { label: "Document production", due: "May 28", att: "P. Nair", status: "Due soon", key: "att-dp"  },
                ].map((row) => {
                  const isDispatched = isSurveyDispatched(row.key) || dispatchedKeys.has(row.key);
                  return (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="mono">{row.due}</td>
                      <td>{row.att}</td>
                      <td><StatusPill status={row.status} /></td>
                      <td>
                        <button
                          type="button"
                          className="dcf-btn"
                          style={{ background: isDispatched ? "#2e7d32" : C.coral, color: "#fff", fontSize: 13 }}
                          onClick={() => handleSendSurvey(row.key)}
                          disabled={sendingKey === row.key || isDispatched}
                        >
                          {sendSurveyLabel(row.key)}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {renderProceedButton("section-legal")}
        </section>

        {/* Stage 6: Closure */}
        <section id="section-closure" className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase" }}>Stage 6</span>
            <h2 style={{ fontSize: 19, color: C.navy, fontWeight: 700 }}>Case Closure</h2>
            <StatusPill status="Not yet initiated" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: C.textLight, marginBottom: 8 }}>Case closure status</div>
              <p style={{ fontSize: 13, color: C.textMid }}>
                Closure feedback triggers dispatch to foster parent and attorney when closure starts.
              </p>
              <p style={{ fontSize: 13, color: C.textMid, marginTop: 8 }}>
                AI generates a closure evidence summary for quality-review alignment.
              </p>
            </div>
            <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {["closure", "closure-att"].map((key) => {
                const cfg = TRIGGERS[key];
                const tpl = templateMap[cfg.templateId];
                const surveyStatus = surveyStatusForRef(cfg.triggerRef);
                const dispatched = isSurveyDispatched(key);
                return (
                  <div key={key} style={{ border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{tpl ? tpl.name : cfg.title}</div>
                    <div style={{ fontSize: 12, color: C.textLight, marginBottom: 8 }}>
                      {cfg.subtitle}{tpl ? ` · ${tpl.questions.length} question${tpl.questions.length !== 1 ? "s" : ""} · v${tpl.version}` : ""}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <StatusPill status={surveyStatus} />
                      <button
                        type="button"
                        className="dcf-btn dcf-btn-primary"
                        style={dispatched ? { background: "#2e7d32" } : undefined}
                        onClick={() => handleSendSurvey(key)}
                        disabled={sendingKey === key || dispatched}
                      >
                        {sendSurveyLabel(key)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {renderProceedButton("section-closure")}
        </section>

        {/* Event timeline */}
        <section id="section-timeline" className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase" }}>Audit trail</span>
            <h2 style={{ fontSize: 19, color: C.navy, fontWeight: 700 }}>Case event & feedback timeline</h2>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { title: "Intake report filed — investigation accepted",          meta: "Mar 14, 2026 · 09:41", status: "Completed"  },
              { title: "Mandated reporter survey dispatched",          meta: "Mar 21, 2026 · 08:00", status: "Completed"  },
              { title: "Placement Day 30 survey submitted",            meta: "Apr 27, 2026 · 10:15", status: "Completed"  },
              { title: "Legal milestone — service plan review due",    meta: "May 24, 2026 · 08:00", status: "Overdue"    },
              { title: "Placement Day 60 survey dispatched",          meta: "May 27, 2026 · 08:00", status: "Awaiting respondent" },
              { title: "Case closure & final surveys",                meta: "Pending · Est. Jun 3, 2026", status: "Not yet initiated" },
            ].map(({ title, meta, status }) => (
              <div key={title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", marginTop: 7, flexShrink: 0,
                  background: pillVariant(status) === "green" ? "#2e7d32"
                    : pillVariant(status) === "red" ? "#c62828"
                    : pillVariant(status) === "orange" ? "#e65100"
                    : "#b0bbcc",
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: C.navy, fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: 12, color: C.textMid }}>{meta}</div>
                </div>
                <StatusPill status={status} />
              </div>
            ))}
          </div>
        </section>

        {/* Per-submission AI */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: C.navy }}>Per-submission AI (case workflow)</h3>
          <p style={{ fontSize: 13, color: C.textMid, marginBottom: 8 }}>
            Classifies a single demo submission after send. For portfolio-wide observations, open{" "}
            <strong>Feedback Analytics → Dashboard → Read more → Generate insights</strong>.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: C.textMid }}>Current state:</span>
            <StatusPill status={phase === "idle" ? "Not yet initiated" : phase === "queued" ? "Queued" : phase === "inferencing" ? "Analyzing" : phase === "ready" ? "Completed" : phase === "degraded" ? "Degraded" : "Failed"} />
          </div>
          {activeInstanceId && (
            <button
              type="button"
              className="dcf-btn dcf-btn-primary"
              style={{ marginTop: 14 }}
              onClick={handleSubmitDemoResponse}
              disabled={loading}
            >
              {loading ? "Submitting…" : "Submit Demo Response"}
            </button>
          )}
          {error && <p style={{ color: C.coral, fontSize: 13, marginTop: 8 }}>{error}</p>}
          {submissionId && (
            <p style={{ marginTop: 8, fontSize: 12, color: C.textLight }}>
              Submission ID: {submissionId}
            </p>
          )}
          {aiResult && (
            <div style={{ marginTop: 14, padding: 14, border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface }}>
              <div style={{ fontSize: 12, color: C.textLight, marginBottom: 6 }}>AI Result</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <StatusPill status={aiResult.urgency === "high" ? "Overdue" : aiResult.urgency === "medium" ? "Due soon" : "Completed"} />
                <span style={{ fontSize: 13, color: C.textMid }}>Topic: <strong>{aiResult.topic}</strong></span>
                <span style={{ fontSize: 13, color: C.textMid }}>Route: <strong>{aiResult.recommendedRoute}</strong></span>
              </div>
              <div style={{ fontSize: 13, color: C.textMid }}>
                Sentiment: {aiResult.sentimentScore.toFixed(2)} · Confidence: {typeof aiResult.confidence === "number" ? aiResult.confidence.toFixed(2) : "n/a"} · Latency: {aiResult.latencyMs ?? 0}ms
              </div>
              {aiResult.fallbackUsed && (
                <div style={{ fontSize: 13, color: C.amber, marginTop: 4 }}>Degraded mode: fallback inference used.</div>
              )}
              <div style={{ fontSize: 13, color: C.textMid, marginTop: 6 }}>{aiResult.explainabilitySummary}</div>
              {aiResult.errorMessage && <div style={{ fontSize: 13, color: C.coral, marginTop: 4 }}>{aiResult.errorMessage}</div>}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: C.navy }}>Next Steps</h3>
          <p style={{ fontSize: 13, color: C.textMid }}>
            Escalate unresolved legal milestones, monitor queued responses, and complete closure trigger dispatch.
          </p>
        </div>
      </main>
    </div>
  );
}
