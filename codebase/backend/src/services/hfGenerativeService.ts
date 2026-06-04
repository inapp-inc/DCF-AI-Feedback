import { config } from "../config.js";
import type { InferenceOutput } from "./hfInferenceService.js";

const TOPIC_LABELS = [
  "hotline_quality",
  "screener_quality",
  "training_quality",
  "visit_quality",
  "legal_process",
  "placement_stability",
  "resource_gaps",
  "communication",
  "stipend_timeliness",
  "case_closure",
  "general_feedback",
  "safety_concern",
];

export async function hfChatJson(prompt: string, maxTokens = 800): Promise<string | null> {
  if (!config.llm.huggingface.apiToken) return null;
  try {
    const response = await fetch(`${config.llm.huggingface.apiBase.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.llm.huggingface.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.llm.huggingface.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(Math.min(config.llm.requestTimeoutMs, 120000)),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function generateAcknowledgement(
  answers: Record<string, unknown>,
  inferred: InferenceOutput,
): Promise<string> {
  const prompt = `Write a brief, professional acknowledgement (2-3 sentences) for a feedback submitter. Topic: ${inferred.topic}. Urgency: ${inferred.urgency}. Do not promise specific outcomes. Plain text only.`;
  const text = await hfChatJson(prompt, 300);
  if (text) return text;
  return `Thank you for your feedback. We have received your submission regarding ${inferred.topic.replace(/_/g, " ")}. A member of our team will review your response${inferred.urgency === "high" ? " as a priority" : ""}.`;
}

export async function generateReportBody(reportType: string, context: string): Promise<string> {
  const prompt = `Draft a ${reportType} feedback brief for leadership.
Use ONLY the aggregate JSON context below — do not invent metrics, dates, or quotes.
If a field is missing, state that data was not available.
Include: executive summary, key trends, recommended actions. Mark as DRAFT. Max 600 words.

AGGREGATE_JSON:
${context}`;
  const text = await hfChatJson(prompt, 1200);
  if (text) return text;
  return `DRAFT ${reportType} report\n\n${context}\n\n[Generated using fallback template — configure HF_API_TOKEN for full generative output.]`;
}

export { TOPIC_LABELS };
