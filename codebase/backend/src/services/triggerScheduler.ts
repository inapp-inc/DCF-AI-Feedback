import { pool } from "../db/pool.js";
import { dispatchSurveyForJob } from "./dispatchService.js";
import { sendNotification } from "./notificationAdapter.js";
import { newId } from "../utils/ids.js";

let interval: ReturnType<typeof setInterval> | null = null;

export async function processDueTriggerJobs() {
  const { rows } = await pool.query<{ job_id: string }>(
    `SELECT job_id FROM trigger_jobs WHERE status = 'scheduled' AND fire_at <= datetime('now')`,
  );
  for (const row of rows) {
    await dispatchSurveyForJob(row.job_id);
  }
}

export async function processReminders() {
  const { rows } = await pool.query<{
    form_instance_id: string;
    user_group: string;
    custom_link: string;
  }>(
    `SELECT fi.form_instance_id, fi.user_group, sd.custom_link
     FROM form_instances fi
     JOIN survey_dispatches sd ON sd.form_instance_id = fi.form_instance_id
     WHERE fi.status = 'open'
       AND fi.created_at <= datetime('now', '-3 days')
       AND NOT EXISTS (
         SELECT 1 FROM notification_log nl
         WHERE nl.form_instance_id = fi.form_instance_id AND nl.notification_type = 'reminder'
       )
     LIMIT 20`,
  );
  for (const row of rows) {
    await sendNotification({
      formInstanceId: row.form_instance_id,
      channel: "email",
      recipient: "reminder.demo@dcf.ma.gov",
      subject: "Reminder: Feedback survey pending",
      body: `Your survey is still open: ${row.custom_link}`,
      notificationType: "reminder",
    });
  }
}

export async function processAnomalyScan() {
  const { rows: vol } = await pool.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM submissions WHERE submitted_at >= datetime('now', '-7 days')`,
  );
  const count = Number(vol[0]?.c ?? 0);
  const { rows: baseline } = await pool.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM submissions WHERE submitted_at >= datetime('now', '-14 days') AND submitted_at < datetime('now', '-7 days')`,
  );
  const base = Number(baseline[0]?.c ?? 0) || 1;
  if (count > base * 1.4 && count >= 3) {
    const existing = await pool.query(
      `SELECT signal_id FROM risk_signals WHERE signal_type = 'volume_spike' AND created_at >= datetime('now', '-1 day')`,
    );
    if (!existing.rows.length) {
      await pool.query(
        `INSERT INTO risk_signals (signal_id, signal_type, resource_id, score, summary, severity)
         VALUES (?, 'volume_spike', 'global', ?, ?, 'high')`,
        [newId("risk"), count / base, `Submission volume spike: ${count} in 7d vs baseline ${base}`],
      );
    }
  }
}

export function startBackgroundJobs() {
  if (interval) return;
  interval = setInterval(async () => {
    try {
      await processDueTriggerJobs();
      await processReminders();
      await processAnomalyScan();
    } catch (e) {
      console.error("[scheduler]", e);
    }
  }, 10_000);
  processDueTriggerJobs().catch(console.error);
}

export function stopBackgroundJobs() {
  if (interval) clearInterval(interval);
  interval = null;
}
