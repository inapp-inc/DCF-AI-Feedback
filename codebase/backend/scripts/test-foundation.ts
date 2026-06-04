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
  assert.ok(username);

  const headers = { "Content-Type": "application/json", "x-demo-user": username };

  const createTpl = await api("/forms/templates", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Test Template Foundation",
      userGroup: "volunteer",
      questions: [{ id: "q1", type: "text", label: "Question 1" }],
    }),
  });
  assert.equal(createTpl.status, 201);
  const templateId = (createTpl.json as { templateId: string }).templateId;
  assert.ok(templateId);

  const eventId = `evt-foundation-${Date.now()}`;
  const trigger1 = await api("/triggers/events", {
    method: "POST",
    headers,
    body: JSON.stringify({
      eventId,
      triggerType: "fifty_one_a",
      userGroup: "mandated_reporter",
      occurredAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    }),
  });
  assert.equal(trigger1.status, 202);
  const t1 = trigger1.json as { orchestrationStatus: string };
  assert.equal(t1.orchestrationStatus, "accepted");

  const trigger2 = await api("/triggers/events", {
    method: "POST",
    headers,
    body: JSON.stringify({
      eventId,
      triggerType: "fifty_one_a",
      userGroup: "mandated_reporter",
      occurredAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    }),
  });
  assert.equal(trigger2.status, 202);
  const t2 = trigger2.json as { orchestrationStatus: string };
  assert.equal(t2.orchestrationStatus, "duplicate_ignored");

  const createInstance = await api("/forms/instances", {
    method: "POST",
    headers,
    body: JSON.stringify({
      templateId,
      userGroup: "volunteer",
      triggerRef: "foundation-ref",
    }),
  });
  assert.equal(createInstance.status, 201);
  const instanceId = (createInstance.json as { surveyInstanceId: string }).surveyInstanceId;

  const send = await api(`/forms/instances/${instanceId}/send`, {
    method: "POST",
    headers: { "x-demo-user": username },
  });
  assert.equal(send.status, 200);
  const customLink = (send.json as { customLink: string }).customLink;
  assert.ok(customLink.includes("/survey/") || customLink.includes("http"));
  const token = customLink.split("/").pop()!;

  const validate = await api(`/forms/tokens/${token}/validate`, {
    method: "POST",
    headers: { "x-demo-user": username },
  });
  assert.equal(validate.status, 200);
  assert.equal((validate.json as { valid: boolean }).valid, true);

  console.log("foundation tests passed");
}

run().catch((error) => {
  console.error("foundation tests failed:", error);
  process.exit(1);
});
