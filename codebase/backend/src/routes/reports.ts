import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { newId } from "../utils/ids.js";
import { generateReportBody } from "../services/hfGenerativeService.js";
import { gatherAnalyticsFacts } from "../services/analyticsFactsService.js";
import { writeAudit } from "../utils/audit.js";

const router = Router();
router.use(requireAuth);
router.use(requireRoles("admin", "supervisor"));

const reportSchema = z.object({
  reportType: z.enum(["weekly_brief", "monthly_division", "quarterly_cfsr"]),
});

router.post("/reports/generate", async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "BAD_REQUEST", message: parsed.error.message });
    return;
  }
  const reportId = newId("rpt");
  await pool.query(
    `INSERT INTO generated_reports (report_id, report_type, status, title) VALUES (?, ?, 'queued', ?)`,
    [reportId, parsed.data.reportType, parsed.data.reportType.replace(/_/g, " ")],
  );

  const facts = await gatherAnalyticsFacts({});
  const context = JSON.stringify(
    {
      reportType: parsed.data.reportType,
      kpis: facts.kpis,
      byUserGroup: facts.byUserGroup,
      byTopic: facts.byTopic,
      trendPoints: facts.trendPoints,
      likertAverages: facts.likertAverages,
      anomalySignals: facts.anomalySignals,
      recentFeedbackCount: facts.recentFeedback.length,
    },
    null,
    0,
  );
  const body = await generateReportBody(parsed.data.reportType, context);

  await pool.query(
    `UPDATE generated_reports SET status = 'completed', body = ?, completed_at = datetime('now') WHERE report_id = ?`,
    [body, reportId],
  );
  await writeAudit(req.user!.username, "report.generate", "generated_report", reportId, {
    reportType: parsed.data.reportType,
  });
  res.status(202).json({ reportId, status: "completed", bodyPreview: body });
});

router.get("/reports", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT report_id, report_type, status, title, reviewed, created_at, completed_at,
            substr(body, 1, 400) as body_preview
     FROM generated_reports ORDER BY created_at DESC LIMIT 20`,
  );
  res.json({ items: rows });
});

router.get("/reports/:reportId", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM generated_reports WHERE report_id = ?", [
    req.params.reportId,
  ]);
  if (!rows.length) {
    res.status(404).json({ code: "NOT_FOUND" });
    return;
  }
  res.json(rows[0]);
});

router.post("/reports/:reportId/review", async (req, res) => {
  await pool.query(`UPDATE generated_reports SET reviewed = 1 WHERE report_id = ?`, [
    req.params.reportId,
  ]);
  res.json({ ok: true });
});

export default router;
