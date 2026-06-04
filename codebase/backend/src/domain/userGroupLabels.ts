export type UserGroupId = "mandated_reporter" | "volunteer" | "attorney" | "foster_parent";

const USER_GROUP_LABELS: Record<UserGroupId, string> = {
  mandated_reporter: "Mandated Reporter",
  volunteer: "Volunteer",
  attorney: "Attorney",
  foster_parent: "Foster Parent",
};

function titleCaseFromSnake(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatUserGroupLabel(value: string): string {
  if (value in USER_GROUP_LABELS) {
    return USER_GROUP_LABELS[value as UserGroupId];
  }
  return titleCaseFromSnake(value);
}
