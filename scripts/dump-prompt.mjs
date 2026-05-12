// One-shot diagnostic: dump exactly what mnemo_continue would send to
// Ollama, given a story id and a user direction. Used to triage
// "model ignored the rule" vs. "rule never reached the prompt" bugs.
//
// Usage:
//   OC_URL=http://carldog-nas:18000/mcp \
//     node scripts/dump-prompt.mjs <project_id> "<user direction>"

import { OcClient } from "../dist/oc-client.js";
import { gatherContext, buildSystemPrompt } from "../dist/prompt.js";

const [, , projectId, ...directionParts] = process.argv;
if (!projectId || directionParts.length === 0) {
  console.error("usage: node scripts/dump-prompt.mjs <project_id> <direction>");
  process.exit(2);
}
const direction = directionParts.join(" ");

const ocUrl = process.env.OC_URL;
if (!ocUrl) {
  console.error("OC_URL is required");
  process.exit(2);
}

const oc = new OcClient(new URL(ocUrl));
await oc.connect();

const ctx = await gatherContext(oc, projectId, direction);
console.log("=".repeat(78));
console.log("CONTEXT BUNDLE COUNTS");
console.log("=".repeat(78));
console.log(
  JSON.stringify(
    {
      rules: ctx.rules.length,
      style: ctx.style.length,
      characters: ctx.characters.length,
      locations: ctx.locations.length,
      scenes: ctx.scenes.length,
      lore: ctx.lore.length,
      worldbuilding: ctx.worldbuilding.length,
    },
    null,
    2,
  ),
);

console.log("\n" + "=".repeat(78));
console.log("SYSTEM PROMPT (director mode)");
console.log("=".repeat(78));
console.log(buildSystemPrompt("director", ctx));

console.log("\n" + "=".repeat(78));
console.log("USER MESSAGE");
console.log("=".repeat(78));
console.log(direction);

await oc.close();
