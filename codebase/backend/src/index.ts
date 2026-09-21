import { createApp } from "./app.js";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/pool.js";
import { startBackgroundJobs } from "./services/triggerScheduler.js";

async function main() {
  await runMigrations();
  const app = createApp();
  startBackgroundJobs();
  const base = config.appBasePath || "";
  app.listen(config.port, config.host, () => {
    console.log(
      `Feedback Analytics Solution API listening on http://${config.host}:${config.port}${base}/`,
    );
    console.log(`Health: http://${config.host}:${config.port}${base}/v1/health`);
    console.log(`CORS origin: ${config.corsOrigin}`);
  });
}

main().catch((err) => {
  console.error(err);
  pool.end();
  process.exit(1);
});
