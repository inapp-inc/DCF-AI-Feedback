import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";

function resolveDbPath(url: string): string {
  if (url.startsWith("sqlite:")) {
    const path = url.replace(/^sqlite:\/\//, "").replace(/^sqlite:/, "");
    return path.startsWith("//") ? path.slice(1) : path;
  }
  return url;
}

const dbPath = resolveDbPath(config.databaseUrl);
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function getDatabase(): Database.Database {
  return db;
}

export function execMigration(sql: string): void {
  db.exec(sql);
}

export function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): { rows: T[] } {
  const args = (params ?? []) as (string | number | null)[];
  const stmt = db.prepare(text);
  const head = text.trimStart().slice(0, 12).toUpperCase();
  const returnsRows =
    head.startsWith("SELECT") ||
    head.startsWith("WITH") ||
    text.toUpperCase().includes(" RETURNING ");

  if (returnsRows) {
    return { rows: stmt.all(...args) as T[] };
  }
  stmt.run(...args);
  return { rows: [] as T[] };
}

export const pool = {
  query,
  async end() {
    db.close();
  },
};
