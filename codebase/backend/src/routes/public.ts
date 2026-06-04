import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { processSubmission } from "../services/submissionProcessor.js";
import {
  getSurveyWelcome,
  processChatMessage,
  type ChatMessage,
} from "../services/surveyChatService.js";

const router = Router();

function buildPrefillAnswers(
  questions: Array<{ id: string; type?: string }>,
  ref: string | null,
): Record<string, string> {
  if (!ref) return {};
  const out: Record<string, string> = {};
  for (const q of questions) {
    if (q.id === "filing_reference" || (q.id.includes("filing") && q.id.includes("ref"))) {
      out[q.id] = ref;
    }
    if (q.id === "placement_id" || q.id === "placement_ref") {
      out[q.id] = ref;
    }
  }
  return out;
}

function mapSurvey(row: Record<string, unknown>, query: Record<string, string | undefined>) {
  const schema = JSON.parse(String(row.schema_json ?? "{}")) as {
    questions?: Array<{ id: string; type?: string }>;
    nextStepsLabel?: string;
  };
  const questions = schema.questions ?? [];
  const refFromUrl = query.ref?.trim() || null;
  const triggerRef = row.trigger_ref ? String(row.trigger_ref) : null;
  const ref = refFromUrl || triggerRef;
  return {
    surveyInstanceId: row.form_instance_id,
    templateName: row.name,
    userGroup: row.user_group,
    triggerRef,
    linkContext: {
      ref: refFromUrl ?? triggerRef,
      role: query.role ?? row.user_group,
      dispatchedAt: query.ts ?? null,
    },
    prefillAnswers: buildPrefillAnswers(questions, ref),
    expiresAt: row.expires_at,
    aiDisclosureRequired: true,
    nextStepsLabel: schema.nextStepsLabel ?? "Next Steps",
    questions,
  };
}

function portalStatusLabel(row: Record<string, unknown>): string {
  if (row.status === "submitted") return "Completed";
  if (row.custom_link && row.status === "open") return "Awaiting response";
  if (row.job_status === "completed" || row.job_status === "fired") return "Sent";
  if (row.job_status === "scheduled") return "Scheduled";
  return "Pending";
}

async function resolveToken(token: string) {
  const { rows } = await pool.query<{
    form_instance_id: string;
    expires_at: string;
    consumed_at: string | null;
    status: string;
  }>(
    `SELECT dl.form_instance_id, dl.expires_at, dl.consumed_at, fi.status
     FROM dynamic_links dl
     JOIN form_instances fi ON fi.form_instance_id = dl.form_instance_id
     WHERE dl.token = ?`,
    [token],
  );
  if (!rows.length) return { error: "not_found" as const };
  const link = rows[0];
  if (link.consumed_at || link.status === "submitted") {
    return { error: "already_used" as const };
  }
  if (new Date(link.expires_at) < new Date()) {
    return { error: "expired" as const };
  }
  return { instanceId: link.form_instance_id };
}

router.get("/public/surveys/:token", async (req, res) => {
  const resolved = await resolveToken(req.params.token);
  if ("error" in resolved) {
    res.status(resolved.error === "expired" ? 410 : 404).json({ valid: false, reason: resolved.error });
    return;
  }
  const { rows } = await pool.query(
    `SELECT fi.*, ft.name, ft.schema_json FROM form_instances fi
     JOIN form_templates ft ON ft.template_id = fi.template_id
     WHERE fi.form_instance_id = ?`,
    [resolved.instanceId],
  );
  if (!rows.length) {
    res.status(404).json({ code: "NOT_FOUND" });
    return;
  }
  const q = req.query as Record<string, string | undefined>;
  res.json({ valid: true, ...mapSurvey(rows[0], q) });
});

const submitSchema = z.object({
  answers: z.record(z.unknown()),
  aiOptOut: z.boolean().optional(),
  demoDemographic: z.string().optional(),
});

router.post("/public/surveys/:token/submit", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const resolved = await resolveToken(req.params.token);
  if ("error" in resolved) {
    res.status(resolved.error === "expired" ? 410 : 404).json({ code: "INVALID_TOKEN", reason: resolved.error });
    return;
  }
  try {
    const result = await processSubmission({
      surveyInstanceId: resolved.instanceId,
      answers: parsed.data.answers,
      aiOptOut: parsed.data.aiOptOut,
      actor: "respondent",
      demoDemographic: parsed.data.demoDemographic,
    });
    res.status(201).json(result);
  } catch (e) {
    const err = e as Error & { statusCode?: number; code?: string };
    res.status(err.statusCode ?? 500).json({
      code: err.code ?? "ERROR",
      message: err.message,
    });
  }
});

router.get("/public/portal/surveys", async (req, res) => {
  const userGroup = req.query.userGroup as string | undefined;
  if (!userGroup) {
    res.status(400).json({ message: "userGroup required" });
    return;
  }
  const { rows } = await pool.query(
    `SELECT fi.form_instance_id, fi.status, fi.trigger_ref, fi.created_at,
            sd.custom_link, tj.fire_at, tj.status as job_status
     FROM form_instances fi
     LEFT JOIN survey_dispatches sd ON sd.dispatch_id = (
       SELECT dispatch_id FROM survey_dispatches WHERE form_instance_id = fi.form_instance_id
       ORDER BY sent_at DESC LIMIT 1
     )
     LEFT JOIN trigger_jobs tj ON tj.form_instance_id = fi.form_instance_id
     WHERE fi.user_group = ?
       AND fi.status != 'closed'
     ORDER BY fi.created_at DESC LIMIT 25`,
    [userGroup],
  );
  res.json({
    items: rows.map((r) => ({
      surveyInstanceId: r.form_instance_id,
      status: r.status,
      statusLabel: portalStatusLabel(r),
      triggerRef: r.trigger_ref,
      customLink: r.custom_link,
      scheduledFireAt: r.fire_at,
      jobStatus: r.job_status,
      createdAt: r.created_at,
    })),
  });
});

// ── Survey assistant chat ────────────────────────────────────────────────────

async function getSurveyContextForChat(instanceId: string) {
  const { rows } = await pool.query(
    `SELECT fi.user_group, ft.name, ft.schema_json
     FROM form_instances fi
     JOIN form_templates ft ON ft.template_id = fi.template_id
     WHERE fi.form_instance_id = ?`,
    [instanceId],
  );
  if (!rows.length) return null;
  const r = rows[0] as { user_group: string; name: string; schema_json: string };
  const schema = JSON.parse(r.schema_json ?? "{}") as {
    questions?: Array<{ id: string; type: string; label: string; description?: string; options?: string[] }>;
  };
  return {
    templateName: String(r.name),
    userGroup: String(r.user_group),
    questions: schema.questions ?? [],
  };
}

const chatSchema = z.object({
  mode: z.enum(["general", "question_help"]).default("general"),
  message: z.string().max(1200).default(""),
  questionId: z.string().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(20)
    .default([]),
});

router.post("/public/surveys/:token/chat", async (req, res) => {
  const resolved = await resolveToken(req.params.token);
  if ("error" in resolved) {
    res.status(404).json({ code: "INVALID_TOKEN" });
    return;
  }
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const ctx = await getSurveyContextForChat(resolved.instanceId);
  if (!ctx) {
    res.status(404).json({ code: "NOT_FOUND" });
    return;
  }
  const history: ChatMessage[] = parsed.data.history.map((h) => ({
    role: h.role,
    content: h.content,
  }));
  const result = await processChatMessage(
    ctx,
    parsed.data.mode,
    parsed.data.message,
    parsed.data.questionId,
    history,
  );
  res.json(result);
});

router.get("/public/surveys/:token/chat/welcome", async (req, res) => {
  const resolved = await resolveToken(req.params.token);
  if ("error" in resolved) {
    res.status(404).json({ code: "INVALID_TOKEN" });
    return;
  }
  const ctx = await getSurveyContextForChat(resolved.instanceId);
  if (!ctx) {
    res.status(404).json({ code: "NOT_FOUND" });
    return;
  }
  const result = await getSurveyWelcome(ctx);
  res.json(result);
});

router.get("/public/trigger-jobs", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT job_id, event_id, trigger_type, user_group, fire_at, status, form_instance_id
     FROM trigger_jobs ORDER BY fire_at ASC LIMIT 50`,
  );
  res.json({ items: rows });
});

export default router;
