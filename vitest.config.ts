import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests hit a real OpenChronicle server (and Ollama for
    // continue tests). 5s is too tight for chained round trips; 30s is
    // generous enough for slow links without masking real bugs.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // All test files share one OpenChronicle. Running them in parallel
    // saturates OC's rate limiter (gatherContext alone makes 7 parallel
    // memory_search calls). Serialize across files; tests within a file
    // already run sequentially.
    fileParallelism: false,
    // webui/ is its own npm package (React/Vite, browser target) with no
    // test dependencies installed at root -- exclude it so a future
    // webui/src/*.test.tsx is never picked up by root `npm test`.
    exclude: ["webui/**", "node_modules/**"],
  },
});
