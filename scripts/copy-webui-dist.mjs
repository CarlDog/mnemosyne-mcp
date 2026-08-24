#!/usr/bin/env node
// Copies webui/dist (Vite's build output) into dist/webui, so the
// compiled server (dist/index.js) can serve it as a static SPA -- see
// src/index.ts's HTTP-mode branch. Node's built-in fs.cpSync, no new
// dependency.

import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "webui", "dist");
const dest = join(here, "..", "dist", "webui");

if (!existsSync(src)) {
  console.error(
    `webui build output not found at ${src} -- run "npm run build:webui" first.`,
  );
  process.exit(1);
}

cpSync(src, dest, { recursive: true });
console.log(`copied ${src} -> ${dest}`);
