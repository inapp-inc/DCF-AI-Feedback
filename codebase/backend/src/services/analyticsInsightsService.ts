import { config } from "../config.js";
import { formatUserGroupLabel } from "../domain/userGroupLabels.js";
import { hfChatJson } from "./hfGenerativeService.js";
import { gatherAnalyticsFacts, type AnalyticsFacts, type InsightsFilters } from "./analyticsFactsService.js";

export type AnalyticsInsightsResult = {
  insightsId: string;
  generatedAt: string;
  submissionCount: number;
  observations: string[];
  concerns: string[];
  trends: string[];
  dataGroundingNote: string;
  fallbackUsed: boolean;
  model: string;
  factsSummary: {
    totalSubmissions: number;
    avgSentiment: number;
    highUrgencyCount: number;
    topTopics: Array<{ topic: string; count: number }>;
  };
};

function stripFence(content: string) {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function buildDeterministicInsights(facts: AnalyticsFacts): Omit<AnalyticsInsightsResult, "insightsId"> {
  const observations: string[] = [];
  const concerns: string[] = [];
  const trends: string[] = [];

  if (facts.submissionCount === 0) {
    return {
      generatedAt: facts.generatedAt,
      submissionCount: 0,
      observations: [
        "No feedback submissions match the current filters.",
        "Run demo surveys or adjust filters before generating insights.",
      ],
      concerns: [],
      trends: ["Insufficient data to identify trends."],
      dataGroundingNote:
        "Insights are derived only from stored submissions and AI inference records in the database (deterministic mode).",
      fallbackUsed: true,
      model: "deterministic-aggregator",
      factsSummary: {
        totalSubmissions: 0,
        avgSentiment: 0,
        highUrgencyCount: 0,
        topTopics: [],
      },
    };
  }

  observations.push(
    `${facts.kpis.totalSubmissions} submission(s) in scope with average sentiment ${facts.kpis.avgSentiment} (scale 1–5).`,
  );
  observations.push(
    `${facts.kpis.highUrgencyCount} submission(s) flagged high urgency; ${facts.kpis.openQueueItems} supervisor queue item(s) remain open.`,
  );
  if (facts.kpis.aiOptOutCount > 0) {
    observations.push(`${facts.kpis.aiOptOutCount} submitter(s) opted out of AI processing.`);
  }
  if (facts.byTopic.length > 0) {
    const top = facts.byTopic.slice(0, 3);
    observations.push(
      `Most common topics: ${top.map((t) => `${t.topic} (${t.count})`).join(", ")}.`,
    );
  }

  for (const signal of facts.anomalySignals) {
    concerns.push(signal.summary);
  }
  const lowSentimentGroups = facts.byUserGroup.filter((g) => g.avgSentiment > 0 && g.avgSentiment < 3);
  for (const g of lowSentimentGroups) {
    concerns.push(
      `${formatUserGroupLabel(g.userGroup)} shows average sentiment ${g.avgSentiment} across ${g.submissions} submission(s).`,
    );
  }
  const likertEntries = Object.entries(facts.likertAverages).filter(([, v]) => v > 0 && v < 3);
  for (const [field, avg] of likertEntries.slice(0, 3)) {
    concerns.push(`Average rating for "${field.replace(/_/g, " ")}" is ${avg} (below 3.0).`);
  }
  if (!concerns.length && facts.kpis.highUrgencyCount === 0) {
    concerns.push("No elevated concerns detected in aggregated metrics for the current scope.");
  }

  if (facts.trendPoints.length >= 2) {
    const first = facts.trendPoints[0];
    const last = facts.trendPoints[facts.trendPoints.length - 1];
    const volDelta = last.submissions - first.submissions;
    trends.push(
      `Submission volume moved from ${first.submissions} (${first.date}) to ${last.submissions} (${last.date}); net change ${volDelta >= 0 ? "+" : ""}${volDelta}.`,
    );
    const sentDelta = Math.round((last.avgSentiment - first.avgSentiment) * 100) / 100;
    trends.push(
      `Average sentiment shifted from ${first.avgSentiment} to ${last.avgSentiment} (${sentDelta >= 0 ? "+" : ""}${sentDelta}).`,
    );
  } else if (facts.trendPoints.length === 1) {
    trends.push(`Single-day trend bucket ${facts.trendPoints[0].date}: ${facts.trendPoints[0].submissions} submission(s).`);
  }

  const lowCompletion = facts.completionByGroup.filter((c) => c.completionRate < 50 && c.totalInstances > 0);
  for (const c of lowCompletion) {
    trends.push(
      `${formatUserGroupLabel(c.userGroup)} completion rate is ${c.completionRate}% (${c.completed}/${c.totalInstances} instances).`,
    );
  }

  return {
    generatedAt: facts.generatedAt,
    submissionCount: facts.submissionCount,
    observations,
    concerns,
    trends,
    dataGroundingNote:
      "Insights are derived only from stored submissions, likert aggregates, queue metrics, and AI inference records (deterministic mode).",
    fallbackUsed: true,
    model: "deterministic-aggregator",
    factsSummary: {
      totalSubmissions: facts.kpis.totalSubmissions,
      avgSentiment: facts.kpis.avgSentiment,
      highUrgencyCount: facts.kpis.highUrgencyCount,
      topTopics: facts.byTopic.slice(0, 5).map((t) => ({ topic: t.topic, count: t.count })),
    },
  };
}

function parseInsightsJson(raw: string): {
  observations: string[];
  concerns: string[];
  trends: string[];
  dataGroundingNote?: string;
} | null {
  try {
    const parsed = JSON.parse(stripFence(raw)) as {
      observations?: unknown;
      concerns?: unknown;
      trends?: unknown;
      dataGroundingNote?: unknown;
    };
    const asStrings = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
    const observations = asStrings(parsed.observations);
    const concerns = asStrings(parsed.concerns);
    const trends = asStrings(parsed.trends);
    if (!observations.length && !concerns.length && !trends.length) return null;
    return {
      observations,
      concerns,
      trends,
      dataGroundingNote:
        typeof parsed.dataGroundingNote === "string" ? parsed.dataGroundingNote : undefined,
    };
  } catch {
    return null;
  }
}

export async function generateAnalyticsInsights(
  filters: InsightsFilters = {},
): Promise<AnalyticsInsightsResult> {
  const facts = await gatherAnalyticsFacts(filters);
  const insightsId = `ins-${Date.now()}`;
  const baseSummary = {
    totalSubmissions: facts.kpis.totalSubmissions,
    avgSentiment: facts.kpis.avgSentiment,
    highUrgencyCount: facts.kpis.highUrgencyCount,
    topTopics: facts.byTopic.slice(0, 5).map((t) => ({ topic: t.topic, count: t.count })),
  };

  if (facts.submissionCount === 0) {
    return { insightsId, ...buildDeterministicInsights(facts) };
  }

  const factsJson = JSON.stringify(facts, null, 0);
  const prompt = `You are a feedback analytics assistant. Analyze ONLY the JSON facts below.

STRICT RULES:
- Do NOT invent submission counts, dates, topics, offices, names, or quotes.
- Every bullet must cite a number or label that appears in the JSON.
- If a dimension has no data, say "insufficient data" for that dimension.
- Do not recommend actions unless tied to a metric in the JSON.

Return strict JSON only (no markdown):
{
  "observations": ["..."],
  "concerns": ["..."],
  "trends": ["..."],
  "dataGroundingNote": "one sentence explaining data sources"
}

Provide 3-6 observations, 0-5 concerns (only if metrics support them), 2-5 trends.
When referring to respondent groups, use display names (Mandated Reporter, Volunteer, Attorney, Foster Parent) — never raw codes like mandated_reporter.

FACTS_JSON:
${factsJson}`;

  const llmRaw = await hfChatJson(prompt, 1400);
  const parsed = llmRaw ? parseInsightsJson(llmRaw) : null;

  if (!parsed) {
    return { insightsId, ...buildDeterministicInsights(facts) };
  }

  return {
    insightsId,
    generatedAt: facts.generatedAt,
    submissionCount: facts.submissionCount,
    observations: parsed.observations,
    concerns: parsed.concerns,
    trends: parsed.trends,
    dataGroundingNote:
      parsed.dataGroundingNote ??
      "Insights generated from database aggregates and recent submission excerpts only.",
    fallbackUsed: false,
    model: config.llm.huggingface.model,
    factsSummary: baseSummary,
  };
}

export { gatherAnalyticsFacts };
