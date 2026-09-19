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
    // Private operator helpers may use other test runners. Their presence
    // must not change application test discovery in a local checkout.
    // .claude/ holds the worktrees a background task runs in, each a full
    // checkout with its own tests/. Without this, `npm test` in the main
    // tree silently runs another session's IN-PROGRESS tests alongside its
    // own and reports their failures as yours -- observed 2026-09-20 as 23
    // failures and a test count of 1655 against this tree's real 836.
    exclude: ["webui/**", "node_modules/**", "data/**", ".claude/**"],
  },
});
