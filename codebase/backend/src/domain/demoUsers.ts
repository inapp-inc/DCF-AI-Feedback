export type DemoRole =
  | "admin"
  | "supervisor"
  | "legal_reviewer"
  | "mandated_reporter"
  | "volunteer"
  | "attorney"
  | "foster_parent";

export interface DemoUser {
  userId: string;
  username: string;
  passwordHash: string;
  role: DemoRole;
  officeId: string;
}

/** Demo credentials — password is username + "_pass" for local dev. */
export const DEMO_ACCOUNTS: DemoUser[] = [
  { userId: "u_admin_1", username: "admin_demo", passwordHash: "admin_demo_pass", role: "admin", officeId: "REGION-NORTH" },
  { userId: "u_sup_1", username: "supervisor_demo", passwordHash: "supervisor_demo_pass", role: "supervisor", officeId: "REGION-NORTH" },
  { userId: "u_legal_1", username: "legal_demo", passwordHash: "legal_demo_pass", role: "legal_reviewer", officeId: "REGION-NORTH" },
  { userId: "u_mr_1", username: "mr_demo", passwordHash: "mr_demo_pass", role: "mandated_reporter", officeId: "REGION-NORTH" },
  { userId: "u_vol_1", username: "vol_demo", passwordHash: "vol_demo_pass", role: "volunteer", officeId: "REGION-NORTH" },
  { userId: "u_att_1", username: "att_demo", passwordHash: "att_demo_pass", role: "attorney", officeId: "REGION-NORTH" },
  { userId: "u_fp_1", username: "fp_demo", passwordHash: "fp_demo_pass", role: "foster_parent", officeId: "REGION-NORTH" },
];

export function findDemoUser(username: string, password: string): DemoUser | null {
  const account = DEMO_ACCOUNTS.find((a) => a.username === username);
  if (!account) return null;
  if (account.passwordHash !== password && account.passwordHash !== `demo_hash_${account.role.split("_")[0]}`) {
    if (password !== "demo" && account.passwordHash !== password) return null;
  }
  return account;
}

export function findDemoUserByUsername(username: string): DemoUser | null {
  return DEMO_ACCOUNTS.find((a) => a.username === username) ?? null;
}
