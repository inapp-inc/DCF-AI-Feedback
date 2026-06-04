import { Link } from "react-router-dom";
import inappLogo from "../assets/inapp-logo.png";
import { useCallback, useEffect, useMemo, useState } from "react";
import { C } from "../theme/tokens";
import {
  formatQueueStatus,
  formatReportType,
  formatUserGroup,
  humanizeUserFacingText,
} from "../constants/labels";
import { SingleLineChart } from "../components/admin/SingleLineChart";
import { BarChart, type BarItem } from "../components/admin/BarChart";
import { FeedbackDrawer } from "../components/admin/FeedbackDrawer";
import {
  deleteFormInstance,
  type FormInstance,
  type FormQuestion,
  type FormTemplate,
  generateAnalyticsInsights,
  generateReport,
  type AnalyticsInsightsResult,
  getAdminConfig,
  getAiOpsHealth,
  getAiResult,
  getAnalyticsAnomalies,
  getAnalyticsCompletion,
  getAnalyticsEquity,
  getAnalyticsKpisFiltered,
  getAnalyticsTrends,
  getQueue,
  getSubmissionDetail,
  flagForLegal,
  legalApprove,
  legalReject,
  listFormInstances,
  listPendingLegal,
  listPendingSupervisor,
  listSubmissionsHistory,
  listTemplates,
  overrideUrgency,
  type ApprovalItem,
  type SubmissionDetail,
  type QueueItem,
  type SubmissionHistoryItem,
  requestExport,
  supervisorApprove,
  supervisorReject,
  updateAdminConfig,
  updateQueueStatus,
  updateTemplate,
} from "../api/client";

type Tab = "dashboard" | "queue" | "approvals" | "submissions" | "forms" | "configuration";

const ROLE_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  admin:          { label: "Admin",          color: "#5b21b6", bg: "#ede9ff" },
  supervisor:     { label: "Supervisor",     color: "#1d4ed8", bg: "#dbeafe" },
  legal_reviewer: { label: "Legal Reviewer", color: "#b45309", bg: "#fffbeb" },
};

/** Tabs a given role may access */
function allowedTabs(role: string): Tab[] {
  if (role === "legal_reviewer") return ["approvals"];
  if (role === "supervisor")     return ["dashboard", "queue", "approvals"];
  return ["dashboard", "queue", "approvals", "submissions", "forms", "configuration"]; // admin
}

/** Default landing tab for each role */
function defaultTab(role: string): Tab {
  if (role === "legal_reviewer" || role === "supervisor") return "approvals";
  return "dashboard";
}

type Anomaly = { signalId: string; severity: string; summary: string; type?: string };

type TriggerWindows = { mr: string; vol: string; att: string; fp: string };

const DEADLINE_PRESETS: Record<keyof TriggerWindows, string[]> = {
  mr: ["5-7 business days", "7 calendar days", "Within 10 days of filing"],
  vol: ["Within 48 hours", "Within 72 hours", "End of event day"],
  att: ["On milestone date", "3 business days before hearing", "5 business days after milestone"],
  fp: ["Day 30 / 60 / 90", "Day 30 and Day 60 only", "Day 60 and closure only"],
};

const DEADLINE_LABELS: Record<keyof TriggerWindows, string> = {
  mr: "Mandated reporter (51A)",
  vol: "Volunteer events",
  att: "Attorney milestones",
  fp: "Foster parent placement",
};


const SEV_COLOR: Record<string, string> = {
  critical: "#c62828",
  high: "#f57c00",
  medium: "#1565c0",
  low: "#2e7d32",
};

function kpiLight(
  key: string,
  raw: number,
  submFirst: number,
  submLast: number,
): { color: string; display: string } {
  if (key === "responseRate") {
    const display = `${raw.toFixed(1)}%`;
    if (raw >= 70) return { color: "#2e7d32", display };
    if (raw >= 40) return { color: "#f57c00", display };
    return { color: "#c62828", display };
  }
  if (key === "openQueue") {
    if (raw === 0) return { color: "#2e7d32", display: "0" };
    if (raw <= 3) return { color: "#f57c00", display: String(raw) };
    return { color: "#c62828", display: String(raw) };
  }
  if (key === "highUrgency") {
    if (raw === 0) return { color: "#2e7d32", display: "0" };
    if (raw <= 2) return { color: "#f57c00", display: String(raw) };
    return { color: "#c62828", display: String(raw) };
  }
  if (key === "avgSentiment") {
    const display = raw.toFixed(2);
    if (raw >= 4) return { color: "#2e7d32", display };
    if (raw >= 2.5) return { color: "#f57c00", display };
    return { color: "#c62828", display };
  }
  // Submissions — trend-derived
  const pct = (submLast - submFirst) / Math.max(submFirst, 1);
  const display = String(Math.round(raw));
  if (pct > 0.05) return { color: "#2e7d32", display };
  if (pct < -0.05) return { color: "#c62828", display };
  return { color: "#1565c0", display };
}

export function AdminPage() {
  const [userRole, setUserRole] = useState(sessionStorage.getItem("demo_role") ?? "");
  const [tab, setTab] = useState<Tab>(() => defaultTab(userRole));
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  const [kpis, setKpis] = useState<Record<string, unknown>>({});
  const [trends, setTrends] = useState<Array<{ bucket: string; submissions: number; avgScore: number }>>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [health, setHealth] = useState<{
    status: string;
    model: string;
    averageLatencyMs: number;
    fallbackCount: number;
  } | null>(null);
  const [completion, setCompletion] = useState<Array<Record<string, unknown>>>([]);
  const [equity, setEquity] = useState<Array<Record<string, unknown>>>([]);
  const [insights, setInsights] = useState<AnalyticsInsightsResult | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [reportPreview, setReportPreview] = useState("");

  const [readMore, setReadMore] = useState(false);

  // Approval workflow state
  const [pendingLegal, setPendingLegal] = useState<ApprovalItem[]>([]);
  const [pendingSupervisor, setPendingSupervisor] = useState<ApprovalItem[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalNote, setApprovalNote] = useState<Record<string, string>>({});
  const [approvalExpanded, setApprovalExpanded] = useState<string | null>(null);
  const [urgencyOverrides, setUrgencyOverrides] = useState<Record<string, string>>({});

  // Submissions history tab
  const [submissionsHistory, setSubmissionsHistory] = useState<SubmissionHistoryItem[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [subHistUserGroup, setSubHistUserGroup] = useState("");
  const [subHistStatus, setSubHistStatus] = useState("");

  // Feedback detail drawer
  const [drawerDetail, setDrawerDetail] = useState<SubmissionDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [queueStatusFilter, setQueueStatusFilter] = useState("");
  const [queueGroupFilter, setQueueGroupFilter] = useState("");
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [aiDrilldown, setAiDrilldown] = useState<Record<string, unknown> | null>(null);

  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<FormTemplate | null>(null);
  const [openInstances, setOpenInstances] = useState<FormInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);

  const [deadlines, setDeadlines] = useState<TriggerWindows>({
    mr: DEADLINE_PRESETS.mr[0],
    vol: DEADLINE_PRESETS.vol[0],
    att: DEADLINE_PRESETS.att[0],
    fp: DEADLINE_PRESETS.fp[0],
  });

  const activeTemplate = useMemo(
    () => templates.find((t) => t.templateId === activeTemplateId) ?? null,
    [templates, activeTemplateId],
  );

  const selectedQueue = queue.find((q) => q.queueItemId === selectedQueueId) ?? null;

  const trendsSorted = useMemo(
    () => [...trends].sort((a, b) => a.bucket.localeCompare(b.bucket)),
    [trends],
  );
  const trendLabels = useMemo(() => trendsSorted.map((t) => t.bucket), [trendsSorted]);
  const submissionsData = useMemo(() => trendsSorted.map((t) => t.submissions), [trendsSorted]);
  const sentimentData = useMemo(() => trendsSorted.map((t) => Number(t.avgScore)), [trendsSorted]);

  const completionBars = useMemo<BarItem[]>(
    () =>
      completion.map((c) => {
        const rate = Number(c.completionRate ?? 0);
        const color = rate >= 70 ? "#2e7d32cc" : rate >= 40 ? "#f57c00cc" : "#c62828cc";
        return { label: formatUserGroup(String(c.userGroup)), value: Math.round(rate), color };
      }),
    [completion],
  );

  const equityBars = useMemo<BarItem[]>(() => {
    const map: Record<string, { value: number; totalSentiment: number; count: number }> = {};
    for (const e of equity) {
      const demo = String(e.demographic || "Not specified");
      if (!map[demo]) map[demo] = { value: 0, totalSentiment: 0, count: 0 };
      map[demo].value += Number(e.submissions ?? 0);
      const sent = Number(e.avgSentiment ?? 0);
      if (sent > 0) {
        map[demo].totalSentiment += sent;
        map[demo].count += 1;
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 8)
      .map(([label, d]) => {
        const avg = d.count > 0 ? d.totalSentiment / d.count : 0;
        const color = avg >= 4 ? "#2e7d32cc" : avg >= 2.5 ? "#f57c00cc" : "#1b3054cc";
        return { label: label === "unspecified" ? "Not specified" : label, value: d.value, color };
      });
  }, [equity]);

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const results = await Promise.allSettled([
        userRole === "legal_reviewer" || userRole === "admin"
          ? listPendingLegal()
          : Promise.resolve({ items: [] as ApprovalItem[] }),
        userRole === "supervisor" || userRole === "admin"
          ? listPendingSupervisor()
          : Promise.resolve({ items: [] as ApprovalItem[] }),
      ]);
      if (results[0].status === "fulfilled") setPendingLegal(results[0].value.items);
      if (results[1].status === "fulfilled") setPendingSupervisor(results[1].value.items);
    } catch {
      /* non-critical */
    } finally {
      setApprovalsLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    if (tab === "approvals") loadApprovals();
  }, [tab, loadApprovals]);

  async function loadSubmissionsHistory(userGroup?: string, status?: string) {
    setSubmissionsLoading(true);
    try {
      const data = await listSubmissionsHistory({ userGroup: userGroup || undefined, status: status || undefined });
      setSubmissionsHistory(data.items);
    } catch { /* ignore */ } finally {
      setSubmissionsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "submissions") loadSubmissionsHistory(subHistUserGroup, subHistStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleUrgencyOverride(submissionId: string, urgency: "low" | "medium" | "high") {
    try {
      await overrideUrgency(submissionId, urgency);
      setUrgencyOverrides((prev) => ({ ...prev, [submissionId]: urgency }));
      setNotice(`Urgency updated to ${urgency}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Override failed");
    }
  }

  async function handleFlagForLegal(submissionId: string) {
    try {
      await flagForLegal(submissionId, approvalNote[submissionId] || undefined);
      setNotice("Forwarded to legal team for review.");
      await loadApprovals();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function handleLegalApprove(submissionId: string) {
    try {
      await legalApprove(submissionId, approvalNote[submissionId] || undefined);
      setNotice("Resolved by legal. Submission returned to supervisor.");
      await loadApprovals();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function handleLegalReject(submissionId: string) {
    if (!confirm("Reject this submission? It will be excluded from analytics.")) return;
    try {
      await legalReject(submissionId, approvalNote[submissionId] || undefined);
      setNotice("Submission rejected by legal review.");
      await loadApprovals();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function handleSupervisorApprove(submissionId: string) {
    try {
      await supervisorApprove(submissionId, approvalNote[submissionId] || undefined);
      setNotice("Submission approved and published to analytics.");
      await loadApprovals();
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function handleSupervisorReject(submissionId: string) {
    if (!confirm("Reject this submission? It will be excluded from analytics.")) return;
    try {
      await supervisorReject(submissionId, approvalNote[submissionId] || undefined);
      setNotice("Submission rejected by supervisor.");
      await loadApprovals();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function handleViewFeedback(submissionId: string) {
    setDrawerDetail(null);
    setDrawerLoading(true);
    try {
      const detail = await getSubmissionDetail(submissionId);
      setDrawerDetail(detail);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not load submission detail");
      setDrawerLoading(false);
    } finally {
      setDrawerLoading(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, t, q, a, h, cfg, tpls, comp, eq] = await Promise.all([
        getAnalyticsKpisFiltered({}),
        getAnalyticsTrends(),
        getQueue({
          status: queueStatusFilter || undefined,
          userGroup: queueGroupFilter || undefined,
        }),
        getAnalyticsAnomalies(),
        getAiOpsHealth(),
        getAdminConfig(),
        listTemplates(),
        getAnalyticsCompletion(undefined),
        getAnalyticsEquity(),
      ]);
      setKpis(k);
      setTrends(t.points);
      setQueue(q.items);
      setAnomalies(a.items as Anomaly[]);
      setHealth(h);
      const tw = cfg.triggerWindows as TriggerWindows | undefined;
      if (tw) {
        setDeadlines({
          mr: tw.mr ?? DEADLINE_PRESETS.mr[0],
          vol: tw.vol ?? DEADLINE_PRESETS.vol[0],
          att: tw.att ?? DEADLINE_PRESETS.att[0],
          fp: tw.fp ?? DEADLINE_PRESETS.fp[0],
        });
      }
      setTemplates(tpls.items);
      setCompletion(comp.items);
      setEquity(eq.items);
      if (!activeTemplateId && tpls.items.length > 0) {
        setActiveTemplateId(tpls.items[0].templateId);
        setTemplateDraft({ ...tpls.items[0] });
      }
    } catch {
      setNotice("Could not load admin data");
    } finally {
      setLoading(false);
    }
  }, [queueStatusFilter, queueGroupFilter]);

  useEffect(() => {
    // legal_reviewer has no access to analytics/queue endpoints — skip
    if (userRole !== "legal_reviewer") load();
  }, [load, userRole]);

  useEffect(() => {
    if (activeTemplate) setTemplateDraft({ ...activeTemplate });
  }, [activeTemplate?.templateId]);

  const loadInstances = useCallback(async (templateId?: string) => {
    setInstancesLoading(true);
    try {
      const res = await listFormInstances(templateId ? { templateId } : undefined);
      setOpenInstances(res.items);
    } catch {
      /* non-critical */
    } finally {
      setInstancesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "forms") loadInstances(activeTemplateId ?? undefined);
  }, [tab, activeTemplateId, loadInstances]);

  async function handleDeleteInstance(instanceId: string) {
    if (!confirm("Remove this survey instance? Respondents with the link will no longer be able to submit.")) return;
    try {
      await deleteFormInstance(instanceId);
      setNotice("Survey instance removed.");
      loadInstances(activeTemplateId ?? undefined);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function updateQuestion(idx: number, patch: Partial<FormQuestion>) {
    if (!templateDraft) return;
    const questions = templateDraft.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q));
    setTemplateDraft({ ...templateDraft, questions });
  }

  function updateOption(qIdx: number, oIdx: number, value: string) {
    if (!templateDraft) return;
    const questions = templateDraft.questions.map((q, i) => {
      if (i !== qIdx) return q;
      const options = (q.options ?? []).map((o, j) => (j === oIdx ? value : o));
      return { ...q, options };
    });
    setTemplateDraft({ ...templateDraft, questions });
  }

  function addOption(qIdx: number) {
    if (!templateDraft) return;
    const questions = templateDraft.questions.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: [...(q.options ?? []), ""] };
    });
    setTemplateDraft({ ...templateDraft, questions });
  }

  function removeOption(qIdx: number, oIdx: number) {
    if (!templateDraft) return;
    const questions = templateDraft.questions.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: (q.options ?? []).filter((_, j) => j !== oIdx) };
    });
    setTemplateDraft({ ...templateDraft, questions });
  }

  function addQuestion(type: FormQuestion["type"]) {
    if (!templateDraft) return;
    const newQ: FormQuestion = {
      id: `q_${Date.now()}`,
      type,
      label: "",
      required: false,
      options: type === "likert" ? ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
               : type === "dropdown" || type === "multi_select" ? ["Option 1"] : undefined,
    };
    setTemplateDraft({ ...templateDraft, questions: [...templateDraft.questions, newQ] });
  }

  function removeQuestion(idx: number) {
    if (!templateDraft) return;
    if (!confirm("Remove this question? It will be deleted when you publish.")) return;
    setTemplateDraft({
      ...templateDraft,
      questions: templateDraft.questions.filter((_, i) => i !== idx),
    });
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    if (!templateDraft) return;
    const qs = [...templateDraft.questions];
    const target = idx + dir;
    if (target < 0 || target >= qs.length) return;
    [qs[idx], qs[target]] = [qs[target], qs[idx]];
    setTemplateDraft({ ...templateDraft, questions: qs });
  }

  async function handleGenerateInsights() {
    setInsightsLoading(true);
    try {
      const result = await generateAnalyticsInsights({});
      setInsights(result);
      setNotice(`Insights ready (${result.submissionCount} submissions in scope).`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Insights failed");
    } finally {
      setInsightsLoading(false);
    }
  }

  async function handleQuickReport(type: "weekly_brief" | "monthly_division" | "quarterly_cfsr") {
    try {
      const r = await generateReport(type);
      setReportPreview(r.bodyPreview ?? "");
      setNotice(`${formatReportType(type)} draft generated.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Report failed");
    }
  }

  async function handleSaveDeadlines() {
    try {
      await updateAdminConfig({ triggerWindows: deadlines });
      setNotice("Survey deadlines saved (demo configuration).");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleSaveTemplate() {
    if (!templateDraft) return;
    try {
      await updateTemplate(templateDraft.templateId, {
        name: templateDraft.name,
        userGroup: templateDraft.userGroup,
        version: (templateDraft.version ?? 1) + 1,
        questions: templateDraft.questions,
        nextStepsLabel: templateDraft.nextStepsLabel ?? "Next Steps",
      });
      showToast("✓ Form changes published successfully");
      await load();
    } catch (e) {
      showToast(`✗ ${e instanceof Error ? e.message : "Publish failed"}`);
    }
  }

  const approvalsBadge =
    (userRole === "legal_reviewer" || userRole === "admin" ? pendingLegal.length : 0) +
    (userRole === "supervisor" || userRole === "admin" ? pendingSupervisor.length : 0);

  const allTabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "dashboard",     label: "Dashboard" },
    { id: "queue",         label: "Queue" },
    { id: "approvals",     label: "Approvals", badge: approvalsBadge > 0 ? approvalsBadge : undefined },
    { id: "submissions",   label: "Submissions" },
    { id: "forms",         label: "Survey forms" },
    { id: "configuration", label: "Deadlines" },
  ];

  const allowed = allowedTabs(userRole);
  const tabs = allTabs.filter((t) => allowed.includes(t.id));

  return (
    <div className="platform-shell">
      <header className="admin-topbar">
        <Link to="/" className="admin-back-link">
          ← Platforms
        </Link>
        <div>
          <div className="admin-eyebrow">Administration</div>
          <div className="admin-title">Feedback Analytics</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Role switcher */}
          <select
            className="dcf-input"
            style={{ width: 150, margin: 0 }}
            value={userRole}
            onChange={(e) => {
              const role = e.target.value;
              const username = role === "admin" ? "admin_demo" : role === "supervisor" ? "supervisor_demo" : "legal_demo";
              sessionStorage.setItem("demo_role", role);
              sessionStorage.setItem("demo_username", username);
              setUserRole(role);
              setTab(defaultTab(role));
            }}
          >
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="legal_reviewer">Legal Reviewer</option>
          </select>
          {/* Refresh — admin & supervisor only */}
          {userRole !== "legal_reviewer" && (
            <button type="button" className="dcf-btn dcf-btn-ghost" onClick={() => load()} disabled={loading}>
              Refresh
            </button>
          )}
          {/* Export — admin only */}
          {userRole === "admin" && (
            <button
              type="button"
              className="dcf-btn dcf-btn-ghost"
              onClick={() => requestExport("csv").then((r) => setNotice(`Export ${r.status}`))}
            >
              Export
            </button>
          )}
          <div className="inapp-admin-badge">
            <img src={inappLogo} alt="InApp" />
            <span className="inapp-admin-demo-tag">InApp demo</span>
          </div>
        </div>
      </header>

      <nav className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge != null && (
              <span className="apv-tab-badge">{t.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="admin-main">
        {notice && <div className="admin-notice">{notice}</div>}

        {tab === "dashboard" && (() => {
          const submFirst = submissionsData[0] ?? 0;
          const submLast = submissionsData[submissionsData.length - 1] ?? 0;
          const kpiDefs = [
            { key: "submissions", label: "Submissions", raw: Number(kpis.totalSubmissions ?? 0) },
            { key: "responseRate", label: "Response rate", raw: Number(kpis.responseRate ?? 0) },
            { key: "openQueue", label: "Open queue", raw: Number(kpis.openQueueItems ?? 0) },
            { key: "highUrgency", label: "Requires Action", raw: Number(kpis.pendingApprovalCount ?? 0), clickable: true },
            { key: "avgSentiment", label: "Overall sentiment", raw: Number(kpis.avgSentiment ?? 0) },
          ];

          // Per-feedback-type average sentiment derived from equity data
          const GROUP_LABELS: Record<string, string> = {
            mandated_reporter: "Mandated Reporter",
            volunteer: "Volunteer",
            attorney: "Attorney",
            foster_parent: "Foster Parent",
          };
          const groupSentimentMap: Record<string, { total: number; count: number }> = {};
          for (const e of equity) {
            const grp = String(e.userGroup ?? "");
            if (!grp) continue;
            if (!groupSentimentMap[grp]) groupSentimentMap[grp] = { total: 0, count: 0 };
            const s = Number(e.avgSentiment ?? 0);
            if (s > 0) { groupSentimentMap[grp].total += s; groupSentimentMap[grp].count += 1; }
          }
          const groupSentimentCards = Object.entries(groupSentimentMap)
            .map(([grp, d]) => ({ grp, avg: d.count > 0 ? d.total / d.count : 0 }))
            .filter((x) => x.avg > 0);

          return (
            <>
              {/* ── Traffic-light KPI row ── */}
              <div className="dash-kpi-grid">
                {kpiDefs.map((kpi) => {
                  const { color, display } = kpiLight(kpi.key, kpi.raw, submFirst, submLast);
                  return (
                    <div
                      key={kpi.key}
                      className={`dash-kpi-card${kpi.clickable ? " dash-kpi-card--link" : ""}`}
                      style={{ borderLeftColor: color }}
                      onClick={kpi.clickable ? () => setTab("approvals") : undefined}
                      role={kpi.clickable ? "button" : undefined}
                      tabIndex={kpi.clickable ? 0 : undefined}
                      onKeyDown={kpi.clickable ? (e) => e.key === "Enter" && setTab("approvals") : undefined}
                    >
                      <div className="dash-kpi-label">{kpi.label}</div>
                      <div className="dash-kpi-value" style={{ color }}>{display}</div>
                      <span className="dash-kpi-dot" style={{ background: color }} />
                      {kpi.clickable && <span className="dash-kpi-arrow">→</span>}
                    </div>
                  );
                })}
              </div>

              {/* ── Per-type sentiment row ── */}
              {groupSentimentCards.length > 0 && (
                <div className="dash-kpi-grid" style={{ marginTop: 10 }}>
                  {groupSentimentCards.map(({ grp, avg }) => {
                    const color = avg >= 4 ? "#2e7d32" : avg >= 2.5 ? "#f57c00" : "#c62828";
                    return (
                      <div key={grp} className="dash-kpi-card" style={{ borderLeftColor: color }}>
                        <div className="dash-kpi-label">{GROUP_LABELS[grp] ?? grp} sentiment</div>
                        <div className="dash-kpi-value" style={{ color }}>{avg.toFixed(2)}</div>
                        <span className="dash-kpi-dot" style={{ background: color }} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Charts — one metric per card ── */}
              <SingleLineChart
                title="Submission volume"
                points={submissionsData}
                labels={trendLabels}
                unit=" submissions"
                height={200}
              />

              <SingleLineChart
                title="Overall sentiment score"
                points={sentimentData}
                labels={trendLabels}
                unit=" / 5"
                height={200}
              />

              <div className="dash-charts-2col">
                <BarChart
                  title="Completion rate by group"
                  items={completionBars}
                  unit="%"
                  horizontal
                  height={Math.max(160, completionBars.length * 38 + 24)}
                  maxValue={100}
                />
              </div>

              {/* ── Read More ── */}
              <div className="dash-read-more-row">
                <button
                  type="button"
                  className="dash-read-more-btn"
                  onClick={() => setReadMore((v) => !v)}
                >
                  {readMore ? "▲ Show less" : "▼ Read more — AI insights, reports & generation"}
                </button>
              </div>

              {readMore && (
                <div className="dash-expanded">
                  <div className="card card-elevated" style={{ marginBottom: 16, borderLeft: `4px solid ${C.teal}` }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.navy }}>AI insights</h2>
                        <p style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>
                          Grounded analysis from stored feedback — observations, concerns, and trends.
                        </p>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <button
                          type="button"
                          className="dcf-btn dcf-btn-primary"
                          onClick={handleGenerateInsights}
                          disabled={insightsLoading}
                        >
                          {insightsLoading ? "Analyzing…" : insights ? "Refresh insights" : "Generate insights"}
                        </button>
                        <button
                          type="button"
                          className="dcf-btn dcf-btn-ghost"
                          onClick={() => handleQuickReport("weekly_brief")}
                        >
                          Weekly brief
                        </button>
                        <button
                          type="button"
                          className="dcf-btn dcf-btn-ghost"
                          onClick={() => handleQuickReport("monthly_division")}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          className="dcf-btn dcf-btn-ghost"
                          onClick={() => handleQuickReport("quarterly_cfsr")}
                        >
                          Quarterly
                        </button>
                      </div>
                    </div>
                    {insights ? (
                      <div
                        style={{
                          marginTop: 16,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 16,
                        }}
                      >
                        {[
                          { title: "Observations", items: insights.observations, color: C.teal },
                          { title: "Concerns", items: insights.concerns, color: C.coral },
                          { title: "Trends", items: insights.trends, color: C.purple },
                        ].map((block) => (
                          <div key={block.title}>
                            <div
                              style={{ fontSize: 12, fontWeight: 700, color: block.color, marginBottom: 6 }}
                            >
                              {block.title}
                            </div>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: 16,
                                fontSize: 13,
                                color: C.textMid,
                                lineHeight: 1.65,
                              }}
                            >
                              {block.items.map((item) => (
                                <li key={item}>{humanizeUserFacingText(item)}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: C.textLight, marginTop: 12 }}>
                        Click "Generate insights" to run an AI analysis of the current feedback data.
                      </p>
                    )}
                      {reportPreview && (
                      <pre
                        style={{
                          fontSize: 12,
                          marginTop: 14,
                          padding: 14,
                          background: "#f7f9fc",
                          borderRadius: 8,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.65,
                        }}
                      >
                        {humanizeUserFacingText(reportPreview)}
                      </pre>
                    )}
                    {/* AI provider footnote */}
                    {health && (
                      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: C.textLight }}>
                        <span
                          style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: health.status === "ok" ? "#2e7d32" : "#f57c00",
                            display: "inline-block", flexShrink: 0,
                          }}
                        />
                        AI provider: {health.status === "ok" ? "Operational" : health.status} · {health.model} · {health.averageLatencyMs}ms avg · {health.fallbackCount} fallbacks
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {tab === "approvals" && (
          <div className="apv-shell">
            {/* Role context banner */}
            <div className="apv-role-banner" style={{
              background: ROLE_DISPLAY[userRole]?.bg ?? "#f0f4fb",
              border: `1.5px solid ${ROLE_DISPLAY[userRole]?.color ?? "#4c607a"}33`,
              color: ROLE_DISPLAY[userRole]?.color ?? "#4c607a",
            }}>
              <span className="apv-role-banner-icon">
                {userRole === "legal_reviewer" ? "⚖" : userRole === "supervisor" ? "👤" : "🛡"}
              </span>
              <span>
                <strong>Signed in as {ROLE_DISPLAY[userRole]?.label ?? userRole}.</strong>
                {userRole === "legal_reviewer" && " You can act on the Legal Review gate only."}
                {userRole === "supervisor" && " You can act on the Supervisor Approval gate. Legal-cleared submissions appear here automatically."}
                {userRole === "admin" && " You have full access to both approval gates."}
              </span>
            </div>

            {approvalsLoading && (
              <p style={{ fontSize: 14, color: C.textLight, marginBottom: 12 }}>Loading pending approvals…</p>
            )}

            {/* ── Legal Review gate (attorney submissions) ── */}
            {(userRole === "legal_reviewer" || userRole === "admin") && (
              <div className="card apv-section" style={{ borderLeft: `4px solid #c62828` }}>
                <div className="apv-section-header">
                  <div>
                    <div className="apv-section-title" style={{ color: "#c62828" }}>
                      ⚖ Legal Review Gate
                    </div>
                    <div className="apv-section-sub">
                      Attorney submissions require legal team clearance before supervisor sign-off.
                      Any privilege concerns or policy conflicts must be flagged immediately.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dcf-btn dcf-btn-ghost"
                    onClick={loadApprovals}
                    disabled={approvalsLoading}
                  >
                    Refresh
                  </button>
                </div>

                {pendingLegal.length === 0 ? (
                  <div className="apv-empty">No attorney submissions pending legal review.</div>
                ) : (
                  <div className="apv-list">
                    {pendingLegal.map((item) => (
                      <div key={item.submissionId} className="apv-card apv-card--legal">
                        <div className="apv-card-top">
                          <div className="apv-card-meta">
                            <span className="apv-badge apv-badge--legal">Attorney · Legal review required</span>
                            {item.privilegeTagged && (
                              <span className="apv-badge apv-badge--priv">Privilege tagged</span>
                            )}
                            <span className="apv-sev apv-sev--urgency" data-urgency={item.urgency}>
                              {item.urgency ?? "—"} urgency
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: C.textLight }}>
                            {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}
                          </span>
                        </div>

                        <div className="apv-card-body">
                          {item.explainabilitySummary && (
                            <div className="apv-explain">{item.explainabilitySummary}</div>
                          )}
                          <div className="apv-kpi-row">
                            {item.sentimentScore != null && (
                              <span className="apv-kpi">
                                Sentiment <strong>{item.sentimentScore.toFixed(1)}/5</strong>
                              </span>
                            )}
                            {item.officeId && (
                              <span className="apv-kpi">
                                Office <strong>{item.officeId}</strong>
                              </span>
                            )}
                            <span className="apv-kpi" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              Urgency
                              {(() => {
                                const val = (urgencyOverrides[item.submissionId] ?? item.urgency ?? "low") as "low" | "medium" | "high";
                                return (
                                  <select
                                    className="apv-urgency-select"
                                    data-urgency={val}
                                    value={val}
                                    onChange={(e) => handleUrgencyOverride(item.submissionId, e.target.value as "low" | "medium" | "high")}
                                  >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                  </select>
                                );
                              })()}
                            </span>
                          </div>

                          {item.approvalHistory.length > 0 && (
                            <div className="apv-history">
                              {item.approvalHistory.map((h, i) => (
                                <div key={i} className="apv-history-item">
                                  <span className="apv-history-action">{h.action}</span>
                                  <span style={{ color: C.textLight }}>
                                    {h.reviewerUsername} · {new Date(h.createdAt).toLocaleString()}
                                  </span>
                                  {h.note && <span className="apv-history-note">{h.note}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="apv-card-actions">
                          <button
                            type="button"
                            className="dcf-btn apv-btn-view"
                            onClick={() => handleViewFeedback(item.submissionId)}
                          >
                            👁 View full feedback
                          </button>
                          <textarea
                            className="apv-note-input"
                            placeholder="Optional note or reason…"
                            value={approvalNote[item.submissionId] ?? ""}
                            onChange={(e) =>
                              setApprovalNote((prev) => ({ ...prev, [item.submissionId]: e.target.value }))
                            }
                            rows={2}
                          />
                          <div className="apv-btn-row">
                            <button
                              type="button"
                              className="dcf-btn apv-btn-approve"
                              onClick={() => handleLegalApprove(item.submissionId)}
                            >
                              ✓ Resolve
                            </button>
                            <button
                              type="button"
                              className="dcf-btn apv-btn-reject"
                              onClick={() => handleLegalReject(item.submissionId)}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Supervisor Approval gate ── */}
            {(userRole === "supervisor" || userRole === "admin") && (
              <div className="card apv-section" style={{ borderLeft: `4px solid #1565c0` }}>
                <div className="apv-section-header">
                  <div>
                    <div className="apv-section-title" style={{ color: "#1565c0" }}>
                      👤 Supervisor Approval Gate
                    </div>
                    <div className="apv-section-sub">
                      Submissions awaiting supervisor sign-off before they are published to analytics.
                      All submissions arrive here for supervisor sign-off. Attorney submissions can be forwarded to the legal team if they require deeper review, then return here for final approval.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dcf-btn dcf-btn-ghost"
                    onClick={loadApprovals}
                    disabled={approvalsLoading}
                  >
                    Refresh
                  </button>
                </div>

                {pendingSupervisor.length === 0 ? (
                  <div className="apv-empty">No submissions pending supervisor approval.</div>
                ) : (
                  <div className="apv-list">
                    {pendingSupervisor.map((item) => {
                      const legalRoundCount = item.approvalHistory.filter((h) => h.action === "legal_resolved").length;
                      const isAttorney = item.userGroup === "attorney";
                      const hasBeenToLegal = item.approvalHistory.some((h) => h.action === "flagged_for_legal");
                      return (
                        <div
                          key={item.submissionId}
                          className={`apv-card apv-card--supervisor${legalRoundCount > 0 ? " apv-card--legal-cleared" : ""}`}
                        >
                          <div className="apv-card-top">
                            <div className="apv-card-meta">
                              <span className={`apv-badge apv-badge--group`}>
                                {item.userGroup.replace(/_/g, " ")}
                              </span>
                              {legalRoundCount > 0 && (
                                <span className="apv-badge apv-badge--cleared">
                                  ⚖ Legal reviewed{legalRoundCount > 1 ? ` (×${legalRoundCount})` : ""}
                                </span>
                              )}
                              {isAttorney && !hasBeenToLegal && (
                                <span className="apv-badge" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                                  Attorney · awaiting review
                                </span>
                              )}
                              <span className="apv-sev apv-sev--urgency" data-urgency={item.urgency}>
                                {item.urgency ?? "—"} urgency
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: C.textLight }}>
                              {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}
                            </span>
                          </div>

                          <div className="apv-card-body">
                            {item.explainabilitySummary && (
                              <div className="apv-explain">{item.explainabilitySummary}</div>
                            )}
                            <div className="apv-kpi-row">
                              {item.sentimentScore != null && (
                                <span className="apv-kpi">
                                  Sentiment <strong>{item.sentimentScore.toFixed(1)}/5</strong>
                                </span>
                              )}
                              {item.officeId && (
                                <span className="apv-kpi">
                                  Office <strong>{item.officeId}</strong>
                                </span>
                              )}
                              <span className="apv-kpi" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                Urgency
                                {(() => {
                                  const val = (urgencyOverrides[item.submissionId] ?? item.urgency ?? "low") as "low" | "medium" | "high";
                                  return (
                                    <select
                                      className="apv-urgency-select"
                                      data-urgency={val}
                                      value={val}
                                      onChange={(e) => handleUrgencyOverride(item.submissionId, e.target.value as "low" | "medium" | "high")}
                                    >
                                      <option value="low">Low</option>
                                      <option value="medium">Medium</option>
                                      <option value="high">High</option>
                                    </select>
                                  );
                                })()}
                              </span>
                            </div>

                            {item.approvalHistory.length > 0 && (
                              <div className="apv-history">
                                {item.approvalHistory.map((h, i) => (
                                  <div key={i} className="apv-history-item">
                                    <span className="apv-history-action">{h.action}</span>
                                    <span style={{ color: C.textLight }}>
                                      {h.reviewerUsername} · {new Date(h.createdAt).toLocaleString()}
                                    </span>
                                    {h.note && <span className="apv-history-note">{h.note}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="apv-card-actions">
                            <button
                              type="button"
                              className="dcf-btn apv-btn-view"
                              onClick={() => handleViewFeedback(item.submissionId)}
                            >
                              👁 View full feedback
                            </button>
                            <textarea
                              className="apv-note-input"
                              placeholder="Optional note for audit trail…"
                              value={approvalNote[item.submissionId] ?? ""}
                              onChange={(e) =>
                                setApprovalNote((prev) => ({
                                  ...prev,
                                  [item.submissionId]: e.target.value,
                                }))
                              }
                              rows={2}
                            />
                            <div className="apv-btn-row">
                              <button
                                type="button"
                                className="dcf-btn apv-btn-approve"
                                onClick={() => handleSupervisorApprove(item.submissionId)}
                              >
                                ✓ Approve — publish to analytics
                              </button>
                              {isAttorney && (
                                <button
                                  type="button"
                                  className="dcf-btn apv-btn-flag-legal"
                                  onClick={() => handleFlagForLegal(item.submissionId)}
                                >
                                  {legalRoundCount > 0 ? "⚖ Return to legal" : "⚖ Flag for legal review"}
                                </button>
                              )}
                              <button
                                type="button"
                                className="dcf-btn apv-btn-reject"
                                onClick={() => handleSupervisorReject(item.submissionId)}
                              >
                                ✗ Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "submissions" && (
          <div className="card">
            <div className="subhist-toolbar">
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Submissions history</h2>
              <div className="subhist-filters">
                <select
                  className="dcf-input"
                  style={{ width: 170 }}
                  value={subHistUserGroup}
                  onChange={(e) => {
                    setSubHistUserGroup(e.target.value);
                    loadSubmissionsHistory(e.target.value, subHistStatus);
                  }}
                >
                  <option value="">All groups</option>
                  <option value="mandated_reporter">Mandated Reporter</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="attorney">Attorney</option>
                  <option value="foster_parent">Foster Parent</option>
                </select>
                <select
                  className="dcf-input"
                  style={{ width: 195 }}
                  value={subHistStatus}
                  onChange={(e) => {
                    setSubHistStatus(e.target.value);
                    loadSubmissionsHistory(subHistUserGroup, e.target.value);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="pending_supervisor">Pending supervisor</option>
                  <option value="pending_legal">Pending legal</option>
                  <option value="supervisor_approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button
                  type="button"
                  className="dcf-btn dcf-btn-ghost"
                  onClick={() => loadSubmissionsHistory(subHistUserGroup, subHistStatus)}
                  disabled={submissionsLoading}
                >
                  Refresh
                </button>
              </div>
            </div>

            {submissionsLoading ? (
              <div style={{ padding: 24, textAlign: "center", color: C.textLight }}>Loading…</div>
            ) : submissionsHistory.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: C.textLight }}>No submissions match the current filters.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table subhist-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Group</th>
                      <th>Topic</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Sentiment</th>
                      <th>Urgency</th>
                      <th>Stage trail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissionsHistory.map((item) => {
                      const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
                        pending_supervisor: { label: "Awaiting supervisor", color: "#92400e", bg: "#fffbeb" },
                        pending_legal:      { label: "Pending legal",       color: "#1e40af", bg: "#dbeafe" },
                        supervisor_approved: { label: "Approved",           color: "#166534", bg: "#dcfce7" },
                        legal_approved:     { label: "Legal cleared",       color: "#1d4ed8", bg: "#dbeafe" },
                        rejected:           { label: "Rejected",            color: "#991b1b", bg: "#fee2e2" },
                      };
                      const sm = statusMeta[item.approvalStatus] ?? { label: item.approvalStatus, color: "#374151", bg: "#f3f4f6" };
                      const trail = item.approvalHistory.map((h) =>
                        h.action === "flagged_for_legal" ? "→ Legal" :
                        h.action === "legal_resolved"    ? "← Legal resolved" :
                        h.action === "supervisor_approved" ? "✓ Approved" :
                        h.action === "supervisor_rejected" ? "✗ Rejected" :
                        h.action === "legal_rejected"    ? "✗ Legal rejected" :
                        h.action
                      ).join("  ");
                      const urgencyColor: Record<string, string> = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };
                      return (
                        <tr key={item.submissionId}>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>
                            {item.submissionId.slice(0, 12)}…
                          </td>
                          <td>{formatUserGroup(item.userGroup)}</td>
                          <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.topic ?? "—"}
                          </td>
                          <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                            {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 99,
                                fontSize: 11,
                                fontWeight: 600,
                                color: sm.color,
                                background: sm.bg,
                              }}
                            >
                              {sm.label}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {item.sentimentScore != null ? item.sentimentScore.toFixed(1) : "—"}
                          </td>
                          <td>
                            {item.urgency ? (
                              <span style={{ fontWeight: 600, color: urgencyColor[item.urgency] ?? "#374151", textTransform: "capitalize" }}>
                                {item.urgency}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={{ fontSize: 11, color: C.textLight, maxWidth: 240 }}>
                            {trail || "—"}
                            {item.approvalHistory.filter((h) => h.note).map((h, i) => (
                              <div key={i} style={{ marginTop: 2, fontSize: 10, fontStyle: "italic" }}>
                                "{h.note}" — {h.reviewerUsername}
                              </div>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "queue" && (
          <div className="admin-split">
            <div className="card">
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Supervisor queue</h2>
                <select className="dcf-input" style={{ width: 140 }} value={queueStatusFilter} onChange={(e) => setQueueStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_review">In review</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select className="dcf-input" style={{ width: 160 }} value={queueGroupFilter} onChange={(e) => setQueueGroupFilter(e.target.value)}>
                  <option value="">All groups</option>
                  <option value="mandated_reporter">Mandated Reporter</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="attorney">Attorney</option>
                  <option value="foster_parent">Foster Parent</option>
                </select>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Submission</th>
                    <th>Group</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ color: C.textLight }}>
                        No items
                      </td>
                    </tr>
                  ) : (
                    queue.map((q) => (
                      <tr
                        key={q.queueItemId}
                        className={selectedQueueId === q.queueItemId ? "selected" : ""}
                        onClick={() => setSelectedQueueId(q.queueItemId)}
                      >
                        <td className="mono">{q.submissionId.slice(-8)}</td>
                        <td>{formatUserGroup(q.userGroup)}</td>
                        <td>{formatQueueStatus(q.status)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {q.status !== "resolved" ? (
                            <button
                              type="button"
                              className="dcf-btn dcf-btn-ghost"
                              style={{ padding: "2px 8px", fontSize: 11 }}
                              onClick={() => updateQueueStatus(q.queueItemId, "resolved").then(() => load())}
                            >
                              Resolve
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: C.textLight }}>Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>Detail</h3>
              {!selectedQueue ? (
                <p style={{ fontSize: 12, color: C.textLight }}>Select a row.</p>
              ) : (
                <>
                  <p style={{ fontSize: 12, marginBottom: 8 }}>
                    <span className="mono">{selectedQueue.submissionId}</span>
                    <br />
                    {selectedQueue.reason}
                  </p>
                  <button
                    type="button"
                    className="dcf-btn dcf-btn-ghost"
                    style={{ marginTop: 8, width: "100%" }}
                    onClick={() => getAiResult(selectedQueue.submissionId).then(setAiDrilldown)}
                  >
                    View AI summary
                  </button>
                  {aiDrilldown && (
                    <p style={{ fontSize: 12, color: C.textMid, marginTop: 10, lineHeight: 1.5 }}>
                      Urgency: <strong>{String(aiDrilldown.urgency ?? "")}</strong>
                      <br />
                      {String(aiDrilldown.explainabilitySummary ?? "")}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {tab === "forms" && (
          <div className="admin-config-layout card" style={{ padding: 0, overflow: "hidden" }}>
            <aside className="admin-config-sidebar">
              <div className="admin-config-sidebar-head">Templates</div>
              {templates.map((t) => (
                <button
                  key={t.templateId}
                  type="button"
                  className={`admin-config-nav${activeTemplateId === t.templateId ? " active" : ""}`}
                  onClick={() => {
                    setActiveTemplateId(t.templateId);
                    setTemplateDraft({ ...t });
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: C.textLight }}>{formatUserGroup(t.userGroup)}</div>
                </button>
              ))}
            </aside>

            <div className="admin-config-editor">
              {!templateDraft ? (
                <p style={{ color: C.textLight, fontSize: 15 }}>Select a template from the list.</p>
              ) : (
                <>
                  {/* ── Template header ── */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <h2 style={{ fontSize: 19, fontWeight: 700, color: C.navy }}>{templateDraft.name}</h2>
                      <span style={{ fontSize: 13, color: C.textLight }} className="mono">{templateDraft.templateId}</span>
                    </div>
                    <p style={{ fontSize: 13, color: C.textMid, marginTop: 2 }}>
                      {formatUserGroup(templateDraft.userGroup)} · v{templateDraft.version}
                    </p>
                  </div>

                  <label className="admin-field-label">Form display name</label>
                  <input
                    className="dcf-input"
                    value={templateDraft.name}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })}
                  />

                  <label className="admin-field-label" style={{ marginTop: 12 }}>Next-steps label</label>
                  <input
                    className="dcf-input"
                    value={templateDraft.nextStepsLabel ?? "Next Steps"}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, nextStepsLabel: e.target.value })}
                  />

                  {/* ── Questions ── */}
                  <div className="admin-questions-head" style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: C.navy }}>
                      Questions ({templateDraft.questions.length})
                    </span>
                  </div>

                  {templateDraft.questions.length === 0 && (
                    <p style={{ fontSize: 14, color: C.textLight, margin: "12px 0" }}>
                      No questions yet — add one below.
                    </p>
                  )}

                  {templateDraft.questions.map((q, idx) => (
                    <div key={q.id} className="form-q-card">
                      {/* Card header: type badge + id + reorder + delete */}
                      <div className="form-q-card-top">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" }}>
                          <select
                            className="form-q-type-select"
                            value={q.type}
                            onChange={(e) => {
                              const newType = e.target.value as FormQuestion["type"];
                              const defaults: Partial<FormQuestion> = {};
                              if (newType === "likert" && !q.options?.length) {
                                defaults.options = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
                              } else if ((newType === "dropdown" || newType === "multi_select") && !q.options?.length) {
                                defaults.options = ["Option 1"];
                              }
                              updateQuestion(idx, { type: newType, ...defaults });
                            }}
                          >
                            <option value="likert">Likert (rating)</option>
                            <option value="text">Text (free-form)</option>
                            <option value="dropdown">Dropdown</option>
                            <option value="multi_select">Multi-select</option>
                            <option value="attestation">Attestation</option>
                          </select>
                          <span style={{ fontSize: 12, color: C.textLight }} className="mono">{q.id}</span>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMid, cursor: "pointer", marginLeft: "auto" }}>
                            <input
                              type="checkbox"
                              checked={q.required ?? false}
                              onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                            />
                            Required
                          </label>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="dcf-btn form-q-move-btn"
                            onClick={() => moveQuestion(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Move up"
                            title="Move up"
                          >↑</button>
                          <button
                            type="button"
                            className="dcf-btn form-q-move-btn"
                            onClick={() => moveQuestion(idx, 1)}
                            disabled={idx === templateDraft.questions.length - 1}
                            aria-label="Move down"
                            title="Move down"
                          >↓</button>
                          <button
                            type="button"
                            className="dcf-btn form-q-delete-btn"
                            onClick={() => removeQuestion(idx)}
                            aria-label="Delete question"
                            title="Delete question"
                          >🗑</button>
                        </div>
                      </div>

                      <label className="admin-field-label">Question label</label>
                      <input
                        className="dcf-input"
                        value={q.label}
                        placeholder="Enter question text…"
                        onChange={(e) => updateQuestion(idx, { label: e.target.value })}
                        style={{ marginBottom: 8 }}
                      />

                      <label className="admin-field-label">Description / helper text</label>
                      <textarea
                        className="dcf-input"
                        rows={2}
                        value={q.description ?? ""}
                        placeholder="Optional — shown beneath the question label"
                        onChange={(e) => updateQuestion(idx, { description: e.target.value || undefined })}
                        style={{ resize: "vertical", lineHeight: 1.5 }}
                      />

                      {(q.type === "likert" || q.type === "dropdown" || q.type === "multi_select") && (
                        <div style={{ marginTop: 12 }}>
                          <label className="admin-field-label">
                            {q.type === "likert" ? "Scale option labels (1 → 5)" : "Options"}
                          </label>
                          {(q.options ?? []).map((opt, oIdx) => (
                            <div key={oIdx} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                              {q.type === "likert" && (
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.textLight, minWidth: 20, textAlign: "right" }}>
                                  {oIdx + 1}
                                </span>
                              )}
                              <input
                                className="dcf-input"
                                value={opt}
                                onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                              />
                              {q.type !== "likert" && opt.toLowerCase() === "other" && (
                                <span style={{ fontSize: 11, color: C.teal, whiteSpace: "nowrap", flexShrink: 0 }} title="Respondents selecting 'Other' will see a free-text field">
                                  ✎ textfield
                                </span>
                              )}
                              {q.type !== "likert" && (
                                <button
                                  type="button"
                                  className="dcf-btn dcf-btn-ghost"
                                  style={{ padding: "6px 10px", fontSize: 16, flexShrink: 0 }}
                                  onClick={() => removeOption(idx, oIdx)}
                                  aria-label="Remove option"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                          {q.type !== "likert" && (
                            <button
                              type="button"
                              className="dcf-btn dcf-btn-ghost"
                              style={{ fontSize: 13, marginTop: 4 }}
                              onClick={() => addOption(idx)}
                            >
                              + Add option
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* ── Add question ── */}
                  <div className="form-q-add-row">
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.textMid }}>Add question:</span>
                    {(["likert", "text", "dropdown", "multi_select", "attestation"] as FormQuestion["type"][]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        className="dcf-btn form-q-add-btn"
                        onClick={() => addQuestion(type)}
                      >
                        + {type === "likert" ? "Likert" : type === "text" ? "Text" : type === "dropdown" ? "Dropdown" : type === "multi_select" ? "Multi-select" : "Attestation"}
                      </button>
                    ))}
                  </div>

                  <button type="button" className="dcf-btn dcf-btn-primary" style={{ marginTop: 20 }} onClick={handleSaveTemplate}>
                    Publish changes
                  </button>

                  {/* ── Open survey instances ── */}
                  <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>Open survey instances</h3>
                      <button
                        type="button"
                        className="dcf-btn dcf-btn-ghost"
                        style={{ fontSize: 13 }}
                        onClick={() => loadInstances(activeTemplateId ?? undefined)}
                        disabled={instancesLoading}
                      >
                        {instancesLoading ? "Loading…" : "Refresh"}
                      </button>
                    </div>

                    {openInstances.filter((i) => i.templateId === activeTemplateId).length === 0 ? (
                      <p style={{ fontSize: 14, color: C.textLight }}>No open instances for this template.</p>
                    ) : (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Ref</th>
                            <th>Status</th>
                            <th>Expires</th>
                            <th>Submissions</th>
                            <th>Link</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {openInstances
                            .filter((i) => i.templateId === activeTemplateId)
                            .map((inst) => (
                              <tr key={inst.surveyInstanceId}>
                                <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                                  {inst.triggerRef ?? inst.surveyInstanceId.slice(-8)}
                                </td>
                                <td>{inst.status}</td>
                                <td style={{ fontSize: 13, color: C.textMid }}>
                                  {inst.expiresAt ? new Date(inst.expiresAt).toLocaleDateString() : "—"}
                                </td>
                                <td style={{ textAlign: "center" }}>{inst.submissionCount}</td>
                                <td>
                                  {inst.customLink ? (
                                    <a
                                      href={inst.customLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: C.teal, fontSize: 13, fontWeight: 600 }}
                                    >
                                      Open →
                                    </a>
                                  ) : (
                                    <span style={{ color: C.textLight, fontSize: 13 }}>Not sent</span>
                                  )}
                                </td>
                                <td>
                                  {inst.submissionCount === 0 && (
                                    <button
                                      type="button"
                                      className="dcf-btn dcf-btn-ghost"
                                      style={{ fontSize: 13, color: C.coral, borderColor: C.coral, padding: "4px 10px" }}
                                      onClick={() => handleDeleteInstance(inst.surveyInstanceId)}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "configuration" && (
          <div className="card" style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.navy }}>Survey dispatch deadlines</h2>
            <p style={{ fontSize: 12, color: C.textMid, margin: "8px 0 20px", lineHeight: 1.5 }}>
              Demo-only scheduling rules for when feedback surveys are sent after a trigger event. Values are stored in
              admin configuration and shown in workflows; they do not change production calendars.
            </p>
            <div style={{ display: "grid", gap: 16 }}>
              {(Object.keys(DEADLINE_LABELS) as Array<keyof TriggerWindows>).map((key) => (
                <div key={key}>
                  <label className="admin-field-label">{DEADLINE_LABELS[key]}</label>
                  <select
                    className="dcf-input"
                    value={deadlines[key]}
                    onChange={(e) => setDeadlines((d) => ({ ...d, [key]: e.target.value }))}
                  >
                    {DEADLINE_PRESETS[key].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button type="button" className="dcf-btn dcf-btn-primary" style={{ marginTop: 20 }} onClick={handleSaveDeadlines}>
              Save deadlines
            </button>
          </div>
        )}
      </main>

      {/* Feedback detail drawer — portal-style, rendered at shell level */}
      <FeedbackDrawer
        detail={drawerDetail}
        loading={drawerLoading}
        onClose={() => { setDrawerDetail(null); setDrawerLoading(false); }}
      />

      {/* Toast notification */}
      {toast && (
        <div className="admin-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
