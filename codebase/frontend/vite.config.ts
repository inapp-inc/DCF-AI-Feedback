import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const base = process.env.VITE_BASE_PATH || "/";
const apiBase = (process.env.VITE_API_BASE_URL || "/v1").replace(/\/$/, "");
const apiProxyPrefix = apiBase.startsWith("/") ? apiBase : `/${apiBase}`;

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Local dev: match production path (e.g. /dcffeedback/v1) when VITE_API_BASE_URL is set.
      [apiProxyPrefix]: {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) =>
          apiProxyPrefix === "/v1" ? path : path.replace(apiProxyPrefix, "/v1"),
      },
    },
  },
});
