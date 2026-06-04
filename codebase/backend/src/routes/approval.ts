import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "../utils/audit.js";

const router = Router();
router.use(requireAuth);

// ── Shared submission detail query ──────────────────────────────────────────

const SUBMISSION_DETAIL_SQL = `
  SELECT
    s.submission_id,
    s.form_instance_id,
    s.user_group,
    s.approval_status,
    s.submitted_at,
    s.office_id,
    s.demo_demographic,
    ai.sentiment_score,
    ai.urgency,
    ai.topic,
    ai.privilege_tagged,
    ai.recommended_route,
    ai.explainability_summary,
    (
      SELECT json_group_array(json_object(
        'action', sa.action,
        'reviewerRole', sa.reviewer_role,
        'reviewerUsername', sa.reviewer_username,
        'note', sa.note,
        'createdAt', sa.created_at
      ))
      FROM submission_approvals sa
      WHERE sa.submission_id = s.submission_id
      ORDER BY sa.created_at ASC
    ) as approval_history
  FROM submissions s
  LEFT JOIN ai_inferences ai ON ai.submission_id = s.submission_id
`;

function mapRow(r: Record<string, unknown>) {
  let history: unknown[] = [];
  try {
    history = JSON.parse(String(r.approval_history ?? "[]")) as unknown[];
  } catch {
    history = [];
  }
  return {
    submissionId: r.submission_id,
    formInstanceId: r.form_instance_id,
    userGroup: r.user_group,
    approvalStatus: r.approval_status,
    submittedAt: r.submitted_at,
    officeId: r.office_id,
    demoDemographic: r.demo_demographic,
    sentimentScore: r.sentiment_score != null ? Number(r.sentiment_score) : null,
    urgency: r.urgency,
    topic: r.topic,
    privilegeTagged: Boolean(r.privilege_tagged),
    recommendedRoute: r.recommended_route,
    explainabilitySummary: r.explainability_summary,
    approvalHistory: history,
  };
}

// ── List: pending legal review ───────────────────────────────────────────────

router.get(
  "/approval/submissions/pending-legal",
  requireRoles("admin", "legal_reviewer"),
  async (_req, res) => {
    const { rows } = await pool.query(
      `${SUBMISSION_DETAIL_SQL}
       WHERE s.approval_status = 'pending_legal'
       ORDER BY s.submitted_at ASC`,
    );
    res.json({ items: rows.map(mapRow) });
  },
);

// ── List: pending supervisor approval ────────────────────────────────────────
// Shows submissions awaiting supervisor sign-off. Attorney items returned
// from legal review (action = legal_resolved) surface here too since their
// status is reset to pending_supervisor.

router.get(
  "/approval/submissions/pending-supervisor",
  requireRoles("admin", "supervisor"),
  async (_req, res) => {
    const { rows } = await pool.query(
      `${SUBMISSION_DETAIL_SQL}
       WHERE s.approval_status = 'pending_supervisor'
       ORDER BY
         CASE s.user_group WHEN 'attorney' THEN 0 ELSE 1 END,
         s.submitted_at ASC`,
    );
    res.json({ items: rows.map(mapRow) });
  },
);

// ── Approval action schema ───────────────────────────────────────────────────

const actionSchema = z.object({ note: z.string().optional() });

async function recordApproval(
  submissionId: string,
  reviewerUsername: string,
  reviewerRole: string,
  action: string,
  note?: string,
) {
  await pool.query(
    `INSERT INTO submission_approvals
       (approval_id, submission_id, reviewer_username, reviewer_role, action, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newId("apv"), submissionId, reviewerUsername, reviewerRole, action, note ?? null],
  );
}

// ── Full detail (answers + form questions) for overlay view ─────────────────

router.get(
  "/approval/submissions/:id/detail",
  requireRoles("admin", "supervisor", "legal_reviewer"),
  async (req, res) => {
    const submissionId = String(req.params.id);

    // Submission + AI data
    const { rows: subRows } = await pool.query<Record<string, unknown>>(
      `${SUBMISSION_DETAIL_SQL}
       WHERE s.submission_id = ?`,
      [submissionId],
    );
    if (!subRows.length) {
      res.status(404).json({ code: "NOT_FOUND", message: "Submission not found" });
      return;
    }
    const sub = mapRow(subRows[0]);

    // Raw answers
    const { rows: ansRows } = await pool.query<{ answers_json: string }>(
      "SELECT answers_json FROM submissions WHERE submission_id = ?",
      [submissionId],
    );
    let answers: Record<string, unknown> = {};
    try {
      answers = JSON.parse(ansRows[0]?.answers_json ?? "{}") as Record<string, unknown>;
    } catch { /* ignore */ }

    // Form template questions — schema_json holds { questions: [...], nextStepsLabel }
    const { rows: tplRows } = await pool.query<{ name: string; schema_json: string }>(
      `SELECT ft.name, ft.schema_json
       FROM form_instances fi
       JOIN form_templates ft ON ft.template_id = fi.template_id
       WHERE fi.form_instance_id = ?`,
      [sub.formInstanceId],
    );
    let questions: unknown[] = [];
    let formName = "";
    if (tplRows.length) {
      formName = tplRows[0].name;
      try {
        const schema = JSON.parse(tplRows[0].schema_json ?? "{}") as { questions?: unknown[] };
        questions = schema.questions ?? [];
      } catch { /* ignore */ }
    }

    res.json({ ...sub, answers, questions, formName });
  },
);

// ── Urgency override (supervisor / legal / admin) ────────────────────────────

router.patch(
  "/approval/submissions/:id/urgency",
  requireRoles("admin", "supervisor", "legal_reviewer"),
  async (req, res) => {
    const parsed = z.object({ urgency: z.enum(["low", "medium", "high"]) }).safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
      return;
    }
    const submissionId = String(req.params.id);
    const { rows } = await pool.query<{ submission_id: string }>(
      "SELECT submission_id FROM submissions WHERE submission_id = ?",
      [submissionId],
    );
    if (!rows.length) {
      res.status(404).json({ code: "NOT_FOUND", message: "Submission not found" });
      return;
    }
    await pool.query(
      "UPDATE ai_inferences SET urgency = ? WHERE submission_id = ?",
      [parsed.data.urgency, submissionId],
    );
    await writeAudit(req.user!.username, "approval.urgency.overridden", "submission", submissionId, {
      newUrgency: parsed.data.urgency,
    });
    res.json({ ok: true, urgency: parsed.data.urgency });
  },
);

// ── Supervisor: flag attorney submission for legal review ────────────────────

router.post(
  "/approval/submissions/:id/flag-legal",
  requireRoles("admin", "supervisor"),
  async (req, res) => {
    const parsed = actionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
      return;
    }
    const submissionId = String(req.params.id);
    const { rows } = await pool.query<{ approval_status: string; user_group: string }>(
      "SELECT approval_status, user_group FROM submissions WHERE submission_id = ?",
      [submissionId],
    );
    if (!rows.length) {
      res.status(404).json({ code: "NOT_FOUND", message: "Submission not found" });
      return;
    }
    if (rows[0].approval_status !== "pending_supervisor") {
      res.status(409).json({
        code: "INVALID_TRANSITION",
        message: `Cannot flag a submission in state '${rows[0].approval_status}'`,
      });
      return;
    }
    await pool.query(
      "UPDATE submissions SET approval_status = 'pending_legal' WHERE submission_id = ?",
      [submissionId],
    );
    await recordApproval(
      submissionId,
      req.user!.username,
      req.user!.role,
      "flagged_for_legal",
      parsed.data.note,
    );
    await writeAudit(req.user!.username, "approval.supervisor.flagged_legal", "submission", submissionId, {
      note: parsed.data.note ?? null,
    });
    res.json({ ok: true, newStatus: "pending_legal" });
  },
);

// ── Legal team: resolve (returns to supervisor for final approval) ────────────

router.post(
  "/approval/submissions/:id/legal-approve",
  requireRoles("admin", "legal_reviewer"),
  async (req, res) => {
    const parsed = actionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
      return;
    }
    const submissionId = String(req.params.id);
    const { rows } = await pool.query<{ approval_status: string }>(
      "SELECT approval_status FROM submissions WHERE submission_id = ?",
      [submissionId],
    );
    if (!rows.length) {
      res.status(404).json({ code: "NOT_FOUND", message: "Submission not found" });
      return;
    }
    if (rows[0].approval_status !== "pending_legal") {
      res.status(409).json({
        code: "INVALID_TRANSITION",
        message: `Cannot resolve a submission in state '${rows[0].approval_status}'`,
      });
      return;
    }
    // Resolved by legal → return to supervisor for final approval
    await pool.query(
      "UPDATE submissions SET approval_status = 'pending_supervisor' WHERE submission_id = ?",
      [submissionId],
    );
    await recordApproval(
      submissionId,
      req.user!.username,
      req.user!.role,
      "legal_resolved",
      parsed.data.note,
    );
    await writeAudit(req.user!.username, "approval.legal.resolved", "submission", submissionId, {
      note: parsed.data.note ?? null,
    });
    res.json({ ok: true, newStatus: "pending_supervisor" });
  },
);

// ── Legal team: reject ───────────────────────────────────────────────────────

router.post(
  "/approval/submissions/:id/legal-reject",
  requireRoles("admin", "legal_reviewer"),
  async (req, res) => {
    const parsed = actionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
      return;
    }
    const submissionId = String(req.params.id);
    const { rows } = await pool.query<{ approval_status: string }>(
      "SELECT approval_status FROM submissions WHERE submission_id = ?",
      [submissionId],
    );
    if (!rows.length) {
      res.status(404).json({ code: "NOT_FOUND", message: "Submission not found" });
      return;
    }
    if (rows[0].approval_status !== "pending_legal") {
      res.status(409).json({
        code: "INVALID_TRANSITION",
        message: `Cannot legal-reject a submission in state '${rows[0].approval_status}'`,
      });
      return;
    }
    await pool.query(
      "UPDATE submissions SET approval_status = 'rejected' WHERE submission_id = ?",
      [submissionId],
    );
    await recordApproval(
      submissionId,
      req.user!.username,
      req.user!.role,
      "legal_rejected",
      parsed.data.note,
    );
    await writeAudit(req.user!.username, "approval.legal.rejected", "submission", submissionId, {
      note: parsed.data.note ?? null,
    });
    res.json({ ok: true, newStatus: "rejected" });
  },
);

// ── Supervisor: approve ──────────────────────────────────────────────────────

router.post(
  "/approval/submissions/:id/supervisor-approve",
  requireRoles("admin", "supervisor"),
  async (req, res) => {
    const parsed = actionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
      return;
    }
    const submissionId = String(req.params.id);
    const { rows } = await pool.query<{ approval_status: string }>(
      "SELECT approval_status FROM submissions WHERE submission_id = ?",
      [submissionId],
    );
    if (!rows.length) {
      res.status(404).json({ code: "NOT_FOUND", message: "Submission not found" });
      return;
    }
    if (rows[0].approval_status !== "pending_supervisor") {
      res.status(409).json({
        code: "INVALID_TRANSITION",
        message: `Cannot supervisor-approve a submission in state '${rows[0].approval_status}'`,
      });
      return;
    }
    await pool.query(
      "UPDATE submissions SET approval_status = 'supervisor_approved' WHERE submission_id = ?",
      [submissionId],
    );
    await recordApproval(
      submissionId,
      req.user!.username,
      req.user!.role,
      "supervisor_approved",
      parsed.data.note,
    );
    await writeAudit(req.user!.username, "approval.supervisor.approved", "submission", submissionId, {
      note: parsed.data.note ?? null,
    });
    res.json({ ok: true, newStatus: "supervisor_approved" });
  },
);

// ── Supervisor: reject ───────────────────────────────────────────────────────

router.post(
  "/approval/submissions/:id/supervisor-reject",
  requireRoles("admin", "supervisor"),
  async (req, res) => {
    const parsed = actionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
      return;
    }
    const submissionId = String(req.params.id);
    const { rows } = await pool.query<{ approval_status: string }>(
      "SELECT approval_status FROM submissions WHERE submission_id = ?",
      [submissionId],
    );
    if (!rows.length) {
      res.status(404).json({ code: "NOT_FOUND", message: "Submission not found" });
      return;
    }
    const allowedStates = ["pending_supervisor", "legal_approved"];
    if (!allowedStates.includes(String(rows[0].approval_status))) {
      res.status(409).json({
        code: "INVALID_TRANSITION",
        message: `Cannot supervisor-reject a submission in state '${rows[0].approval_status}'`,
      });
      return;
    }
    await pool.query(
      "UPDATE submissions SET approval_status = 'rejected' WHERE submission_id = ?",
      [submissionId],
    );
    await recordApproval(
      submissionId,
      req.user!.username,
      req.user!.role,
      "supervisor_rejected",
      parsed.data.note,
    );
    await writeAudit(req.user!.username, "approval.supervisor.rejected", "submission", submissionId, {
      note: parsed.data.note ?? null,
    });
    res.json({ ok: true, newStatus: "rejected" });
  },
);

export default router;
