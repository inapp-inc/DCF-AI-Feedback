/** Backend user_group / role identifiers → human-readable labels for UI only. */

export type UserGroupId = "mandated_reporter" | "volunteer" | "attorney" | "foster_parent";

export const USER_GROUP_LABELS: Record<UserGroupId, string> = {
  mandated_reporter: "Mandated Reporter",
  volunteer: "Volunteer",
  attorney: "Attorney",
  foster_parent: "Foster Parent",
};

export const USER_GROUP_FILTER_OPTIONS: Array<{ id: "" | UserGroupId; label: string }> = [
  { id: "", label: "All groups" },
  { id: "mandated_reporter", label: USER_GROUP_LABELS.mandated_reporter },
  { id: "volunteer", label: USER_GROUP_LABELS.volunteer },
  { id: "attorney", label: USER_GROUP_LABELS.attorney },
  { id: "foster_parent", label: USER_GROUP_LABELS.foster_parent },
];

const QUEUE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_review: "In review",
  resolved: "Resolved",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly_brief: "Weekly brief",
  monthly_division: "Monthly division",
  quarterly_cfsr: "Quarterly CFSR",
};

const TRIGGER_JOB_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  fired: "Sent",
  completed: "Completed",
  pending: "Pending",
};

function titleCaseFromSnake(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function isUserGroupId(value: string): value is UserGroupId {
  return value in USER_GROUP_LABELS;
}

export function formatUserGroup(value: string | null | undefined): string {
  if (!value) return "";
  if (isUserGroupId(value)) return USER_GROUP_LABELS[value];
  return titleCaseFromSnake(value);
}

export function formatQueueStatus(value: string | null | undefined): string {
  if (!value) return "";
  return QUEUE_STATUS_LABELS[value] ?? titleCaseFromSnake(value);
}

export function formatReportType(value: string | null | undefined): string {
  if (!value) return "";
  return REPORT_TYPE_LABELS[value] ?? titleCaseFromSnake(value);
}

export function formatTriggerJobStatus(value: string | null | undefined): string {
  if (!value) return "";
  return TRIGGER_JOB_STATUS_LABELS[value] ?? titleCaseFromSnake(value);
}

/** Replace known backend enum tokens in free-text (e.g. AI insight bullets). */
export function humanizeUserFacingText(text: string): string {
  let out = text;
  for (const [id, label] of Object.entries(USER_GROUP_LABELS)) {
    out = out.replaceAll(id, label);
  }
  for (const [id, label] of Object.entries(QUEUE_STATUS_LABELS)) {
    out = out.replaceAll(id, label);
  }
  for (const [id, label] of Object.entries(REPORT_TYPE_LABELS)) {
    out = out.replaceAll(id, label);
  }
  return out;
}
