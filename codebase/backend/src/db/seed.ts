import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execMigration, pool } from "./pool.js";
import { runMigrations } from "./migrate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, "../../db/seeds/seed_demo.sql");
const templateSchemasPath = join(__dirname, "../../db/seeds/template_schemas.json");

async function applyTemplateSchemas() {
  const schemas = JSON.parse(readFileSync(templateSchemasPath, "utf8")) as Record<
    string,
    { nextStepsLabel?: string; questions: unknown[] }
  >;
  for (const [templateId, schema] of Object.entries(schemas)) {
    await pool.query(`UPDATE form_templates SET schema_json = ? WHERE template_id = ?`, [
      JSON.stringify(schema),
      templateId,
    ]);
  }
}

async function runSeed() {
  await runMigrations();
  const sql = readFileSync(seedPath, "utf8");
  execMigration(sql);
  await applyTemplateSchemas();
  console.log("Seed data applied");
}

runSeed()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
