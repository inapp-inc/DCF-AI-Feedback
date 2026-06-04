import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "../utils/audit.js";
import { enqueueTriggerJob, dispatchSurveyForJob } from "../services/dispatchService.js";
import { processDueTriggerJobs } from "../services/triggerScheduler.js";

const router = Router();
router.use(requireAuth);

const triggerSchema = z.object({
  eventId: z.string(),
  triggerType: z.enum([
    "fifty_one_a",
    "volunteer_event",
    "legal_milestone",
    "placement_milestone",
    "case_closure",
  ]),
  userGroup: z.enum(["mandated_reporter", "volunteer", "attorney", "foster_parent"]),
  filingId: z.string().optional(),
  caseId: z.string().optional(),
  placementId: z.string().optional(),
  milestoneId: z.string().optional(),
  occurredAt: z.string().datetime(),
});

router.post("/triggers/events", async (req, res) => {
  const parsed = triggerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }

  const existing = await pool.query("SELECT event_id FROM trigger_events WHERE event_id = ?", [
    parsed.data.eventId,
  ]);
  if (existing.rows.length > 0) {
    res.status(202).json({ eventId: parsed.data.eventId, orchestrationStatus: "duplicate_ignored" });
    return;
  }

  const triggerEventId = newId("trg");
  const triggerRef =
    parsed.data.filingId ??
    parsed.data.caseId ??
    parsed.data.placementId ??
    parsed.data.milestoneId ??
    null;

  await pool.query(
    `INSERT INTO trigger_events (trigger_event_id, event_id, trigger_type, user_group, trigger_ref, payload_json, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      triggerEventId,
      parsed.data.eventId,
      parsed.data.triggerType,
      parsed.data.userGroup,
      triggerRef,
      JSON.stringify(parsed.data),
      parsed.data.occurredAt,
    ],
  );

  const { jobId, fireAt } = await enqueueTriggerJob({
    eventId: parsed.data.eventId,
    triggerType: parsed.data.triggerType,
    userGroup: parsed.data.userGroup,
    triggerRef,
    occurredAt: parsed.data.occurredAt,
  });

  await writeAudit(req.user?.username ?? null, "trigger.ingest", "trigger_event", triggerEventId, {
    jobId,
    fireAt,
  });

  await processDueTriggerJobs();

  const after = await pool.query<{ form_instance_id: string | null }>(
    "SELECT form_instance_id FROM trigger_jobs WHERE job_id = ?",
    [jobId],
  );
  const instanceId = after.rows[0]?.form_instance_id ?? undefined;
  let customLink: string | undefined;
  if (instanceId) {
    const { rows: links } = await pool.query<{ custom_link: string }>(
      `SELECT custom_link FROM survey_dispatches WHERE form_instance_id = ? ORDER BY sent_at DESC LIMIT 1`,
      [instanceId],
    );
    customLink = links[0]?.custom_link;
  }

  res.status(202).json({
    eventId: parsed.data.eventId,
    orchestrationStatus: "accepted",
    jobId,
    fireAt,
    instanceId,
    customLink,
  });
});

router.get("/triggers/jobs", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT j.job_id, j.event_id, j.trigger_type, j.user_group, j.fire_at, j.status, j.form_instance_id, j.fired_at,
            j.trigger_ref, d.custom_link, fi.status AS instance_status
     FROM trigger_jobs j
     LEFT JOIN form_instances fi ON fi.form_instance_id = j.form_instance_id
     LEFT JOIN survey_dispatches d ON d.dispatch_id = (
       SELECT dispatch_id FROM survey_dispatches WHERE form_instance_id = j.form_instance_id
       ORDER BY sent_at DESC LIMIT 1
     )
     ORDER BY j.fire_at DESC LIMIT 100`,
  );
  res.json({ items: rows });
});

export default router;
