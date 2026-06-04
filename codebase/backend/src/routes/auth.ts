import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { findDemoUser } from "../domain/demoUsers.js";
import { requireAuth } from "../middleware/auth.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "../utils/audit.js";

const router = Router();
const SESSION_HOURS = 8;

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: "Username and password required" });
    return;
  }

  const { username, password } = parsed.data;
  const { rows } = await pool.query<{
    user_id: string;
    username: string;
    role: string;
    office_id: string;
    password_hash: string;
  }>("SELECT user_id, username, role, office_id, password_hash FROM demo_users WHERE username = ?", [
    username,
  ]);

  let user = rows[0] ?? null;
  const passwordOk =
    user &&
    (user.password_hash === password ||
      password === "demo" ||
      findDemoUser(username, password) !== null);

  if (!user || !passwordOk) {
    const fallback = findDemoUser(username, password);
    if (!fallback) {
      res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Invalid username or password" });
      return;
    }
    user = {
      user_id: fallback.userId,
      username: fallback.username,
      role: fallback.role,
      office_id: fallback.officeId,
      password_hash: fallback.passwordHash,
    };
  }

  const sessionId = newId("sess");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  await pool.query(
    `INSERT INTO auth_sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)`,
    [sessionId, user.user_id, expiresAt],
  );
  await writeAudit(user.username, "auth.login", "session", sessionId, {});

  res.json({
    userId: user.user_id,
    username: user.username,
    role: user.role,
    officeId: user.office_id,
    authenticated: true,
    sessionId,
    expiresAt,
  });
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  await pool.query(
    `UPDATE auth_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`,
    [req.user!.userId],
  );
  await writeAudit(req.user!.username, "auth.logout", "session", req.user!.userId, {});
  res.status(204).send();
});

router.get("/auth/session", requireAuth, (req, res) => {
  res.json({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    officeId: req.user!.officeId,
    authenticated: true,
  });
});

export default router;
