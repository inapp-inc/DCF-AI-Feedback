import { pool } from "../db/pool.js";
import { newId } from "../utils/ids.js";
import fs from "node:fs";
import path from "node:path";

const LOG_DIR = path.resolve(process.cwd(), "data", "notification-log");

export async function sendNotification(input: {
  formInstanceId: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  notificationType: "dispatch" | "reminder";
}) {
  const notificationId = newId("ntf");
  await pool.query(
    `INSERT INTO notification_log (notification_id, form_instance_id, channel, recipient, subject, body, status, notification_type)
     VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)`,
    [
      notificationId,
      input.formInstanceId,
      input.channel,
      input.recipient,
      input.subject,
      input.body,
      input.notificationType,
    ],
  );
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(
      path.join(LOG_DIR, "notifications.ndjson"),
      JSON.stringify({ ...input, notificationId, at: new Date().toISOString() }) + "\n",
    );
  } catch {
    /* demo sink optional */
  }
  console.log(`[notification] ${input.notificationType} -> ${input.recipient}: ${input.subject}`);
  return notificationId;
}
