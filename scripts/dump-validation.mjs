// One-shot diagnostic: run the validator pass against arbitrary content
// for a given story id. Companion to dump-prompt.mjs. Lets you A/B
// validator prompts or models without going through Claude Desktop.
//
// Usage:
//   OC_URL=http://your-nas:18000/mcp \
//   OLLAMA_VALIDATOR_MODEL=phi4:14b \
//     node scripts/dump-validation.mjs <project_id> <content_file>
//
// `content_file` is a path to a text file containing the content to
// validate (supports multi-line / mixed punctuation / etc. without
// needing to escape it on the command line).

import { readFile } from "node:fs/promises";
import "./dist-preflight.mjs";

// dist/ imports are dynamic so the preflight above can report a missing
// build: a static import fails during ESM linking, before any code runs.
const { OcClient } = await import("../dist/oc-client.js");
const { OllamaProvider } = await import("../dist/llm.js");
const { gatherContext } = await import("../dist/prompt.js");
const { validateContent } = await import("../dist/validator.js");
// No --scene-context-strategy flag here (removed 2026-08-27): the
// validation context is gathered validationOnly, matching mnemo_validate
// -- the validator never reads scenes, so a strategy flag on this script
// could never change its output.
const args = process.argv.slice(2);
const [projectId, contentFile] = args;

if (!projectId || !contentFile) {
  console.error(
    "usage: node scripts/dump-validation.mjs <project_id> <content_file>",
  );
  process.exit(2);
}

const ocUrl = process.env.OC_URL;
const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11434";
const validatorModel = process.env.OLLAMA_VALIDATOR_MODEL;
if (!ocUrl || !validatorModel) {
  console.error("OC_URL and OLLAMA_VALIDATOR_MODEL are required");
  process.exit(2);
}

const content = await readFile(contentFile, "utf8");
console.log("=".repeat(78));
console.log("CONTENT BEING VALIDATED");
console.log("=".repeat(78));
console.log(content);

let ocUrlParsed;
try {
  ocUrlParsed = new URL(ocUrl);
} catch {
  console.error(`dump-validation: OC_URL is not a valid URL: ${ocUrl}`);
  process.exit(1);
}
const oc = new OcClient(ocUrlParsed);
try {
  await oc.connect();
} catch (err) {
  // Naming OC explicitly matters: the raw failure is a bare "fetch failed"
  // plus undici frames that never mention which service was unreachable.
  console.error(
    `dump-validation: could not reach OpenChronicle at ${ocUrl} -- ${err.message}`,
  );
  process.exit(1);
}
const validator = new OllamaProvider({
  url: ollamaUrl,
  defaultModel: validatorModel,
});

const ctx = await gatherContext(oc, projectId, content, {
  validationOnly: true,
});
console.log("\n" + "=".repeat(78));
console.log(`VALIDATION REPORT (model: ${validatorModel})`);
console.log("=".repeat(78));
const start = Date.now();
const report = await validateContent(validator, ctx, content);
console.log(JSON.stringify(report, null, 2));
console.log(`\n(${Date.now() - start}ms)`);

await oc.close();
