import { pool } from "../db/pool.js";
import { newId } from "./ids.js";

export async function writeAudit(
  actor: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  await pool.query(
    `INSERT INTO audit_events (audit_event_id, actor, action, entity_type, entity_id, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newId("aud"), actor, action, entityType, entityId, JSON.stringify(details)],
  );
}
