import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { processSubmission } from "../services/submissionProcessor.js";

const router = Router();

const submitSchema = z.object({
  answers: z.record(z.unknown()),
  aiOptOut: z.boolean().optional(),
});

router.post("/surveys/:surveyInstanceId/submit", requireAuth, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const headerKey = req.header("Idempotency-Key") ?? req.header("idempotency-key");
  try {
    const surveyInstanceId = Array.isArray(req.params.surveyInstanceId)
      ? req.params.surveyInstanceId[0]
      : req.params.surveyInstanceId;
    const result = await processSubmission({
      surveyInstanceId,
      answers: parsed.data.answers,
      aiOptOut: parsed.data.aiOptOut,
      idempotencyKey: headerKey?.trim() || null,
      actor: req.user!.username,
      officeId: req.user!.officeId,
    });
    res.status(result.replayed ? 200 : 201).json({
      submissionId: result.submissionId,
      aiProcessingStatus: result.aiProcessingStatus,
      inferenceProvider: "huggingface",
      acknowledgementText: result.acknowledgementText,
    });
  } catch (e) {
    const err = e as Error & { statusCode?: number; code?: string };
    res.status(err.statusCode ?? 500).json({ code: err.code ?? "ERROR", message: err.message });
  }
});

router.get("/submissions/:submissionId/ai-result", requireAuth, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM ai_inferences WHERE submission_id = ?", [
    req.params.submissionId,
  ]);
  if (!rows.length) {
    res.status(404).json({ code: "NOT_FOUND", message: "AI result not found" });
    return;
  }
  const r = rows[0] as Record<string, unknown>;
  const { rows: entities } = await pool.query(
    "SELECT entity_type, entity_value FROM ai_entities WHERE submission_id = ?",
    [req.params.submissionId],
  );
  const { rows: ack } = await pool.query(
    "SELECT acknowledgement_text FROM submission_responses WHERE submission_id = ?",
    [req.params.submissionId],
  );
  res.json({
    submissionId: r.submission_id,
    topic: r.topic,
    sentimentScore: r.sentiment_score,
    urgency: r.urgency,
    privilegeTagged: Boolean(r.privilege_tagged),
    explainabilitySummary: r.explainability_summary,
    recommendedRoute: r.recommended_route,
    provider: r.provider,
    timeoutMs: config.llm.requestTimeoutMs,
    confidence: r.confidence,
    latencyMs: r.latency_ms,
    fallbackUsed: Boolean(r.fallback_used),
    model: r.model,
    errorMessage: r.error_message,
    entities,
    acknowledgementText: (ack[0] as { acknowledgement_text?: string } | undefined)?.acknowledgement_text,
  });
});

export default router;
