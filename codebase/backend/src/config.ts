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

export const config = {
  port: parseInt(process.env.PORT ?? "8080", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "sqlite://./data/feedback.db",
  /** Comma-separated origins, "*" or "true" to reflect the request origin (recommended behind reverse proxy). */
  corsOrigin: resolveCorsOrigin(process.env.CORS_ORIGIN ?? "http://localhost:5173"),
  /**
   * Base path for survey links (relative or absolute).
   * Docker/production default: /dcffeedback/survey
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
      model: process.env.HF_MODEL ?? "Qwen/Qwen2.5-7B-Instruct",
      apiToken: process.env.HF_API_TOKEN ?? process.env.HUGGINGFACE_API_KEY ?? "",
    },
  },
};

export { buildSurveyLink, surveyLinkForToken } from "./utils/surveyLink.js";
export type { SurveyLinkContext } from "./utils/surveyLink.js";
