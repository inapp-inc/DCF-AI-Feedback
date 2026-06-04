import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execMigration, pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../../db/migrations");

async function ensureMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationTable();
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query("SELECT 1 AS ok FROM schema_migrations WHERE name = ?", [file]);
    if (rows.length > 0) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    execMigration(sql);
    await pool.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
    console.log(`Applied migration ${file}`);
  }
}

const isCli = process.argv[1]?.includes("migrate");
if (isCli) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
