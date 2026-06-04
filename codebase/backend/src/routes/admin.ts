import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "../utils/audit.js";
import { config } from "../config.js";
import { getAiHealth } from "../services/hfInferenceService.js";
import { generateAnalyticsInsights } from "../services/analyticsInsightsService.js";

const router = Router();
router.use(requireAuth);

router.get("/supervisor/queue", requireRoles("admin", "supervisor"), async (req, res) => {
  const status = req.query.status as string | undefined;
  const officeId = req.query.officeId as string | undefined;
  const userGroup = req.query.userGroup as string | undefined;
  const params: unknown[] = [];
  let sql = "SELECT * FROM supervisor_queue WHERE 1=1";
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (officeId) {
    sql += " AND office_id = ?";
    params.push(officeId);
  }
  if (userGroup) {
    sql += " AND user_group = ?";
    params.push(userGroup);
  }
  sql += " ORDER BY created_at DESC";
  const { rows } = await pool.query(sql, params);
  res.json({
    items: rows.map((r) => ({
      queueItemId: r.queue_item_id,
      submissionId: r.submission_id,
      userGroup: r.user_group,
      officeId: r.office_id,
      status: r.status,
      priority: r.priority,
      reason: r.reason,
      createdAt: r.created_at,
      assignee: r.assignee,
    })),
  });
});

const assignSchema = z.object({ assignee: z.string().min(1) });
router.post("/supervisor/queue/:queueItemId/assign", requireRoles("admin", "supervisor"), async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const queueItemId = String(req.params.queueItemId);
  await pool.query(
    `UPDATE supervisor_queue SET assignee = ?, updated_at = datetime('now') WHERE queue_item_id = ?`,
    [parsed.data.assignee, queueItemId],
  );
  await writeAudit(req.user!.username, "queue.assign", "queue_item", queueItemId, {
    assignee: parsed.data.assignee,
  });
  res.json({ ok: true });
});

const statusSchema = z.object({
  status: z.enum(["open", "in_review", "resolved"]),
  note: z.string().optional(),
});
router.post("/supervisor/queue/:queueItemId/status", requireRoles("admin", "supervisor"), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const queueItemId = String(req.params.queueItemId);
  await pool.query(
    `UPDATE supervisor_queue SET status = ?, updated_at = datetime('now') WHERE queue_item_id = ?`,
    [parsed.data.status, queueItemId],
  );
  await writeAudit(req.user!.username, "queue.status", "queue_item", queueItemId, {
    status: parsed.data.status,
    note: parsed.data.note ?? null,
  });
  res.json({ ok: true });
});

function filterClause(alias: string, req: { query: Record<string, unknown> }) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const userGroup = req.query.userGroup as string | undefined;
  const officeId = req.query.officeId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if (userGroup) {
    clauses.push(`${alias}.user_group = ?`);
    params.push(userGroup);
  }
  if (officeId) {
    clauses.push(`(${alias}.office_id = ? OR ${alias}.office_id IS NULL)`);
    params.push(officeId);
  }
  if (from) {
    clauses.push(`${alias}.submitted_at >= ?`);
    params.push(from);
  }
  if (to) {
    clauses.push(`${alias}.submitted_at <= ?`);
    params.push(to);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

router.get("/analytics/kpis", requireRoles("admin", "supervisor"), async (req, res) => {
  const f = filterClause("s", req);
  const approvedFilter = " AND s.approval_status = 'supervisor_approved'";
  const total = await pool.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM submissions s WHERE 1=1${approvedFilter}${f.sql}`,
    f.params,
  );
  const urg = await pool.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM ai_inferences ai JOIN submissions s ON s.submission_id = ai.submission_id WHERE ai.urgency = 'high'${approvedFilter}${f.sql}`,
    f.params,
  );
  const pendingApproval = await pool.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM submissions WHERE approval_status IN ('pending_legal', 'pending_supervisor', 'legal_approved')`,
  );
  const sentiment = await pool.query<{ s: number }>(
    `SELECT COALESCE(AVG(ai.sentiment_score), 0) as s FROM ai_inferences ai JOIN submissions s ON s.submission_id = ai.submission_id WHERE 1=1${approvedFilter}${f.sql}`,
    f.params,
  );
  const openQueue = await pool.query<{ c: number }>(
    "SELECT COUNT(*) as c FROM supervisor_queue WHERE status <> 'resolved'",
  );
  const responseRate = await pool.query<{ s: number }>(
    `SELECT
       COALESCE(
         100.0 * (SELECT COUNT(*) FROM submissions) /
         NULLIF((SELECT COUNT(*) FROM form_instances), 0),
         0
       ) as s`,
  );
  res.json({
    totalSubmissions: Number(total.rows[0]?.c ?? 0),
    avgSentiment: Number(sentiment.rows[0]?.s ?? 0),
    highUrgencyCount: Number(urg.rows[0]?.c ?? 0),
    pendingApprovalCount: Number(pendingApproval.rows[0]?.c ?? 0),
    responseRate: Number(responseRate.rows[0]?.s ?? 0),
    openQueueItems: Number(openQueue.rows[0]?.c ?? 0),
  });
});

const insightsFilterSchema = z.object({
  userGroup: z.string().optional(),
  officeId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

router.post("/analytics/insights/generate", requireRoles("admin", "supervisor"), async (req, res) => {
  const parsed = insightsFilterSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  try {
    const result = await generateAnalyticsInsights(parsed.data);
    await writeAudit(req.user!.username, "analytics.insights.generate", "analytics_insights", result.insightsId, {
      submissionCount: result.submissionCount,
      fallbackUsed: result.fallbackUsed,
      model: result.model,
    });
    res.status(201).json(result);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ code: "INSIGHTS_FAILED", message: err.message });
  }
});

router.get("/analytics/trends", requireRoles("admin", "supervisor"), async (_req, res) => {
  const { rows } = await pool.query<{ bucket: string; submissions: number; avgScore: number }>(
    `SELECT substr(s.submitted_at, 1, 10) as bucket,
            COUNT(*) as submissions,
            COALESCE(AVG(ai.sentiment_score), 0) as avgScore
     FROM submissions s
     LEFT JOIN ai_inferences ai ON ai.submission_id = s.submission_id
     WHERE s.approval_status = 'supervisor_approved'
     GROUP BY substr(s.submitted_at, 1, 10)
     ORDER BY bucket DESC
     LIMIT 30`,
  );
  res.json({ points: rows });
});

router.get("/analytics/anomalies", requireRoles("admin", "supervisor"), async (_req, res) => {
  const { rows } = await pool.query<{ c: number; legal: number; fallback: number }>(
    `SELECT
      SUM(CASE WHEN urgency = 'high' THEN 1 ELSE 0 END) as c,
      SUM(CASE WHEN recommended_route = 'legal_policy_queue' THEN 1 ELSE 0 END) as legal,
      SUM(CASE WHEN fallback_used = 1 THEN 1 ELSE 0 END) as fallback
    FROM ai_inferences`,
  );
  const count = Number(rows[0]?.c ?? 0);
  const legal = Number(rows[0]?.legal ?? 0);
  const fallback = Number(rows[0]?.fallback ?? 0);
  const items: Array<Record<string, unknown>> = [];
  if (count > 0) {
    items.push({
        signalId: "urgency-spike",
        type: "urgency_spike",
        severity: count > 10 ? "critical" : count > 5 ? "high" : "medium",
        summary: `${count} high urgency items need attention`,
        status: "open",
      });
  }
  if (legal > 0) {
    items.push({
      signalId: "legal-sensitive",
      type: "legal_sensitive",
      severity: legal > 5 ? "high" : "medium",
      summary: `${legal} legal-sensitive submissions routed to policy queue`,
      status: "open",
    });
  }
  if (fallback > 0) {
    items.push({
      signalId: "ai-fallback-usage",
      type: "fallback_usage",
      severity: fallback > 10 ? "high" : "medium",
      summary: `${fallback} inferences used fallback logic`,
      status: "open",
    });
  }
  const risks = await pool.query<{ signal_id: string; signal_type: string; severity: string; summary: string }>(
    `SELECT signal_id, signal_type, severity, summary
     FROM risk_signals
     WHERE signal_id NOT LIKE 'risk_demo_%'
       AND summary NOT LIKE 'Demo:%'
     ORDER BY created_at DESC
     LIMIT 10`,
  );
  for (const r of risks.rows) {
    items.push({
      signalId: r.signal_id,
      type: r.signal_type,
      severity: r.severity,
      summary: r.summary,
      status: "open",
    });
  }
  res.json({ items });
});

router.get("/analytics/completion", requireRoles("admin", "supervisor"), async (req, res) => {
  const userGroup = req.query.userGroup as string | undefined;
  const params: unknown[] = [];
  let sql = `SELECT fi.user_group,
    COUNT(*) as total_instances,
    SUM(CASE WHEN fi.status = 'submitted' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN fi.status = 'open' THEN 1 ELSE 0 END) as pending
    FROM form_instances fi WHERE 1=1`;
  if (userGroup) {
    sql += " AND fi.user_group = ?";
    params.push(userGroup);
  }
  sql += " GROUP BY fi.user_group";
  const { rows } = await pool.query(sql, params);
  res.json({
    items: rows.map((r) => ({
      userGroup: r.user_group,
      totalInstances: r.total_instances,
      completed: r.completed,
      pending: r.pending,
      completionRate:
        Number(r.total_instances) > 0
          ? (100 * Number(r.completed)) / Number(r.total_instances)
          : 0,
    })),
  });
});

router.get("/analytics/equity", requireRoles("admin", "supervisor"), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT COALESCE(s.demo_demographic, 'unspecified') as demographic,
            s.user_group,
            COUNT(*) as submissions,
            COALESCE(AVG(ai.sentiment_score), 0) as avg_sentiment
     FROM submissions s
     LEFT JOIN ai_inferences ai ON ai.submission_id = s.submission_id
     WHERE s.approval_status = 'supervisor_approved'
     GROUP BY demographic, s.user_group
     HAVING submissions >= 1`,
  );
  const items = rows.map((r) => ({
    demographic: Number(r.submissions) < 5 ? "other" : r.demographic,
    userGroup: r.user_group,
    submissions: r.submissions,
    avgSentiment: r.avg_sentiment,
  }));
  res.json({ items });
});

router.get("/analytics/reporter-categories", requireRoles("admin", "supervisor"), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT json_extract(s.answers_json, '$.reporter_category') as category,
            COUNT(*) as count,
            COALESCE(AVG(ai.sentiment_score), 0) as avg_sentiment
     FROM submissions s
     LEFT JOIN ai_inferences ai ON ai.submission_id = s.submission_id
     WHERE s.user_group = 'mandated_reporter'
       AND s.approval_status = 'supervisor_approved'
     GROUP BY category`,
  );
  res.json({
    items: rows.map((r) => ({
      category: r.category ?? "unspecified",
      count: r.count,
      avgSentiment: r.avg_sentiment,
    })),
  });
});

// ── Submissions history (all submitted surveys with status + AI) ─────────────

router.get("/analytics/submissions-history", requireRoles("admin", "supervisor"), async (req, res) => {
  const userGroup  = req.query.userGroup  as string | undefined;
  const status     = req.query.status     as string | undefined;
  const limit      = Math.min(Number(req.query.limit ?? 100), 500);

  const params: unknown[] = [];
  let sql = `
    SELECT
      s.submission_id,
      s.user_group,
      s.approval_status,
      s.submitted_at,
      s.office_id,
      ai.topic,
      ai.sentiment_score,
      ai.urgency,
      ai.explainability_summary,
      (
        SELECT json_group_array(json_object(
          'action', sa.action,
          'reviewerUsername', sa.reviewer_username,
          'reviewerRole', sa.reviewer_role,
          'note', sa.note,
          'createdAt', sa.created_at
        ))
        FROM submission_approvals sa
        WHERE sa.submission_id = s.submission_id
        ORDER BY sa.created_at ASC
      ) as approval_history
    FROM submissions s
    LEFT JOIN ai_inferences ai ON ai.submission_id = s.submission_id
    WHERE 1=1
  `;
  if (userGroup) { sql += " AND s.user_group = ?"; params.push(userGroup); }
  if (status)    { sql += " AND s.approval_status = ?"; params.push(status); }
  sql += " ORDER BY s.submitted_at DESC LIMIT ?";
  params.push(limit);

  const { rows } = await pool.query(sql, params);
  res.json({
    items: rows.map((r) => {
      let history: unknown[] = [];
      try { history = JSON.parse(String(r.approval_history ?? "[]")) as unknown[]; } catch { history = []; }
      return {
        submissionId:   r.submission_id,
        userGroup:      r.user_group,
        approvalStatus: r.approval_status,
        submittedAt:    r.submitted_at,
        officeId:       r.office_id,
        topic:          r.topic,
        sentimentScore: r.sentiment_score != null ? Number(r.sentiment_score) : null,
        urgency:        r.urgency,
        explainabilitySummary: r.explainability_summary,
        approvalHistory: history,
      };
    }),
  });
});

router.get("/risk/signals", requireRoles("admin", "supervisor"), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM risk_signals
     WHERE signal_id NOT LIKE 'risk_demo_%'
       AND summary NOT LIKE 'Demo:%'
     ORDER BY created_at DESC
     LIMIT 50`,
  );
  res.json({ items: rows });
});

router.get("/notifications/log", requireRoles("admin", "supervisor"), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM notification_log ORDER BY created_at DESC LIMIT 50`,
  );
  res.json({ items: rows });
});

router.get("/admin/config", requireRoles("admin", "supervisor"), async (_req, res) => {
  const { rows } = await pool.query<{ config_key: string; config_value: string }>(
    "SELECT config_key, config_value FROM admin_config",
  );
  const map = Object.fromEntries(rows.map((r) => [r.config_key, r.config_value]));
  res.json({
    triggerWindows: {
      mr: map.trigger_window_mr ?? "5-7 business days",
      vol: map.trigger_window_vol ?? "within 48 hours",
      att: map.trigger_window_att ?? "on milestone date",
      fp: map.trigger_window_fp ?? "day30/day60/day90",
    },
    reminderCadence: {},
    urgencyThreshold: Number(map.urgency_threshold ?? 0.8),
    aiDisclosureRequired: map.ai_disclosure_required !== "false",
    llmProvider: map.llm_provider ?? "huggingface",
    hfModel: map.hf_model ?? config.llm.huggingface.model,
    hfApiBase: map.hf_api_base ?? config.llm.huggingface.apiBase,
    llmRequestTimeoutMs: Number(map.llm_request_timeout_ms ?? config.llm.requestTimeoutMs),
    hfTokenSource: map.hf_token_source ?? "HF_API_TOKEN",
  });
});

const adminConfigSchema = z.object({
  triggerWindows: z.record(z.string()).optional(),
  urgencyThreshold: z.number().optional(),
  aiDisclosureRequired: z.boolean().optional(),
  llmProvider: z.literal("huggingface").optional(),
  hfModel: z.string().optional(),
  hfApiBase: z.string().url().optional(),
  llmRequestTimeoutMs: z.number().int().min(5000).max(900000).optional(),
  hfTokenSource: z.enum(["HF_API_TOKEN", "HUGGINGFACE_API_KEY"]).optional(),
});
router.put("/admin/config", requireRoles("admin"), async (req, res) => {
  const parsed = adminConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const updates: Array<[string, string]> = [];
  if (parsed.data.triggerWindows?.mr) updates.push(["trigger_window_mr", parsed.data.triggerWindows.mr]);
  if (parsed.data.triggerWindows?.vol) updates.push(["trigger_window_vol", parsed.data.triggerWindows.vol]);
  if (parsed.data.triggerWindows?.att) updates.push(["trigger_window_att", parsed.data.triggerWindows.att]);
  if (parsed.data.triggerWindows?.fp) updates.push(["trigger_window_fp", parsed.data.triggerWindows.fp]);
  if (typeof parsed.data.urgencyThreshold === "number") {
    updates.push(["urgency_threshold", String(parsed.data.urgencyThreshold)]);
  }
  if (typeof parsed.data.aiDisclosureRequired === "boolean") {
    updates.push(["ai_disclosure_required", String(parsed.data.aiDisclosureRequired)]);
  }
  if (parsed.data.llmProvider) updates.push(["llm_provider", parsed.data.llmProvider]);
  if (parsed.data.hfModel) updates.push(["hf_model", parsed.data.hfModel]);
  if (parsed.data.hfApiBase) updates.push(["hf_api_base", parsed.data.hfApiBase]);
  if (typeof parsed.data.llmRequestTimeoutMs === "number") {
    updates.push(["llm_request_timeout_ms", String(parsed.data.llmRequestTimeoutMs)]);
  }
  if (parsed.data.hfTokenSource) updates.push(["hf_token_source", parsed.data.hfTokenSource]);
  for (const [k, v] of updates) {
    const { rows: oldRows } = await pool.query<{ config_value: string }>(
      "SELECT config_value FROM admin_config WHERE config_key = ?",
      [k],
    );
    const oldValue = oldRows[0]?.config_value ?? null;
    await pool.query(
      `INSERT INTO admin_config (config_key, config_value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = datetime('now')`,
      [k, v],
    );
    await writeAudit(req.user!.username, "admin.config.key.update", "admin_config", k, {
      oldValue,
      newValue: v,
    });
  }
  await writeAudit(req.user!.username, "admin.config.update", "admin_config", "global", { updates });
  res.json({ ok: true });
});

const exportSchema = z.object({
  format: z.enum(["csv", "pdf"]),
  filters: z.record(z.unknown()).optional(),
});
router.post("/exports", requireRoles("admin", "supervisor"), async (req, res) => {
  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const exportId = newId("exp");
  await pool.query(
    `INSERT INTO export_jobs (export_id, format, filters_json, status, file_path, completed_at)
     VALUES (?, ?, ?, 'queued', ?, NULL)`,
    [exportId, parsed.data.format, JSON.stringify(parsed.data.filters ?? {}), `/tmp/${exportId}.${parsed.data.format}`],
  );
  await pool.query(
    `UPDATE export_jobs SET status = 'running' WHERE export_id = ?`,
    [exportId],
  );
  await pool.query(
    `UPDATE export_jobs SET status = 'completed', completed_at = datetime('now') WHERE export_id = ?`,
    [exportId],
  );
  await writeAudit(req.user!.username, "export.generate", "export_job", exportId, {
    format: parsed.data.format,
    filters: parsed.data.filters ?? {},
  });
  res.status(202).json({
    exportId,
    status: "completed",
    format: parsed.data.format,
    downloadUrl: `/downloads/${exportId}.${parsed.data.format}`,
  });
});

router.get("/exports/:exportId", requireRoles("admin", "supervisor"), async (req, res) => {
  const { rows } = await pool.query(
    "SELECT export_id, status, format FROM export_jobs WHERE export_id = ?",
    [req.params.exportId],
  );
  if (!rows.length) {
    res.status(404).json({ code: "NOT_FOUND", message: "Export not found" });
    return;
  }
  const r = rows[0] as Record<string, unknown>;
  res.json({
    exportId: r.export_id,
    status: r.status,
    format: r.format,
    downloadUrl: `/downloads/${String(r.export_id)}.${String(r.format)}`,
  });
});

router.get("/audit/logs", requireRoles("admin", "supervisor"), async (req, res) => {
  const actor = req.query.actor as string | undefined;
  const action = req.query.action as string | undefined;
  const params: unknown[] = [];
  let sql = "SELECT * FROM audit_events WHERE 1=1";
  if (actor) {
    sql += " AND actor = ?";
    params.push(actor);
  }
  if (action) {
    sql += " AND action = ?";
    params.push(action);
  }
  sql += " ORDER BY created_at DESC LIMIT 200";
  const { rows } = await pool.query(sql, params);
  res.json({
    items: rows.map((r) => ({
      eventId: r.audit_event_id,
      actor: r.actor,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      timestamp: r.created_at,
      details: r.details_json ? JSON.parse(String(r.details_json)) : {},
    })),
  });
});

router.post("/compliance/retention/run", requireRoles("admin"), async (req, res) => {
  const cutoff = new Date(Date.now() - 90 * 86400 * 1000).toISOString();
  const { rows } = await pool.query<{ c: number }>("SELECT COUNT(*) as c FROM audit_events WHERE created_at < ?", [
    cutoff,
  ]);
  const archivedCount = Number(rows[0]?.c ?? 0);
  await writeAudit(req.user!.username, "compliance.retention.run", "audit_events", "retention", {
    cutoff,
    archivedCount,
    mode: "dry-run",
  });
  res.status(202).json({ status: "queued", archivedCount, mode: "dry-run" });
});

router.get("/ai/ops/health", requireRoles("admin", "supervisor"), async (_req, res) => {
  const health = await getAiHealth();
  const { rows } = await pool.query<{ fallback_count: number; avg_latency: number }>(
    `SELECT
      SUM(CASE WHEN fallback_used = 1 THEN 1 ELSE 0 END) as fallback_count,
      COALESCE(AVG(latency_ms), 0) as avg_latency
    FROM ai_inferences`,
  );
  res.json({
    ...health,
    fallbackCount: Number(rows[0]?.fallback_count ?? 0),
    averageLatencyMs: Math.round(Number(rows[0]?.avg_latency ?? 0)),
  });
});

export default router;

