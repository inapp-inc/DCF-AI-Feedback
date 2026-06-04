import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { buildSurveyLink } from "../utils/surveyLink.js";
import { newId, newToken } from "../utils/ids.js";
import { writeAudit } from "../utils/audit.js";

const router = Router();
router.use(requireAuth);

const userGroupSchema = z.enum([
  "mandated_reporter",
  "volunteer",
  "attorney",
  "foster_parent",
]);

const templateInSchema = z.object({
  name: z.string().min(1),
  userGroup: userGroupSchema,
  version: z.number().int().optional(),
  questions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["likert", "text", "multi_select", "dropdown", "attestation"]),
      label: z.string(),
      description: z.string().optional(),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
    }),
  ),
  nextStepsLabel: z.string().optional(),
});

function mapTemplate(row: Record<string, unknown>) {
  const schema = JSON.parse(String(row.schema_json ?? "{}")) as Record<string, unknown>;
  return {
    templateId: row.template_id,
    name: row.name,
    userGroup: row.user_group,
    version: row.version,
    questions: schema.questions ?? [],
    nextStepsLabel: schema.nextStepsLabel ?? "Next Steps",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/forms/templates", async (req, res) => {
  const userGroup = req.query.userGroup as string | undefined;
  const params: unknown[] = [];
  let sql = "SELECT * FROM form_templates WHERE active = 1";
  if (userGroup) {
    sql += " AND user_group = ?";
    params.push(userGroup);
  }
  sql += " ORDER BY updated_at DESC";
  const { rows } = await pool.query(sql, params);
  res.json({ items: rows.map(mapTemplate) });
});

router.post("/forms/templates", requireRoles("admin", "supervisor"), async (req, res) => {
  const parsed = templateInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const templateId = newId("tpl");
  const schemaJson = JSON.stringify({
    questions: parsed.data.questions,
    nextStepsLabel: parsed.data.nextStepsLabel ?? "Next Steps",
  });
  await pool.query(
    `INSERT INTO form_templates (template_id, name, user_group, version, schema_json)
     VALUES (?, ?, ?, ?, ?)`,
    [templateId, parsed.data.name, parsed.data.userGroup, parsed.data.version ?? 1, schemaJson],
  );
  await writeAudit(req.user!.username, "form.template.create", "form_template", templateId, {});
  const { rows } = await pool.query("SELECT * FROM form_templates WHERE template_id = ?", [templateId]);
  res.status(201).json(mapTemplate(rows[0]));
});

router.put("/forms/templates/:templateId", requireRoles("admin", "supervisor"), async (req, res) => {
  const parsed = templateInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const schemaJson = JSON.stringify({
    questions: parsed.data.questions,
    nextStepsLabel: parsed.data.nextStepsLabel ?? "Next Steps",
  });
  await pool.query(
    `UPDATE form_templates SET name = ?, user_group = ?, version = ?, schema_json = ?, updated_at = datetime('now')
     WHERE template_id = ?`,
    [parsed.data.name, parsed.data.userGroup, parsed.data.version ?? 1, schemaJson, req.params.templateId],
  );
  const { rows } = await pool.query("SELECT * FROM form_templates WHERE template_id = ?", [
    req.params.templateId,
  ]);
  if (!rows.length) {
    res.status(404).json({ code: "NOT_FOUND", message: "Template not found" });
    return;
  }
  res.json(mapTemplate(rows[0]));
});

const instanceInSchema = z.object({
  templateId: z.string(),
  userGroup: userGroupSchema,
  triggerRef: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

function mapInstance(row: Record<string, unknown>) {
  const tpl = row.schema_json
    ? (JSON.parse(String(row.schema_json)) as { questions?: unknown[] })
    : { questions: [] };
  return {
    surveyInstanceId: row.form_instance_id,
    userGroup: row.user_group,
    triggerRef: row.trigger_ref,
    expiresAt: row.expires_at,
    aiDisclosureRequired: true,
    questions: tpl.questions ?? [],
  };
}

router.get("/forms/instances", requireRoles("admin", "supervisor"), async (req, res) => {
  const { status, userGroup, templateId } = req.query as Record<string, string | undefined>;
  const params: unknown[] = [];
  let sql = `SELECT fi.form_instance_id, fi.template_id, fi.user_group, fi.trigger_ref,
                    fi.status, fi.expires_at, fi.created_at,
                    ft.name as template_name,
                    sd.custom_link,
                    (SELECT COUNT(*) FROM submissions s WHERE s.form_instance_id = fi.form_instance_id) as submission_count
             FROM form_instances fi
             JOIN form_templates ft ON ft.template_id = fi.template_id
             LEFT JOIN survey_dispatches sd ON sd.dispatch_id = (
               SELECT dispatch_id FROM survey_dispatches
               WHERE form_instance_id = fi.form_instance_id
               ORDER BY sent_at DESC LIMIT 1
             )
             WHERE fi.status != 'closed'`;
  if (status) { sql += " AND fi.status = ?"; params.push(status); }
  if (userGroup) { sql += " AND fi.user_group = ?"; params.push(userGroup); }
  if (templateId) { sql += " AND fi.template_id = ?"; params.push(templateId); }
  sql += " ORDER BY fi.created_at DESC LIMIT 100";
  const { rows } = await pool.query(sql, params);
  res.json({
    items: rows.map((r) => ({
      surveyInstanceId: r.form_instance_id,
      templateId: r.template_id,
      templateName: r.template_name,
      userGroup: r.user_group,
      triggerRef: r.trigger_ref,
      status: r.status,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      customLink: r.custom_link,
      submissionCount: Number(r.submission_count ?? 0),
    })),
  });
});

router.delete("/forms/instances/:instanceId", requireRoles("admin", "supervisor"), async (req, res) => {
  const instanceId = String(req.params.instanceId);
  const { rows } = await pool.query(
    "SELECT form_instance_id, status FROM form_instances WHERE form_instance_id = ?",
    [instanceId],
  );
  if (!rows.length) {
    res.status(404).json({ code: "NOT_FOUND", message: "Instance not found" });
    return;
  }
  if ((rows[0] as { status: string }).status === "submitted") {
    res.status(409).json({ code: "CONFLICT", message: "Cannot delete a submitted survey instance" });
    return;
  }
  await pool.query(
    `UPDATE form_instances SET status = 'closed', updated_at = datetime('now') WHERE form_instance_id = ?`,
    [instanceId],
  );
  await pool.query(
    `UPDATE dynamic_links SET consumed_at = datetime('now')
     WHERE form_instance_id = ? AND consumed_at IS NULL`,
    [instanceId],
  );
  await writeAudit(req.user!.username, "survey.instance.delete", "form_instance", instanceId, {});
  res.status(204).send();
});

router.post("/forms/instances", async (req, res) => {
  const parsed = instanceInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const instanceId = newId("inst");
  const expiresAt =
    parsed.data.expiresAt ?? new Date(Date.now() + 14 * 86400 * 1000).toISOString();
  await pool.query(
    `INSERT INTO form_instances (form_instance_id, template_id, user_group, trigger_ref, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [instanceId, parsed.data.templateId, parsed.data.userGroup, parsed.data.triggerRef ?? null, expiresAt],
  );
  const { rows } = await pool.query(
    `SELECT fi.*, ft.schema_json FROM form_instances fi
     JOIN form_templates ft ON ft.template_id = fi.template_id
     WHERE fi.form_instance_id = ?`,
    [instanceId],
  );
  res.status(201).json(mapInstance(rows[0]));
});

async function linkContextForInstance(instanceId: string) {
  const { rows } = await pool.query<{ trigger_ref: string | null; user_group: string }>(
    "SELECT trigger_ref, user_group FROM form_instances WHERE form_instance_id = ?",
    [instanceId],
  );
  if (!rows.length) return undefined;
  return {
    triggerRef: rows[0].trigger_ref,
    userGroup: rows[0].user_group,
    dispatchedAt: new Date().toISOString(),
  };
}

router.post("/forms/instances/:instanceId/links", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT form_instance_id FROM form_instances WHERE form_instance_id = ?",
    [req.params.instanceId],
  );
  if (!rows.length) {
    res.status(404).json({ code: "NOT_FOUND", message: "Instance not found" });
    return;
  }
  const token = newToken();
  const linkId = newId("lnk");
  const expiresAt = new Date(Date.now() + 14 * 86400 * 1000).toISOString();
  await pool.query(
    `INSERT INTO dynamic_links (link_id, form_instance_id, token, expires_at) VALUES (?, ?, ?, ?)`,
    [linkId, req.params.instanceId, token, expiresAt],
  );
  const ctx = await linkContextForInstance(req.params.instanceId);
  const url = buildSurveyLink(token, ctx);
  res.status(201).json({ instanceId: req.params.instanceId, token, url, expiresAt });
});

router.post("/forms/instances/:instanceId/send", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT form_instance_id FROM form_instances WHERE form_instance_id = ?",
    [req.params.instanceId],
  );
  if (!rows.length) {
    res.status(404).json({ code: "NOT_FOUND", message: "Instance not found" });
    return;
  }
  const token = newToken();
  const linkId = newId("lnk");
  const expiresAt = new Date(Date.now() + 14 * 86400 * 1000).toISOString();
  await pool.query(
    `INSERT INTO dynamic_links (link_id, form_instance_id, token, expires_at) VALUES (?, ?, ?, ?)`,
    [linkId, req.params.instanceId, token, expiresAt],
  );
  const ctx = await linkContextForInstance(req.params.instanceId);
  const customLink = buildSurveyLink(token, ctx);
  const dispatchId = newId("dsp");
  await pool.query(
    `INSERT INTO survey_dispatches (dispatch_id, form_instance_id, custom_link, channel, sent_by)
     VALUES (?, ?, ?, 'both', ?)`,
    [dispatchId, req.params.instanceId, customLink, req.user!.username],
  );
  if (ctx?.triggerRef) {
    await pool.query(
      `UPDATE trigger_jobs SET form_instance_id = ?, status = 'fired'
       WHERE trigger_ref = ? AND (form_instance_id IS NULL OR form_instance_id = ?)`,
      [req.params.instanceId, ctx.triggerRef, req.params.instanceId],
    );
  }
  await writeAudit(req.user!.username, "survey.send", "form_instance", req.params.instanceId, {
    customLink,
  });
  res.json({
    instanceId: req.params.instanceId,
    status: "sent",
    customLink,
    deliveryChannel: "both",
  });
});

router.post("/forms/tokens/:token/validate", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT token, expires_at, consumed_at FROM dynamic_links WHERE token = ?`,
    [req.params.token],
  );
  if (!rows.length) {
    res.json({ valid: false, reason: "not_found" });
    return;
  }
  const link = rows[0] as { expires_at: string; consumed_at: string | null };
  if (link.consumed_at) {
    res.json({ valid: false, reason: "already_used" });
    return;
  }
  if (new Date(link.expires_at) < new Date()) {
    res.json({ valid: false, reason: "expired" });
    return;
  }
  res.json({ valid: true });
});

router.get("/surveys/:surveyInstanceId", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT fi.*, ft.schema_json FROM form_instances fi
     JOIN form_templates ft ON ft.template_id = fi.template_id
     WHERE fi.form_instance_id = ?`,
    [req.params.surveyInstanceId],
  );
  if (!rows.length) {
    res.status(404).json({ code: "NOT_FOUND", message: "Survey not found" });
    return;
  }
  const inst = rows[0] as { expires_at: string; status: string };
  if (new Date(inst.expires_at) < new Date() || inst.status === "closed") {
    res.status(404).json({ code: "NOT_FOUND", message: "Survey expired" });
    return;
  }
  res.json(mapInstance(rows[0]));
});

export default router;
