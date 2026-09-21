import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function loadLocalEnv(): void {
  const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  for (const filePath of [resolve(process.cwd(), ".env"), resolve(backendDir, ".env")]) {
    if (!existsSync(filePath)) continue;
    for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadLocalEnv();

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveCorsOrigin(raw: string): boolean | string | string[] {
  const trimmed = raw.trim();
  if (trimmed === "*" || trimmed === "true") {
    // Reflect request origin — required when credentials: true (cannot use literal "*").
    return true;
  }
  return trimmed.split(",").map((o) => o.trim()).filter(Boolean);
}

function normalizeAppBasePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, "");
}

export const config = {
  port: parseInt(process.env.PORT ?? process.env.HOST_PORT ?? "8080", 10),
  /** Loopback in production (nginx in front). Override with HOST=0.0.0.0 if needed. */
  host: process.env.HOST ?? "127.0.0.1",
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "sqlite://./data/feedback.db",
  /** URL prefix such as /feedback. Empty means the app is at domain root. */
  appBasePath: normalizeAppBasePath(process.env.APP_BASE_PATH ?? ""),
  /** Built SPA directory (frontend dist). Empty skips static hosting. */
  staticDir: (process.env.STATIC_DIR ?? "").trim(),
  /** Comma-separated origins, "*" or "true" to reflect the request origin (recommended behind reverse proxy). */
  corsOrigin: resolveCorsOrigin(process.env.CORS_ORIGIN ?? "http://localhost:5173"),
  /**
   * Base path for survey links (relative or absolute).
   * Docker/production default: /feedback/survey
   */
  publicSurveyBaseUrl: stripTrailingSlash(
    process.env.PUBLIC_SURVEY_BASE_URL ?? "http://localhost:5173/survey",
  ),
  /** When set, survey links are absolute (origin + publicSurveyBaseUrl). Leave empty for path-only links. */
  publicOrigin: stripTrailingSlash(process.env.PUBLIC_ORIGIN ?? ""),
  llm: {
    provider: (process.env.LLM_PROVIDER ?? "huggingface") as "huggingface",
    requestTimeoutMs: parseInt(process.env.LLM_REQUEST_TIMEOUT_MS ?? "600000", 10),
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES ?? "2", 10),
    retryBaseDelayMs: parseInt(process.env.LLM_RETRY_BASE_DELAY_MS ?? "1200", 10),
    huggingface: {
      apiBase: process.env.HF_API_BASE ?? "https://router.huggingface.co/v1",
      // Provider suffix pins Inference Providers routing (Together is currently down for this ID).
      model: process.env.HF_MODEL ?? "Qwen/Qwen2.5-7B-Instruct:featherless-ai",
      apiToken: process.env.HF_API_TOKEN ?? process.env.HUGGINGFACE_API_KEY ?? "",
    },
  },
};

export { buildSurveyLink, surveyLinkForToken } from "./utils/surveyLink.js";
export type { SurveyLinkContext } from "./utils/surveyLink.js";
