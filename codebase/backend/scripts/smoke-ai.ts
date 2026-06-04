/* eslint-disable no-console */
const base = process.env.API_BASE ?? "http://localhost:8080/v1";

async function run() {
  const login = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin_demo", password: "demo" }),
  }).then((r) => r.json());
  const username = login.username as string;

  const commonHeaders = {
    "Content-Type": "application/json",
    "x-demo-user": username,
  };

  const instance = await fetch(`${base}/forms/instances`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      templateId: "tpl_att_v1",
      userGroup: "attorney",
      triggerRef: "LEGAL-DEMO",
    }),
  }).then((r) => r.json());

  const submitted = await fetch(`${base}/surveys/${instance.surveyInstanceId}/submit`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      answers: { comment: "ICWA compliance concern, urgent legal review needed." },
    }),
  }).then((r) => r.json());

  const ai = await fetch(`${base}/submissions/${submitted.submissionId}/ai-result`, {
    headers: { "x-demo-user": username },
  }).then((r) => r.json());

  const queue = await fetch(`${base}/supervisor/queue`, {
    headers: { "x-demo-user": username },
  }).then((r) => r.json());

  const health = await fetch(`${base}/ai/health`).then((r) => r.json());

  console.log("AI smoke summary:", {
    submissionId: submitted.submissionId,
    route: ai.recommendedRoute,
    urgency: ai.urgency,
    fallbackUsed: ai.fallbackUsed,
    queueItems: queue.items?.length ?? 0,
    health: health.status,
  });
}

run().catch((error) => {
  console.error("AI smoke failed:", error);
  process.exit(1);
});
