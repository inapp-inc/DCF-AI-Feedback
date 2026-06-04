import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "../utils/audit.js";
import { inferSubmission, type InferenceOutput } from "./hfInferenceService.js";
import { generateAcknowledgement } from "./hfGenerativeService.js";

export type SubmitInput = {
  surveyInstanceId: string;
  answers: Record<string, unknown>;
  aiOptOut?: boolean;
  idempotencyKey?: string | null;
  actor?: string;
  officeId?: string;
  demoDemographic?: string;
};

export type SubmitResult = {
  submissionId: string;
  acknowledgementText?: string;
  aiProcessingStatus: string;
  replayed?: boolean;
};

function validateAttorneyAttestation(userGroup: string, answers: Record<string, unknown>) {
  if (userGroup !== "attorney") return null;
  const attested = answers.attestation === true || answers.attested === true;
  if (!attested) {
    return "Attorney submissions require attestation (ATT-04)";
  }
  return null;
}

async function persistEntities(submissionId: string, entities: Array<{ type: string; value: string }>) {
  for (const e of entities) {
    await pool.query(
      `INSERT INTO ai_entities (entity_id, submission_id, entity_type, entity_value) VALUES (?, ?, ?, ?)`,
      [newId("ent"), submissionId, e.type, e.value],
    );
  }
}

export async function processSubmission(input: SubmitInput): Promise<SubmitResult> {
  const { rows: instRows } = await pool.query<{
    form_instance_id: string;
    user_group: string;
    status: string;
    office_id: string | null;
  }>("SELECT form_instance_id, user_group, status, office_id FROM form_instances WHERE form_instance_id = ?", [
    input.surveyInstanceId,
  ]);
  if (!instRows.length) {
    throw Object.assign(new Error("Survey not found"), { statusCode: 404 });
  }
  const inst = instRows[0];

  if (input.idempotencyKey) {
    const byKey = await pool.query<{ submission_id: string }>(
      "SELECT submission_id FROM submissions WHERE idempotency_key = ?",
      [input.idempotencyKey],
    );
    if (byKey.rows.length > 0) {
      return {
        submissionId: byKey.rows[0].submission_id,
        aiProcessingStatus: "completed",
        replayed: true,
      };
    }
  }

  if (inst.status === "submitted") {
    throw Object.assign(new Error("Survey already submitted"), { statusCode: 409, code: "DUPLICATE" });
  }

  const attestationError = validateAttorneyAttestation(inst.user_group, input.answers);
  if (attestationError) {
    throw Object.assign(new Error(attestationError), { statusCode: 400, code: "ATTESTATION_REQUIRED" });
  }

  const existing = await pool.query<{ submission_id: string }>(
    "SELECT submission_id FROM submissions WHERE form_instance_id = ?",
    [input.surveyInstanceId],
  );
  if (existing.rows.length > 0) {
    throw Object.assign(new Error("Survey already submitted"), { statusCode: 409, code: "DUPLICATE" });
  }

  const submissionId = newId("sub");
  const attested =
    inst.user_group === "attorney" ? 1 : input.answers.attestation === true || input.answers.attested === true ? 1 : 0;

  // All submissions (including attorney) go to the supervisor first.
  // Supervisor can then flag attorney submissions for legal review if needed.
  const initialApprovalStatus = "pending_supervisor";

  await pool.query(
    `INSERT INTO submissions (submission_id, form_instance_id, user_group, idempotency_key, answers_json, ai_opt_out, attested, attestation_version, demo_demographic, office_id, approval_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      submissionId,
      input.surveyInstanceId,
      inst.user_group,
      input.idempotencyKey ?? null,
      JSON.stringify(input.answers),
      input.aiOptOut ? 1 : 0,
      attested || null,
      attested ? "v1-demo" : null,
      input.demoDemographic ?? null,
      input.officeId ?? inst.office_id ?? "Boston North",
      initialApprovalStatus,
    ],
  );
  await pool.query(`UPDATE form_instances SET status = 'submitted' WHERE form_instance_id = ?`, [
    input.surveyInstanceId,
  ]);
  await pool.query(
    `UPDATE trigger_jobs SET status = 'completed' WHERE form_instance_id = ? AND status != 'completed'`,
    [input.surveyInstanceId],
  );
  await pool.query(
    `UPDATE dynamic_links SET consumed_at = datetime('now') WHERE form_instance_id = ? AND consumed_at IS NULL`,
    [input.surveyInstanceId],
  );

  await writeAudit(input.actor ?? "respondent", "submission.create", "submission", submissionId, {});

  // Topic is always derived from the case stage + respondent role, not inferred from content.
  const TOPIC_BY_GROUP: Record<string, string> = {
    mandated_reporter: "Intake · Mandated Reporter",
    volunteer:         "Investigation · Volunteer",
    foster_parent:     "Placement · Foster Parent",
    attorney:          "Legal Process · Attorney",
  };
  const determinedTopic = TOPIC_BY_GROUP[inst.user_group] ?? "General Feedback";

  let inferred: InferenceOutput;
  if (input.aiOptOut) {
    inferred = {
      topic: determinedTopic,
      urgency: "medium",
      sentiment: 3,
      confidence: 0,
      explainability: "Submitter opted out of AI processing; routed to manual review.",
      legalSensitive: false,
      fallbackUsed: true,
      latencyMs: 0,
      model: "manual-optout",
      errorMessage: "aiOptOut=true",
      entities: [] as Array<{ type: string; value: string }>,
    };
  } else {
    inferred = await inferSubmission(input.answers);
    inferred.topic = determinedTopic; // always override with deterministic stage+role label
  }

  if (inferred.entities?.length) {
    await persistEntities(submissionId, inferred.entities);
  }

  const privilegeTagged = inst.user_group === "attorney" ? 1 : 0;
  const legalSensitive = inferred.legalSensitive || privilegeTagged === 1;
  const recommendedRoute = input.aiOptOut
    ? "supervisor_queue"
    : legalSensitive
      ? "legal_policy_queue"
      : inferred.urgency === "high"
        ? "supervisor_queue"
        : "closed_loop_ai";

  const inferenceId = newId("inf");
  await pool.query(
    `INSERT INTO ai_inferences
      (inference_id, submission_id, provider, topic, sentiment_score, urgency, explainability_summary, recommended_route, privilege_tagged, confidence, latency_ms, fallback_used, model, error_message)
     VALUES (?, ?, 'huggingface', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inferenceId,
      submissionId,
      inferred.topic,
      inferred.sentiment,
      inferred.urgency,
      inferred.explainability,
      recommendedRoute,
      privilegeTagged,
      inferred.confidence,
      inferred.latencyMs,
      inferred.fallbackUsed ? 1 : 0,
      inferred.model,
      inferred.errorMessage ?? null,
    ],
  );

  if (recommendedRoute === "supervisor_queue" || recommendedRoute === "legal_policy_queue") {
    await pool.query(
      `INSERT INTO supervisor_queue
        (queue_item_id, submission_id, user_group, office_id, status, priority, reason, queue_kind)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
      [
        newId("q"),
        submissionId,
        inst.user_group,
        input.officeId ?? inst.office_id ?? "Boston North",
        inferred.urgency === "high" ? "high" : "normal",
        inferred.explainability,
        recommendedRoute === "legal_policy_queue" ? "legal_policy" : "supervisor",
      ],
    );
  }

  await checkNotificationCompliance(submissionId, inst.user_group, input.answers);

  const ack = await generateAcknowledgement(input.answers, inferred);
  await pool.query(
    `INSERT INTO submission_responses (response_id, submission_id, acknowledgement_text) VALUES (?, ?, ?)`,
    [newId("resp"), submissionId, ack],
  );

  await writeAudit(input.actor ?? "system", "submission.inference.completed", "submission", submissionId, {
    recommendedRoute,
    fallbackUsed: inferred.fallbackUsed,
  });

  return {
    submissionId,
    acknowledgementText: ack,
    aiProcessingStatus: "completed",
  };
}

async function checkNotificationCompliance(
  submissionId: string,
  userGroup: string,
  answers: Record<string, unknown>,
) {
  if (userGroup !== "mandated_reporter") return;
  const timely = answers.notification_timely ?? answers.outcome_notification;
  if (timely === undefined) return;
  const filingRef = String(answers.filing_reference ?? "51A-2026-04412");
  const { rows } = await pool.query<{ notification_sent: number }>(
    "SELECT notification_sent FROM dcf_notification_records WHERE filing_ref = ?",
    [filingRef],
  );
  if (!rows.length) return;
  const documented = rows[0].notification_sent === 1;
  const reportedTimely = Number(timely) >= 3 || timely === true || timely === "yes";
  if (documented !== reportedTimely) {
    await pool.query(
      `INSERT INTO risk_signals (signal_id, signal_type, resource_id, score, summary, severity)
       VALUES (?, 'notification_compliance', ?, 0.9, ?, 'high')`,
      [
        newId("risk"),
        submissionId,
        `MR-08: Reporter notification outcome does not match DCF record for ${filingRef}`,
      ],
    );
  }
}
