import type { RequestHandler } from "express";
import { pool } from "../db/pool.js";
import { findDemoUserByUsername } from "../domain/demoUsers.js";
import type { DemoRole } from "../domain/demoUsers.js";

export interface AuthUser {
  userId: string;
  username: string;
  role: DemoRole;
  officeId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const username = req.header("x-demo-user");
  if (!username) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Missing x-demo-user header" });
    return;
  }

  const { rows } = await pool.query<{
    user_id: string;
    username: string;
    role: DemoRole;
    office_id: string;
    expires_at: string;
    revoked_at: string | null;
  }>(
    `SELECT u.user_id, u.username, u.role, u.office_id, s.expires_at, s.revoked_at
     FROM demo_users u
     LEFT JOIN auth_sessions s ON s.user_id = u.user_id AND s.revoked_at IS NULL
     WHERE u.username = ?
     ORDER BY s.created_at DESC LIMIT 1`,
    [username],
  );

  let user: AuthUser | null = null;
  if (rows.length > 0) {
    const row = rows[0];
    if (!row.revoked_at && new Date(row.expires_at) > new Date()) {
      user = {
        userId: row.user_id,
        username: row.username,
        role: row.role,
        officeId: row.office_id,
      };
    }
  }

  if (!user) {
    const fallback = findDemoUserByUsername(username);
    if (fallback) {
      user = {
        userId: fallback.userId,
        username: fallback.username,
        role: fallback.role,
        officeId: fallback.officeId,
      };
    }
  }

  if (!user) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid session" });
    return;
  }
  req.user = user;
  next();
};

export function requireRoles(...roles: DemoRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ code: "FORBIDDEN", message: "Insufficient role" });
      return;
    }
    next();
  };
}
