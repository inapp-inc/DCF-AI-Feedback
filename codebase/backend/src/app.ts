import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/auth.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import formsRouter from "./routes/forms.js";
import triggersRouter from "./routes/triggers.js";
import submissionsRouter from "./routes/submissions.js";
import adminRouter from "./routes/admin.js";
import approvalRouter from "./routes/approval.js";
import publicRouter from "./routes/public.js";
import reportsRouter from "./routes/reports.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  const api = express.Router();
  api.use(healthRouter);
  api.use(authRouter);
  api.use(publicRouter);

  /** iFamilyNet staff: forms, triggers, survey dispatch and staff submissions */
  const staffApi = express.Router();
  staffApi.use(requireAuth);
  staffApi.use(formsRouter);
  staffApi.use(triggersRouter);
  staffApi.use(submissionsRouter);

  /** Feedback Analytics admin: operations, analytics, reports, approvals */
  const adminApi = express.Router();
  adminApi.use(requireAuth);
  adminApi.use(adminRouter);
  adminApi.use(approvalRouter);
  adminApi.use(reportsRouter);

  api.use(staffApi);
  api.use(adminApi);

  app.use("/v1", api);
  app.use(errorHandler);
  return app;
}
