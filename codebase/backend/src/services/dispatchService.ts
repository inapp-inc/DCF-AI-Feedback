import { pool } from "../db/pool.js";
import { buildSurveyLink } from "../utils/surveyLink.js";
import { newId, newToken } from "../utils/ids.js";
import { sendNotification } from "./notificationAdapter.js";
import { writeAudit } from "../utils/audit.js";

const TEMPLATE_BY_GROUP: Record<string, string> = {
  mandated_reporter: "tpl_mr_v1",
  volunteer: "tpl_vol_v1",
  attorney: "tpl_att_v1",
  foster_parent: "tpl_fp_v1",
};

const DEMO_RECIPIENT: Record<string, string> = {
  mandated_reporter: "reporter.demo@dcf.ma.gov",
  volunteer: "volunteer.demo@dcf.ma.gov",
  attorney: "attorney.demo@dcf.ma.gov",
  foster_parent: "foster.demo@dcf.ma.gov",
};

export function computeFireAt(triggerType: string, occurredAtIso: string): string {
  const base = new Date(occurredAtIso).getTime();
  const fast = process.env.DEMO_FAST_TRIGGERS !== "false";
  const ms = fast
    ? triggerType === "fifty_one_a"
      ? 8_000
      : triggerType === "volunteer_event"
        ? 5_000
        : triggerType === "placement_milestone"
          ? 10_000
          : 6_000
    : triggerType === "fifty_one_a"
      ? 6 * 86400 * 1000
      : triggerType === "volunteer_event"
        ? 48 * 3600 * 1000
        : 0;
  return new Date(base + ms).toISOString();
}

export async function dispatchSurveyForJob(jobId: string, sentBy = "scheduler") {
  const { rows } = await pool.query<{
    job_id: string;
    trigger_type: string;
    user_group: string;
    template_id: string | null;
    trigger_ref: string | null;
    event_id: string | null;
    form_instance_id: string | null;
  }>("SELECT * FROM trigger_jobs WHERE job_id = ?", [jobId]);
  if (!rows.length) return null;
  const job = rows[0];
  if (job.form_instance_id) {
    const { rows: links } = await pool.query<{ custom_link: string }>(
      `SELECT custom_link FROM survey_dispatches WHERE form_instance_id = ? ORDER BY sent_at DESC LIMIT 1`,
      [job.form_instance_id],
    );
    return { instanceId: job.form_instance_id, customLink: links[0]?.custom_link };
  }

  const templateId = job.template_id ?? TEMPLATE_BY_GROUP[job.user_group] ?? "tpl_mr_v1";
  const instanceId = newId("inst");
  const expiresAt = new Date(Date.now() + 14 * 86400 * 1000).toISOString();

  await pool.query(
    `INSERT INTO form_instances (form_instance_id, template_id, user_group, trigger_ref, expires_at, office_id)
     VALUES (?, ?, ?, ?, ?, 'Boston North')`,
    [instanceId, templateId, job.user_group, job.trigger_ref, expiresAt],
  );

  const token = newToken();
  await pool.query(
    `INSERT INTO dynamic_links (link_id, form_instance_id, token, expires_at) VALUES (?, ?, ?, ?)`,
    [newId("lnk"), instanceId, token, expiresAt],
  );

  const customLink = buildSurveyLink(token, {
    triggerRef: job.trigger_ref,
    userGroup: job.user_group,
    dispatchedAt: new Date().toISOString(),
  });
  await pool.query(
    `INSERT INTO survey_dispatches (dispatch_id, form_instance_id, custom_link, channel, sent_by)
     VALUES (?, ?, ?, 'both', ?)`,
    [newId("dsp"), instanceId, customLink, sentBy],
  );

  const recipient = DEMO_RECIPIENT[job.user_group] ?? "demo@dcf.ma.gov";
  await sendNotification({
    formInstanceId: instanceId,
    channel: "email",
    recipient,
    subject: `Feedback Survey — ${job.user_group}`,
    body: `Please complete your feedback survey: ${customLink}`,
    notificationType: "dispatch",
  });

  await pool.query(
    `UPDATE trigger_jobs SET status = 'sent', form_instance_id = ?, fired_at = datetime('now') WHERE job_id = ?`,
    [instanceId, jobId],
  );

  await writeAudit(sentBy, "trigger.job.fired", "trigger_job", jobId, { instanceId, customLink });
  return { instanceId, customLink };
}

export async function enqueueTriggerJob(input: {
  eventId: string;
  triggerType: string;
  userGroup: string;
  triggerRef?: string | null;
  occurredAt: string;
  templateId?: string;
}) {
  const jobId = newId("job");
  const fireAt = computeFireAt(input.triggerType, input.occurredAt);
  await pool.query(
    `INSERT INTO trigger_jobs (job_id, event_id, trigger_type, user_group, template_id, trigger_ref, fire_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
    [
      jobId,
      input.eventId,
      input.triggerType,
      input.userGroup,
      input.templateId ?? TEMPLATE_BY_GROUP[input.userGroup] ?? null,
      input.triggerRef ?? null,
      fireAt,
    ],
  );
  return { jobId, fireAt };
}
