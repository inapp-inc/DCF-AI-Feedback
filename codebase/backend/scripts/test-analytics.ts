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

  const kpis = await api("/analytics/kpis", { headers: { "x-demo-user": username } });
  assert.equal(kpis.status, 200);
  assert.ok("totalSubmissions" in (kpis.json as Record<string, unknown>));

  const trends = await api("/analytics/trends", { headers: { "x-demo-user": username } });
  assert.equal(trends.status, 200);
  assert.ok(Array.isArray((trends.json as { points: unknown[] }).points));

  const anomalies = await api("/analytics/anomalies", { headers: { "x-demo-user": username } });
  assert.equal(anomalies.status, 200);
  assert.ok(Array.isArray((anomalies.json as { items: unknown[] }).items));

  const config = await api("/admin/config", { headers: { "x-demo-user": username } });
  assert.equal(config.status, 200);
  assert.ok("llmProvider" in (config.json as Record<string, unknown>));

  const configUpdate = await api("/admin/config", {
    method: "PUT",
    headers,
    body: JSON.stringify({ urgencyThreshold: 0.75 }),
  });
  assert.equal(configUpdate.status, 200);

  const exportJob = await api("/exports", {
    method: "POST",
    headers,
    body: JSON.stringify({ format: "csv" }),
  });
  assert.equal(exportJob.status, 202);
  const exportId = (exportJob.json as { exportId: string }).exportId;
  assert.ok(exportId);

  const exportStatus = await api(`/exports/${exportId}`, { headers: { "x-demo-user": username } });
  assert.equal(exportStatus.status, 200);

  const audit = await api("/audit/logs", { headers: { "x-demo-user": username } });
  assert.equal(audit.status, 200);
  assert.ok(Array.isArray((audit.json as { items: unknown[] }).items));

  const retention = await api("/compliance/retention/run", {
    method: "POST",
    headers: { "x-demo-user": username },
  });
  assert.equal(retention.status, 202);

  console.log("analytics tests passed");
}

run().catch((error) => {
  console.error("analytics tests failed:", error);
  process.exit(1);
});
