import { pool } from "../db/pool.js";

export type InsightsFilters = {
  userGroup?: string;
  officeId?: string;
  from?: string;
  to?: string;
};

function submissionFilter(alias: string, filters: InsightsFilters) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.userGroup) {
    clauses.push(`${alias}.user_group = ?`);
    params.push(filters.userGroup);
  }
  if (filters.officeId) {
    clauses.push(`(${alias}.office_id = ? OR ${alias}.office_id IS NULL)`);
    params.push(filters.officeId);
  }
  if (filters.from) {
    clauses.push(`${alias}.submitted_at >= ?`);
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push(`${alias}.submitted_at <= ?`);
    params.push(filters.to);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

const LIKERT_FIELDS = [
  "hotline_wait",
  "professionalism",
  "next_steps_clarity",
  "notification_timely",
  "training_quality",
  "facilitator",
  "timeliness",
  "completeness",
  "visit_quality",
  "responsiveness",
  "stipend_timely",
  "overall_satisfaction",
  "process_adherence",
] as const;

function summarizeAnswers(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "attestation" || key === "attested") continue;
      if (typeof value === "string") {
        out[key] = value.length > 200 ? `${value.slice(0, 200)}…` : value;
      } else {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return { _parseError: true };
  }
}

export type AnalyticsFacts = {
  generatedAt: string;
  filters: InsightsFilters;
  submissionCount: number;
  kpis: {
    totalSubmissions: number;
    avgSentiment: number;
    highUrgencyCount: number;
    openQueueItems: number;
    responseRate: number;
    aiOptOutCount: number;
  };
  byUserGroup: Array<{
    userGroup: string;
    submissions: number;
    avgSentiment: number;
    highUrgency: number;
  }>;
  byTopic: Array<{ topic: string; count: number; avgSentiment: number }>;
  trendPoints: Array<{ date: string; submissions: number; avgSentiment: number }>;
  completionByGroup: Array<{
    userGroup: string;
    totalInstances: number;
    completed: number;
    completionRate: number;
  }>;
  equitySlices: Array<{
    demographic: string;
    userGroup: string;
    submissions: number;
    avgSentiment: number;
  }>;
  likertAverages: Record<string, number>;
  anomalySignals: Array<{ type: string; severity: string; summary: string }>;
  recentFeedback: Array<{
    submissionId: string;
    userGroup: string;
    submittedAt: string;
    topic: string | null;
    urgency: string | null;
    sentiment: number | null;
    answers: Record<string, unknown>;
  }>;
};

export async function gatherAnalyticsFacts(filters: InsightsFilters = {}): Promise<AnalyticsFacts> {
  const f = submissionFilter("s", filters);

  const total = await pool.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM submissions s WHERE 1=1${f.sql}`,
    f.params,
  );
  const urg = await pool.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM ai_inferences ai
     JOIN submissions s ON s.submission_id = ai.submission_id
     WHERE ai.urgency = 'high'${f.sql}`,
    f.params,
  );
  const sentiment = await pool.query<{ s: number }>(
    `SELECT COALESCE(AVG(ai.sentiment_score), 0) as s FROM ai_inferences ai
     JOIN submissions s ON s.submission_id = ai.submission_id WHERE 1=1${f.sql}`,
    f.params,
  );
  const optOut = await pool.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM submissions s WHERE s.ai_opt_out = 1${f.sql}`,
    f.params,
  );
  const openQueue = await pool.query<{ c: number }>(
    "SELECT COUNT(*) as c FROM supervisor_queue WHERE status <> 'resolved'",
  );
  const responseRate = await pool.query<{ s: number }>(
    `SELECT COALESCE(100.0 * (SELECT COUNT(*) FROM submissions) / NULLIF((SELECT COUNT(*) FROM form_instances), 0), 0) as s`,
  );

  const byGroup = await pool.query<{
    user_group: string;
    submissions: number;
    avg_sentiment: number;
    high_urgency: number;
  }>(
    `SELECT s.user_group,
            COUNT(*) as submissions,
            COALESCE(AVG(ai.sentiment_score), 0) as avg_sentiment,
            SUM(CASE WHEN ai.urgency = 'high' THEN 1 ELSE 0 END) as high_urgency
     FROM submissions s
     LEFT JOIN ai_inferences ai ON ai.submission_id = s.submission_id
     WHERE 1=1${f.sql}
     GROUP BY s.user_group`,
    f.params,
  );

  const byTopic = await pool.query<{ topic: string; count: number; avg_sentiment: number }>(
    `SELECT ai.topic, COUNT(*) as count, COALESCE(AVG(ai.sentiment_score), 0) as avg_sentiment
     FROM ai_inferences ai
     JOIN submissions s ON s.submission_id = ai.submission_id
     WHERE 1=1${f.sql}
     GROUP BY ai.topic
     ORDER BY count DESC`,
    f.params,
  );

  const trends = await pool.query<{ bucket: string; submissions: number; avgScore: number }>(
    `SELECT substr(s.submitted_at, 1, 10) as bucket,
            COUNT(*) as submissions,
            COALESCE(AVG(ai.sentiment_score), 0) as avgScore
     FROM submissions s
     LEFT JOIN ai_inferences ai ON ai.submission_id = s.submission_id
     WHERE 1=1${f.sql}
     GROUP BY bucket
     ORDER BY bucket ASC`,
    f.params,
  );

  let completionSql = `SELECT fi.user_group,
    COUNT(*) as total_instances,
    SUM(CASE WHEN fi.status = 'submitted' THEN 1 ELSE 0 END) as completed
    FROM form_instances fi WHERE 1=1`;
  const completionParams: unknown[] = [];
  if (filters.userGroup) {
    completionSql += " AND fi.user_group = ?";
    completionParams.push(filters.userGroup);
  }
  completionSql += " GROUP BY fi.user_group";
  const completion = await pool.query<{
    user_group: string;
    total_instances: number;
    completed: number;
  }>(completionSql, completionParams);

  const equity = await pool.query(
    `SELECT COALESCE(s.demo_demographic, 'unspecified') as demographic,
            s.user_group,
            COUNT(*) as submissions,
            COALESCE(AVG(ai.sentiment_score), 0) as avg_sentiment
     FROM submissions s
     LEFT JOIN ai_inferences ai ON ai.submission_id = s.submission_id
     WHERE 1=1${f.sql}
     GROUP BY demographic, s.user_group`,
    f.params,
  );

  const likertAverages: Record<string, number> = {};
  for (const field of LIKERT_FIELDS) {
    const { rows } = await pool.query<{ avg: number }>(
      `SELECT AVG(CAST(json_extract(s.answers_json, '$.${field}') AS REAL)) as avg
       FROM submissions s
       WHERE json_extract(s.answers_json, '$.${field}') IS NOT NULL${f.sql}`,
      f.params,
    );
    const avg = Number(rows[0]?.avg);
    if (Number.isFinite(avg)) likertAverages[field] = Math.round(avg * 100) / 100;
  }

  const recent = await pool.query<{
    submission_id: string;
    user_group: string;
    submitted_at: string;
    answers_json: string;
    topic: string | null;
    urgency: string | null;
    sentiment_score: number | null;
  }>(
    `SELECT s.submission_id, s.user_group, s.submitted_at, s.answers_json,
            ai.topic, ai.urgency, ai.sentiment_score
     FROM submissions s
     LEFT JOIN ai_inferences ai ON ai.submission_id = s.submission_id
     WHERE 1=1${f.sql}
     ORDER BY s.submitted_at DESC
     LIMIT 12`,
    f.params,
  );

  const anomalyRows = await pool.query<{ c: number; legal: number; fallback: number }>(
    `SELECT
      SUM(CASE WHEN ai.urgency = 'high' THEN 1 ELSE 0 END) as c,
      SUM(CASE WHEN ai.recommended_route = 'legal_policy_queue' THEN 1 ELSE 0 END) as legal,
      SUM(CASE WHEN ai.fallback_used = 1 THEN 1 ELSE 0 END) as fallback
     FROM ai_inferences ai
     JOIN submissions s ON s.submission_id = ai.submission_id
     WHERE 1=1${f.sql}`,
    f.params,
  );
  const anomalySignals: AnalyticsFacts["anomalySignals"] = [];
  const highU = Number(anomalyRows.rows[0]?.c ?? 0);
  const legal = Number(anomalyRows.rows[0]?.legal ?? 0);
  const fallback = Number(anomalyRows.rows[0]?.fallback ?? 0);
  if (highU > 0) {
    anomalySignals.push({
      type: "urgency_spike",
      severity: highU > 5 ? "high" : "medium",
      summary: `${highU} submission(s) classified high urgency in scope`,
    });
  }
  if (legal > 0) {
    anomalySignals.push({
      type: "legal_sensitive",
      severity: "medium",
      summary: `${legal} submission(s) routed to legal/policy queue`,
    });
  }
  if (fallback > 0) {
    anomalySignals.push({
      type: "fallback_usage",
      severity: "medium",
      summary: `${fallback} submission(s) used non-LLM fallback classification`,
    });
  }

  const submissionCount = Number(total.rows[0]?.c ?? 0);

  return {
    generatedAt: new Date().toISOString(),
    filters,
    submissionCount,
    kpis: {
      totalSubmissions: submissionCount,
      avgSentiment: Math.round(Number(sentiment.rows[0]?.s ?? 0) * 100) / 100,
      highUrgencyCount: Number(urg.rows[0]?.c ?? 0),
      openQueueItems: Number(openQueue.rows[0]?.c ?? 0),
      responseRate: Math.round(Number(responseRate.rows[0]?.s ?? 0) * 10) / 10,
      aiOptOutCount: Number(optOut.rows[0]?.c ?? 0),
    },
    byUserGroup: byGroup.rows.map((r) => ({
      userGroup: String(r.user_group),
      submissions: Number(r.submissions),
      avgSentiment: Math.round(Number(r.avg_sentiment) * 100) / 100,
      highUrgency: Number(r.high_urgency),
    })),
    byTopic: byTopic.rows.map((r) => ({
      topic: String(r.topic),
      count: Number(r.count),
      avgSentiment: Math.round(Number(r.avg_sentiment) * 100) / 100,
    })),
    trendPoints: trends.rows.map((r) => ({
      date: String(r.bucket),
      submissions: Number(r.submissions),
      avgSentiment: Math.round(Number(r.avgScore) * 100) / 100,
    })),
    completionByGroup: completion.rows.map((r) => ({
      userGroup: String(r.user_group),
      totalInstances: Number(r.total_instances),
      completed: Number(r.completed),
      completionRate:
        Number(r.total_instances) > 0
          ? Math.round((1000 * Number(r.completed)) / Number(r.total_instances)) / 10
          : 0,
    })),
    equitySlices: equity.rows.map((r) => ({
      demographic: Number(r.submissions) < 5 ? "aggregated_small_n" : String(r.demographic),
      userGroup: String(r.user_group),
      submissions: Number(r.submissions),
      avgSentiment: Math.round(Number(r.avg_sentiment) * 100) / 100,
    })),
    likertAverages,
    anomalySignals,
    recentFeedback: recent.rows.map((r) => ({
      submissionId: String(r.submission_id),
      userGroup: String(r.user_group),
      submittedAt: String(r.submitted_at),
      topic: r.topic,
      urgency: r.urgency,
      sentiment: r.sentiment_score != null ? Number(r.sentiment_score) : null,
      answers: summarizeAnswers(String(r.answers_json)),
    })),
  };
}
