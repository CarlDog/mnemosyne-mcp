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
import { OcClient } from "../dist/oc-client.js";
import { OllamaProvider } from "../dist/llm.js";
import { gatherContext } from "../dist/prompt.js";
import { validateContent } from "../dist/validator.js";

const [, , projectId, contentFile] = process.argv;
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

const oc = new OcClient(new URL(ocUrl));
await oc.connect();
const validator = new OllamaProvider({
  url: ollamaUrl,
  defaultModel: validatorModel,
});

const ctx = await gatherContext(oc, projectId, content);
console.log("\n" + "=".repeat(78));
console.log(`VALIDATION REPORT (model: ${validatorModel})`);
console.log("=".repeat(78));
const start = Date.now();
const report = await validateContent(validator, ctx, content);
console.log(JSON.stringify(report, null, 2));
console.log(`\n(${Date.now() - start}ms)`);

await oc.close();
