import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// MNEMO_WEBUI_API_PROXY overrides where /api requests are forwarded during
// `npm run dev` -- documented here and in .env.example, deliberately NOT
// in the root project's .env.example (this file runs outside src/, so
// tests/env-schema.test.ts's process.env. scan never sees it -- see that
// test's own header comment for why it only scans src/**/*.ts).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.MNEMO_WEBUI_API_PROXY ?? "http://127.0.0.1:3010",
        changeOrigin: true,
      },
    },
  },
});
