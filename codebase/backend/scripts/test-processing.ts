/* eslint-disable no-console */
import assert from "node:assert/strict";

const base = process.env.API_BASE ?? "http://localhost:8080/v1";

async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${base}${path}`, init);
  const body = await r.text();
  let json: unknown = {};
  try {
    json = body ? JSON.parse(body) : {};
  } catch {
    json = {};
  }
  return { status: r.status, json };
}

async function run() {
  const login = await api("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin_demo", password: "demo" }),
  });
  assert.equal(login.status, 200);
  const username = (login.json as { username: string }).username;
  const headers = { "Content-Type": "application/json", "x-demo-user": username };

  const suffix = String(Date.now());
  const createInstance = await api("/forms/instances", {
    method: "POST",
    headers,
    body: JSON.stringify({
      templateId: "tpl_att_v1",
      userGroup: "attorney",
      triggerRef: `processing-ref-${suffix}`,
    }),
  });
  assert.equal(createInstance.status, 201);
  const instanceId = (createInstance.json as { surveyInstanceId: string }).surveyInstanceId;
  const idempotencyKey = `processing-key-${suffix}`;

  const submit = await api(`/surveys/${instanceId}/submit`, {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      answers: {
        attestation: true,
        attested: true,
        comment: "Urgent ICWA concern. Legal escalation needed.",
      },
    }),
  });
  assert.equal(submit.status, 201);
  const submissionId = (submit.json as { submissionId: string }).submissionId;
  assert.ok(submissionId);

  const submitDup = await api(`/surveys/${instanceId}/submit`, {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      answers: {
        attestation: true,
        attested: true,
        comment: "retry body should return same submission by key",
      },
    }),
  });
  assert.equal(submitDup.status, 200);
  assert.equal((submitDup.json as { submissionId: string }).submissionId, submissionId);

  const aiResult = await api(`/submissions/${submissionId}/ai-result`, {
    headers: { "x-demo-user": username },
  });
  assert.equal(aiResult.status, 200);
  const ai = aiResult.json as { recommendedRoute: string; confidence?: number };
  assert.ok(ai.recommendedRoute === "legal_policy_queue" || ai.recommendedRoute === "supervisor_queue");
  assert.ok(typeof ai.confidence === "number" || ai.confidence === undefined);

  const queue = await api("/supervisor/queue", {
    headers: { "x-demo-user": username },
  });
  assert.equal(queue.status, 200);
  const items = (queue.json as { items: Array<{ submissionId: string }> }).items;
  assert.ok(items.some((i) => i.submissionId === submissionId));

  console.log("processing tests passed");
}

run().catch((error) => {
  console.error("processing tests failed:", error);
  process.exit(1);
});
