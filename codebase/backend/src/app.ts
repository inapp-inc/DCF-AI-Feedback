import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

  /** Staff workflow: forms, triggers, survey dispatch and staff submissions */
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
  if (config.appBasePath) {
    app.use(`${config.appBasePath}/v1`, api);
  }

  if (config.staticDir && existsSync(config.staticDir)) {
    const mount = config.appBasePath || "";
    const staticMount = mount || "/";
    app.use(staticMount, express.static(config.staticDir, { index: "index.html" }));
    const spaHandler: express.RequestHandler = (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      if (req.path.includes("/v1/") || req.path.endsWith("/v1")) {
        next();
        return;
      }
      res.sendFile(join(config.staticDir, "index.html"), (err) => {
        if (err) next(err);
      });
    };
    if (mount) {
      app.get(mount, spaHandler);
      app.get(`${mount}/*`, spaHandler);
    } else {
      app.get("/*", spaHandler);
    }
  }

  app.use(errorHandler);
  return app;
}
