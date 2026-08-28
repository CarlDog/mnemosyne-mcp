// One-shot diagnostic: dump exactly what mnemo_continue would send to
// Ollama, given a story id and a user direction. Used to triage
// "model ignored the rule" vs. "rule never reached the prompt" bugs.
//
// Usage:
//   OC_URL=http://your-nas:18000/mcp \
//     node scripts/dump-prompt.mjs <project_id> "<user direction>"

import { OcClient } from "../dist/oc-client.js";
import {
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  SCENE_CONTEXT_STRATEGIES,
  gatherContext,
  buildSystemPrompt,
} from "../dist/prompt.js";

const args = process.argv.slice(2);
let projectId;
let directionParts = [];
// Same normalization + allowlist the server applies: ""/whitespace reads
// as unset, an invalid value exits loudly instead of silently behaving
// as recency-first (this script exists to pin causes -- mislabeling the
// dumped context's strategy would defeat it).
let sceneContextStrategy =
  process.env.MNEMO_SCENE_CONTEXT_STRATEGY?.trim().toLowerCase() || undefined;
if (
  sceneContextStrategy !== undefined &&
  !SCENE_CONTEXT_STRATEGIES.includes(sceneContextStrategy)
) {
  console.error(
    `invalid MNEMO_SCENE_CONTEXT_STRATEGY: ${process.env.MNEMO_SCENE_CONTEXT_STRATEGY}. ` +
      `Expected one of: ${SCENE_CONTEXT_STRATEGIES.join(", ")}`,
  );
  process.exit(2);
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (
    arg === "--scene-context-strategy" ||
    arg.startsWith("--scene-context-strategy=")
  ) {
    const value = arg.startsWith("--scene-context-strategy=")
      ? arg.slice("--scene-context-strategy=".length)
      : args[++i];

    if (!SCENE_CONTEXT_STRATEGIES.includes(value)) {
      console.error(
        `invalid --scene-context-strategy: ${value}. ` +
          `Expected one of: ${SCENE_CONTEXT_STRATEGIES.join(", ")}`,
      );
      process.exit(2);
    }
    sceneContextStrategy = value;
    continue;
  }

  if (projectId === undefined) {
    projectId = arg;
    continue;
  }
  directionParts.push(arg);
}

if (!projectId || directionParts.length === 0) {
  console.error(
    "usage: node scripts/dump-prompt.mjs <project_id> <direction> " +
      "[--scene-context-strategy recency-first|query-ranked]",
  );
  process.exit(2);
}
const direction = directionParts.join(" ");
const requestedSceneContextStrategy =
  sceneContextStrategy ?? DEFAULT_SCENE_CONTEXT_STRATEGY;

const ocUrl = process.env.OC_URL;
if (!ocUrl) {
  console.error("OC_URL is required");
  process.exit(2);
}

const oc = new OcClient(new URL(ocUrl));
await oc.connect();

const ctx = await gatherContext(oc, projectId, direction, {
  sceneStrategy: requestedSceneContextStrategy,
});
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
