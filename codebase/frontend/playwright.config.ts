import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: [
    {
      command: "npm run build && npm run start",
      cwd: "../backend",
      url: "http://127.0.0.1:8080/v1/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run preview -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
