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

  const inst = await api("/forms/instances", {
    method: "POST",
    headers,
    body: JSON.stringify({ templateId: "tpl_att_v1", userGroup: "attorney", triggerRef: "attest-test" }),
  });
  assert.equal(inst.status, 201);
  const instanceId = (inst.json as { surveyInstanceId: string }).surveyInstanceId;

  const bad = await api(`/surveys/${instanceId}/submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ answers: { attestation: false, comment: "missing attestation" } }),
  });
  assert.equal(bad.status, 400);

  const good = await api(`/surveys/${instanceId}/submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ answers: { attestation: true, attested: true, comment: "signed" } }),
  });
  assert.equal(good.status, 201);

  console.log("attestation tests passed");
}

run().catch((error) => {
  console.error("attestation tests failed:", error);
  process.exit(1);
});
