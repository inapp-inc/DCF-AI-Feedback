export type StaffPlatform = "ifamilynet" | "admin";

export const SESSION_KEYS = {
  username: "demo_username",
  role: "demo_role",
  platform: "demo_platform",
} as const;

export function isStaffPlatform(value: string | undefined): value is StaffPlatform {
  return value === "ifamilynet" || value === "admin";
}

export function getLoggedInPlatform(): StaffPlatform | null {
  const p = sessionStorage.getItem(SESSION_KEYS.platform);
  return isStaffPlatform(p ?? undefined) ? (p as StaffPlatform) : null;
}

export function clearStaffSession() {
  sessionStorage.removeItem(SESSION_KEYS.username);
  sessionStorage.removeItem(SESSION_KEYS.role);
  sessionStorage.removeItem(SESSION_KEYS.platform);
}

export function staffHomePath(platform: StaffPlatform): string {
  return platform === "admin" ? "/admin" : "/ifamilynet";
}

export function loginPath(platform: StaffPlatform): string {
  return `/login/${platform}`;
}
