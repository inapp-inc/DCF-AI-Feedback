/* eslint-disable no-console */
import assert from "node:assert/strict";

const base = process.env.API_BASE ?? "http://localhost:8080/v1";

async function run() {
  const login = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin_demo", password: "demo" }),
  });
  assert.equal(login.status, 200);
  const { username } = (await login.json()) as { username: string };
  const headers = { "Content-Type": "application/json", "x-demo-user": username };

  const gen = await fetch(`${base}/reports/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reportType: "weekly_brief" }),
  });
  assert.ok(gen.status === 200 || gen.status === 201 || gen.status === 202);
  const body = (await gen.json()) as { reportId?: string; bodyPreview?: string };
  assert.ok(body.reportId || body.bodyPreview);

  const list = await fetch(`${base}/reports`, { headers });
  assert.equal(list.status, 200);
  const items = (await list.json()) as { items: unknown[] };
  assert.ok(Array.isArray(items.items));

  console.log("smoke-reports passed");
}

run().catch((e) => {
  console.error("smoke-reports failed:", e);
  process.exit(1);
});
