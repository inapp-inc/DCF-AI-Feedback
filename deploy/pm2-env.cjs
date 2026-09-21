"use strict";

const fs = require("fs");
const path = require("path");

const APP_NAME = "dcf-feedback-api";
const DEFAULT_PORT = "14020";
const DEFAULT_BASE = "/feedback";

function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function normalizeBasePath(value, fallback) {
  const raw = String(value || fallback || "").trim();
  if (!raw || raw === "/") return "";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.replace(/\/+$/, "") || withLeading;
}

function toSqliteUrl(fsPath) {
  const normalized = fsPath.replace(/\\/g, "/");
  return `sqlite://${normalized}`;
}

function applyBareMetalDefaults(root, raw = {}) {
  const env = { ...raw };
  const hostPort = String(env.HOST_PORT || env.PORT || DEFAULT_PORT);
  env.NODE_ENV = env.NODE_ENV || "production";
  env.TRUST_PROXY = env.TRUST_PROXY || "1";
  env.HOST = env.HOST || "127.0.0.1";
  env.HOST_PORT = hostPort;
  env.PORT = hostPort;
  env.APP_BASE_PATH = normalizeBasePath(env.APP_BASE_PATH, DEFAULT_BASE);
  env.PUBLIC_SURVEY_BASE_URL =
    env.PUBLIC_SURVEY_BASE_URL || `${env.APP_BASE_PATH}/survey`;
  env.CORS_ORIGIN = env.CORS_ORIGIN || "*";

  const dataDir = path.join(root, "data");
  const frontendDist = path.join(root, "codebase", "frontend", "dist");
  const dbFile = path.join(dataDir, "feedback.db");
  if (!env.DATABASE_URL || env.DATABASE_URL.includes("/app/") || env.DATABASE_URL === "sqlite://./data/feedback.db") {
    env.DATABASE_URL = toSqliteUrl(dbFile);
  }
  env.STATIC_DIR = env.STATIC_DIR || frontendDist;
  return env;
}

function loadRawEnv({ root, env, envFile } = {}) {
  if (env) return { ...env };
  const file = envFile || path.join(root, "deploy", ".env");
  if (!fs.existsSync(file)) {
    throw new Error(`missing ${file} — copy deploy/.env.example`);
  }
  return parseEnvFile(file);
}

function buildPm2Apps(options = {}) {
  const root = options.root || path.resolve(__dirname, "..");
  const logDir = options.logDir || path.join(root, "logs");
  const backendDir = path.join(root, "codebase", "backend");
  const env = applyBareMetalDefaults(root, loadRawEnv({ root, env: options.env, envFile: options.envFile }));
  if (options.ensureDirs !== false) {
    fs.mkdirSync(logDir, { recursive: true });
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
  }

  return {
    apps: [
      {
        name: APP_NAME,
        cwd: backendDir,
        script: path.join(backendDir, "dist", "index.js"),
        interpreter: "node",
        instances: 1,
        exec_mode: "fork",
        watch: false,
        autorestart: true,
        max_memory_restart: "512M",
        kill_timeout: 5000,
        exp_backoff_restart_delay: 200,
        time: true,
        merge_logs: true,
        error_file: path.join(logDir, `${APP_NAME}-error.log`),
        out_file: path.join(logDir, `${APP_NAME}-out.log`),
        env,
      },
    ],
  };
}

module.exports = {
  APP_NAME,
  parseEnvFile,
  applyBareMetalDefaults,
  buildPm2Apps,
};
