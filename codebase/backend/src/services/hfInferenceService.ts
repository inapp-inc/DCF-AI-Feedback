import { config } from "../config.js";

export interface InferenceOutput {
  topic: string;
  urgency: "low" | "medium" | "high";
  sentiment: number;
  confidence: number;
  explainability: string;
  legalSensitive: boolean;
  raw?: string;
  fallbackUsed: boolean;
  latencyMs: number;
  model: string;
  errorMessage?: string;
  entities?: Array<{ type: string; value: string }>;
}

// Topic is now derived deterministically from user_group in submissionProcessor — not inferred by the LLM.

function extractEntities(text: string): Array<{ type: string; value: string }> {
  const entities: Array<{ type: string; value: string }> = [];
  const icwa = text.match(/\b(icwa|icpc)\b/i);
  if (icwa) entities.push({ type: "policy", value: icwa[0].toUpperCase() });
  const office = text.match(/north\s+region|boston\s+north|western|central/i);
  if (office) entities.push({ type: "office", value: office[0] });
  return entities;
}

function heuristicFallback(text: string, errorMessage?: string): InferenceOutput {
  const t = text.toLowerCase();

  const flat = t.replace(/\n/g, " ");

  // HIGH: safety, legal/compliance risk, abuse, systemic failure, broad harm
  const hasHigh = /(urgent|danger|unsafe|abuse|neglect|immediate risk|crisis|emergency|court|icwa|icpc|compliance|violation|lawsuit|threatened|harm|systemic|critical|severe|escalat|widespread concern|policy breach|policy violat|policy gap|reporting fail)/.test(flat);

  // MEDIUM: operational issues, quality gaps, delays, training needs, process friction —
  // anything actionable affecting even one person's outcomes
  const hasMedium = /(late|delay|slow|wait|backlog|missed|overdue|bad|poor|below|inadequate|insufficient|unclear|confus|inconsistent|issue|problem|concern|complaint|challeng|difficult|frustrat|barrier|improve|suggestion|recommend|fix|need|lack|missing|gap|training|support|resource|communication|coordinat|follow.?up|not respond|not contact|not available|not informed|caseworker|supervisor|worker|staff|process|procedure|impact|affect|consequence|outcome|stakeholder|families|children|multiple|several|many|across|broad)/.test(flat);

  // LOW: only genuinely trivial or purely positive with zero actionable signal
  const legalSensitive = /(icwa|icpc|court|legal|attorney|compliance)/.test(t);

  const urgency: "low" | "medium" | "high" = hasHigh ? "high" : hasMedium ? "medium" : "low";

  const topic = t.includes("training")
    ? "training_quality"
    : t.includes("visit")
      ? "visit_quality"
      : legalSensitive
        ? "legal_process"
        : "general_feedback";

  return {
    topic,
    urgency,
    sentiment: hasHigh ? 1.8 : hasMedium ? 2.7 : 4.0,
    confidence: 0.62,
    explainability: hasHigh
      ? "Fallback NLP: high-impact or safety-related indicators detected."
      : hasMedium
        ? "Fallback NLP: actionable quality or process concern detected."
        : "Fallback NLP: no significant negative indicators — feedback appears routine or positive.",
    legalSensitive,
    fallbackUsed: true,
    latencyMs: 0,
    model: "fallback-heuristic",
    errorMessage,
    entities: extractEntities(text),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripFence(content: string) {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function inferSubmission(answers: Record<string, unknown>): Promise<InferenceOutput> {
  const text = JSON.stringify(answers);
  const prompt =
    `You are a service-quality analyst classifying feedback submitted by caseworkers, foster parents, attorneys, and volunteers in a child welfare system.\n` +
    `Return ONLY strict JSON with keys: urgency, sentiment, confidence, explainability, legalSensitive, entities.\n` +
    `entities is an array of {type,value} for policies, offices, or specific issues found.\n\n` +
    `URGENCY CLASSIFICATION — score on four dimensions, then assign the overall level:\n` +
    `  1. Criticality: Does this involve safety, legal risk, abuse, neglect, or policy violation? (high weight)\n` +
    `  2. Level of impact: How severely does this issue affect the people involved? Minor inconvenience vs. significant harm.\n` +
    `  3. Spread of benefit: Would fixing this help one case, one office, or many families/children across the system?\n` +
    `  4. Stakeholder count: How many people (children, families, workers) are affected or would benefit from action?\n\n` +
    `Urgency levels:\n` +
    `  high   — Safety/legal risk, systemic failure, policy breach, abuse/neglect indicators, OR high impact + broad spread + many stakeholders.\n` +
    `           Err on the side of high when in doubt about safety or compliance.\n` +
    `  medium — Actionable operational issue, quality gap, process friction, training need, delay, or communication breakdown.\n` +
    `           Use medium for anything that has a clear fix and affects even ONE person's outcomes. Most substantive feedback is medium.\n` +
    `  low    — Only for genuinely routine or purely positive feedback with no actionable concern and no improvement opportunity.\n` +
    `           Be conservative with low — if the feedback contains ANY suggestion or concern, it is at least medium.\n\n` +
    `Rules: urgency in [low,medium,high], sentiment 1..5, confidence 0..1.\n` +
    `Feedback: ${text}`;
  const start = Date.now();

  if (!config.llm.huggingface.apiToken) {
    const out = heuristicFallback(text, "HF token missing");
    out.latencyMs = Date.now() - start;
    return out;
  }

  let lastError = "";
  for (let attempt = 0; attempt <= config.llm.maxRetries; attempt++) {
    try {
      const response = await fetch(`${config.llm.huggingface.apiBase.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.llm.huggingface.apiToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(config.llm.requestTimeoutMs),
        body: JSON.stringify({
          model: config.llm.huggingface.model,
          temperature: 0.1,
          max_tokens: 220,
          messages: [
            { role: "system", content: "Return only valid JSON." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        lastError = `HF ${response.status}: ${body.slice(0, 180)}`;
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < config.llm.maxRetries) {
          await sleep(config.llm.retryBaseDelayMs * (attempt + 1));
          continue;
        }
        throw new Error(lastError);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim() ?? "";
      const parsed = JSON.parse(stripFence(content)) as Partial<InferenceOutput>;
      const parsedEntities = Array.isArray((parsed as { entities?: unknown }).entities)
        ? ((parsed as { entities: Array<{ type?: string; value?: string }> }).entities ?? []).map((e) => ({
            type: String(e.type ?? "mention"),
            value: String(e.value ?? ""),
          }))
        : extractEntities(text);
      const out: InferenceOutput = {
        topic: String(parsed.topic ?? "general_feedback"),
        urgency: parsed.urgency === "high" ? "high" : parsed.urgency === "low" ? "low" : "medium",
        sentiment: Number(parsed.sentiment ?? 3),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.7))),
        explainability: String(parsed.explainability ?? "Model-derived classification."),
        legalSensitive: Boolean(parsed.legalSensitive),
        raw: content,
        fallbackUsed: false,
        latencyMs: Date.now() - start,
        model: config.llm.huggingface.model,
        entities: parsedEntities,
      };
      return out;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < config.llm.maxRetries) {
        await sleep(config.llm.retryBaseDelayMs * (attempt + 1));
      }
    }
  }

  const fallback = heuristicFallback(text, lastError);
  fallback.latencyMs = Date.now() - start;
  return fallback;
}

export async function getAiHealth(): Promise<{
  provider: "huggingface";
  status: "up" | "degraded" | "down";
  model: string;
  checkedAt: string;
  message: string;
}> {
  if (!config.llm.huggingface.apiToken) {
    return {
      provider: "huggingface",
      status: "down",
      model: config.llm.huggingface.model,
      checkedAt: new Date().toISOString(),
      message: "HF token missing",
    };
  }

  try {
    const r = await fetch(`${config.llm.huggingface.apiBase.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${config.llm.huggingface.apiToken}` },
      signal: AbortSignal.timeout(Math.min(config.llm.requestTimeoutMs, 8000)),
    });
    return {
      provider: "huggingface",
      status: r.ok ? "up" : "degraded",
      model: config.llm.huggingface.model,
      checkedAt: new Date().toISOString(),
      message: r.ok ? "Provider reachable" : `Provider response ${r.status}`,
    };
  } catch (error) {
    return {
      provider: "huggingface",
      status: "down",
      model: config.llm.huggingface.model,
      checkedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
