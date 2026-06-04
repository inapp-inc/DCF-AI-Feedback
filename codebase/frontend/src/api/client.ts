const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/v1";

export interface SessionInfo {
  userId: string;
  username: string;
  role: string;
  officeId: string;
  authenticated: boolean;
}

function headers(): HeadersInit {
  const username = sessionStorage.getItem("demo_username");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (username) h["x-demo-user"] = username;
  return h;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function login(username: string, password: string) {
  return api<SessionInfo & { sessionId: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return api<void>("/auth/logout", { method: "POST" });
}

export function getSession() {
  return api<SessionInfo>("/auth/session");
}

export function sendSurvey(instanceId: string) {
  return api<{ customLink: string; status: string }>(`/forms/instances/${instanceId}/send`, {
    method: "POST",
  });
}

export function createFormInstance(input: {
  templateId: string;
  userGroup: string;
  triggerRef?: string;
}) {
  return api<{ surveyInstanceId: string }>(`/forms/instances`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function submitSurvey(instanceId: string, answers: Record<string, unknown>) {
  return api<{ submissionId: string; aiProcessingStatus: string }>(`/surveys/${instanceId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export function getAiResult(submissionId: string) {
  return api<{
    topic: string;
    sentimentScore: number;
    urgency: string;
    explainabilitySummary: string;
    recommendedRoute: string;
    confidence?: number;
    latencyMs?: number;
    fallbackUsed?: boolean;
    model?: string;
    errorMessage?: string;
  }>(`/submissions/${submissionId}/ai-result`);
}

export type FormQuestion = {
  id: string;
  type: "likert" | "text" | "dropdown" | "multi_select" | "attestation";
  label: string;
  description?: string;
  required?: boolean;
  options?: string[];
};

export type FormTemplate = {
  templateId: string;
  name: string;
  userGroup: "mandated_reporter" | "volunteer" | "attorney" | "foster_parent";
  version: number;
  questions: FormQuestion[];
  nextStepsLabel?: string;
};

export type FormInstance = {
  surveyInstanceId: string;
  templateId: string;
  templateName: string;
  userGroup: string;
  triggerRef?: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  customLink?: string;
  submissionCount: number;
};

export function listTemplates(userGroup?: string) {
  const q = userGroup ? `?userGroup=${userGroup}` : "";
  return api<{ items: FormTemplate[] }>(`/forms/templates${q}`);
}

export function updateTemplate(
  templateId: string,
  payload: {
    name: string;
    userGroup: FormTemplate["userGroup"];
    version?: number;
    questions: FormQuestion[];
    nextStepsLabel?: string;
  },
) {
  return api<FormTemplate>(`/forms/templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function listFormInstances(filters?: { templateId?: string; status?: string; userGroup?: string }) {
  const params = new URLSearchParams();
  if (filters?.templateId) params.set("templateId", filters.templateId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.userGroup) params.set("userGroup", filters.userGroup);
  const q = params.toString();
  return api<{ items: FormInstance[] }>(`/forms/instances${q ? `?${q}` : ""}`);
}

export function deleteFormInstance(instanceId: string) {
  return api<void>(`/forms/instances/${instanceId}`, { method: "DELETE" });
}

export function getAnalyticsKpis() {
  return api<Record<string, unknown>>("/analytics/kpis").catch(() => ({
    totalSubmissions: 0,
    responseRate: 0,
  }));
}

export function getAnalyticsTrends() {
  return api<{ points: Array<{ bucket: string; submissions: number; avgScore: number }> }>(
    "/analytics/trends",
  );
}

export function getAnalyticsAnomalies() {
  return api<{ items: Array<{ signalId: string; severity: string; summary: string }> }>(
    "/analytics/anomalies",
  );
}

export type QueueItem = {
  queueItemId: string;
  submissionId: string;
  userGroup: string;
  officeId?: string;
  status: string;
  priority: string;
  reason: string;
  assignee?: string;
  createdAt?: string;
};

export function getQueue(filters?: { status?: string; userGroup?: string; officeId?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.userGroup) params.set("userGroup", filters.userGroup);
  if (filters?.officeId) params.set("officeId", filters.officeId);
  const q = params.toString();
  return api<{ items: QueueItem[] }>(`/supervisor/queue${q ? `?${q}` : ""}`);
}

export function assignQueue(queueItemId: string, assignee: string) {
  return api<{ ok: boolean }>(`/supervisor/queue/${queueItemId}/assign`, {
    method: "POST",
    body: JSON.stringify({ assignee }),
  });
}

export function updateQueueStatus(queueItemId: string, status: "open" | "in_review" | "resolved") {
  return api<{ ok: boolean }>(`/supervisor/queue/${queueItemId}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function getAdminConfig() {
  return api<Record<string, unknown>>("/admin/config");
}

export function updateAdminConfig(payload: Record<string, unknown>) {
  return api<{ ok: boolean }>("/admin/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createTemplate(payload: {
  name: string;
  userGroup: "mandated_reporter" | "volunteer" | "attorney" | "foster_parent";
  questions: Array<{ id: string; type: "text" | "likert" | "dropdown" | "multi_select" | "attestation"; label: string }>;
}) {
  return api<FormTemplate>("/forms/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestExport(format: "csv" | "pdf") {
  return api<{ exportId: string; status: string; downloadUrl: string }>("/exports", {
    method: "POST",
    body: JSON.stringify({ format }),
  });
}

export function getAuditLogs() {
  return api<{ items: Array<{ timestamp: string; action: string; actor: string; details: Record<string, unknown> }> }>(
    "/audit/logs",
  );
}

export function getAiOpsHealth() {
  return api<{
    provider: string;
    status: "up" | "degraded" | "down";
    model: string;
    checkedAt: string;
    message?: string;
    fallbackCount: number;
    averageLatencyMs: number;
  }>("/ai/ops/health");
}

export type SurveyQuestion = {
  id: string;
  type: string;
  label: string;
  description?: string;
  required?: boolean;
  options?: string[];
};

export function getPublicSurvey(token: string, search = "") {
  const qs = search.startsWith("?") ? search : search ? `?${search}` : "";
  return fetch(`${API_BASE}/public/surveys/${token}${qs}`).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error((data as { message?: string }).message ?? "Survey unavailable");
    return data as {
      valid: boolean;
      surveyInstanceId?: string;
      templateName?: string;
      userGroup?: string;
      triggerRef?: string;
      linkContext?: { ref?: string; role?: string; dispatchedAt?: string | null };
      prefillAnswers?: Record<string, string>;
      questions?: SurveyQuestion[];
      nextStepsLabel?: string;
    };
  });
}

export function submitPublicSurvey(
  token: string,
  body: { answers: Record<string, unknown>; aiOptOut?: boolean; demoDemographic?: string },
) {
  return fetch(`${API_BASE}/public/surveys/${token}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error((data as { message?: string }).message ?? "Submit failed");
    return data as { submissionId: string; acknowledgementText?: string };
  });
}

export function getPortalSurveys(userGroup: string) {
  return fetch(`${API_BASE}/public/portal/surveys?userGroup=${encodeURIComponent(userGroup)}`).then((r) =>
    r.json(),
  ) as Promise<{
    items: Array<{
      customLink?: string;
      triggerRef?: string;
      jobStatus?: string;
      status?: string;
      statusLabel?: string;
      createdAt?: string;
    }>;
  }>;
}

export function getAnalyticsKpisFiltered(params?: Record<string, string>) {
  const q = params ? `?${new URLSearchParams(params)}` : "";
  return api<Record<string, unknown>>(`/analytics/kpis${q}`);
}

export type AnalyticsInsightsResult = {
  insightsId: string;
  generatedAt: string;
  submissionCount: number;
  observations: string[];
  concerns: string[];
  trends: string[];
  dataGroundingNote: string;
  fallbackUsed: boolean;
  model: string;
  factsSummary: {
    totalSubmissions: number;
    avgSentiment: number;
    highUrgencyCount: number;
    topTopics: Array<{ topic: string; count: number }>;
  };
};

/** Manually trigger grounded AI insights from stored feedback (admin dashboard). */
export function generateAnalyticsInsights(filters?: Record<string, string>) {
  return api<AnalyticsInsightsResult>("/analytics/insights/generate", {
    method: "POST",
    body: JSON.stringify(filters ?? {}),
  });
}

export function getAnalyticsCompletion(userGroup?: string) {
  const q = userGroup ? `?userGroup=${userGroup}` : "";
  return api<{ items: Array<Record<string, unknown>> }>(`/analytics/completion${q}`);
}

export function getAnalyticsEquity() {
  return api<{ items: Array<Record<string, unknown>> }>("/analytics/equity");
}

export function getNotificationLog() {
  return api<{ items: Array<Record<string, unknown>> }>("/notifications/log");
}

export function generateReport(reportType: "weekly_brief" | "monthly_division" | "quarterly_cfsr") {
  return api<{ reportId: string; bodyPreview: string }>("/reports/generate", {
    method: "POST",
    body: JSON.stringify({ reportType }),
  });
}

export function listReports() {
  return api<{ items: Array<Record<string, unknown>> }>("/reports");
}

export function getTriggerJobs() {
  return api<{ items: Array<Record<string, unknown>> }>("/triggers/jobs");
}

// ── Approval workflow ────────────────────────────────────────────────────────

export type ApprovalHistoryEntry = {
  action: string;
  reviewerRole: string;
  reviewerUsername: string;
  note: string | null;
  createdAt: string;
};

export type ApprovalItem = {
  submissionId: string;
  formInstanceId: string;
  userGroup: string;
  approvalStatus: string;
  submittedAt: string;
  officeId?: string;
  demoDemographic?: string;
  sentimentScore?: number | null;
  urgency?: string;
  topic?: string;
  privilegeTagged?: boolean;
  recommendedRoute?: string;
  explainabilitySummary?: string;
  approvalHistory: ApprovalHistoryEntry[];
};

export type SubmissionHistoryItem = {
  submissionId: string;
  userGroup: string;
  approvalStatus: string;
  submittedAt: string;
  officeId?: string;
  topic?: string;
  sentimentScore: number | null;
  urgency?: string;
  explainabilitySummary?: string;
  approvalHistory: ApprovalHistoryEntry[];
};

export type SubmissionDetail = ApprovalItem & {
  answers: Record<string, unknown>;
  questions: FormQuestion[];
  formName: string;
};

export function getSubmissionDetail(submissionId: string) {
  return api<SubmissionDetail>(`/approval/submissions/${submissionId}/detail`);
}

export function overrideUrgency(submissionId: string, urgency: "low" | "medium" | "high") {
  return api<{ ok: boolean; urgency: string }>(
    `/approval/submissions/${submissionId}/urgency`,
    { method: "PATCH", body: JSON.stringify({ urgency }) },
  );
}

export function listPendingLegal() {
  return api<{ items: ApprovalItem[] }>("/approval/submissions/pending-legal");
}

export function listPendingSupervisor() {
  return api<{ items: ApprovalItem[] }>("/approval/submissions/pending-supervisor");
}

export function flagForLegal(submissionId: string, note?: string) {
  return api<{ ok: boolean; newStatus: string }>(
    `/approval/submissions/${submissionId}/flag-legal`,
    { method: "POST", body: JSON.stringify({ note }) },
  );
}

export function legalApprove(submissionId: string, note?: string) {
  return api<{ ok: boolean; newStatus: string }>(
    `/approval/submissions/${submissionId}/legal-approve`,
    { method: "POST", body: JSON.stringify({ note }) },
  );
}

export function listSubmissionsHistory(params?: { userGroup?: string; status?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.userGroup) q.set("userGroup", params.userGroup);
  if (params?.status)    q.set("status",    params.status);
  if (params?.limit)     q.set("limit",     String(params.limit));
  const qs = q.toString();
  return api<{ items: SubmissionHistoryItem[] }>(`/analytics/submissions-history${qs ? `?${qs}` : ""}`);
}

export function legalReject(submissionId: string, note?: string) {
  return api<{ ok: boolean; newStatus: string }>(
    `/approval/submissions/${submissionId}/legal-reject`,
    { method: "POST", body: JSON.stringify({ note }) },
  );
}

export function supervisorApprove(submissionId: string, note?: string) {
  return api<{ ok: boolean; newStatus: string }>(
    `/approval/submissions/${submissionId}/supervisor-approve`,
    { method: "POST", body: JSON.stringify({ note }) },
  );
}

export function supervisorReject(submissionId: string, note?: string) {
  return api<{ ok: boolean; newStatus: string }>(
    `/approval/submissions/${submissionId}/supervisor-reject`,
    { method: "POST", body: JSON.stringify({ note }) },
  );
}

export type ChatSuggestion = {
  value: unknown;
  label: string;
  description: string;
  /** Sub-factor bullet points that help the user gauge which option fits */
  details?: string[];
};

export type ChatReply = {
  reply: string;
  suggestions?: ChatSuggestion[];
  fallback: boolean;
};

export function getSurveyChatWelcome(token: string) {
  return fetch(`${(import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/v1"}/public/surveys/${token}/chat/welcome`).then(
    async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error((d as { message?: string }).message ?? "Failed");
      return d as ChatReply;
    },
  );
}

export function sendSurveyChat(
  token: string,
  body: {
    mode: "general" | "question_help";
    message?: string;
    questionId?: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  },
) {
  return fetch(
    `${(import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/v1"}/public/surveys/${token}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  ).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error((d as { message?: string }).message ?? "Failed");
    return d as ChatReply;
  });
}
