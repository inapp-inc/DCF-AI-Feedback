import { createApp } from "./app.js";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/pool.js";
import { startBackgroundJobs } from "./services/triggerScheduler.js";

async function main() {
  await runMigrations();
  const app = createApp();
  startBackgroundJobs();
  app.listen(config.port, () => {
    console.log(`Feedback Analytics Solution API listening on http://localhost:${config.port}`);
    console.log(`CORS origin: ${config.corsOrigin}`);
  });
}

main().catch((err) => {
  console.error(err);
  pool.end();
  process.exit(1);
});
