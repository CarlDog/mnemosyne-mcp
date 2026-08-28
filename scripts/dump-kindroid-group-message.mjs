// One-shot diagnostic: bind a story's Kindroid target to a group chat, then
// build the exact message mnemo_continue would send to that group via
// KindroidProvider -- context-gathering + buildKindroidMessage's keyphrase
// folding, with no live server restart required.
//
// Exists because the live-connected mnemosyne MCP server only holds
// whatever dist/ looked like when it was started; this lets you regenerate
// the exact same Kindroid message shape against the live memory state without a
// server restart. It talks to OC directly (same OC_URL any mnemosyne
// deployment uses, no Kindroid credentials required) and never calls Kindroid,
// so it is safe for quick message-shape diagnostics.
//
// Usage:
//   OC_URL=http://your-nas:18000/mcp \
//     node scripts/dump-kindroid-group-message.mjs <story_id> <group_id> "<direction>"

import { OcClient } from "../dist/oc-client.js";
import { findStory, setKindroidTarget } from "../dist/stories.js";
import {
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  SCENE_CONTEXT_STRATEGIES,
  gatherContext,
} from "../dist/prompt.js";
import { buildKindroidMessage } from "../dist/kindroid-provider.js";

const args = process.argv.slice(2);
let storyId;
let groupId;
let directionParts = [];
// Same normalization + allowlist the server applies: ""/whitespace reads
// as unset, an invalid value exits loudly instead of silently behaving
// as recency-first.
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
  if (arg === "--scene-context-strategy" || arg.startsWith("--scene-context-strategy=")) {
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

  if (storyId === undefined) {
    storyId = arg;
    continue;
  }
  if (groupId === undefined) {
    groupId = arg;
    continue;
  }
  directionParts.push(arg);
}

if (!storyId || !groupId || directionParts.length === 0) {
  console.error(
    'usage: node scripts/dump-kindroid-group-message.mjs <story_id> <group_id> "<direction>" [--scene-context-strategy recency-first|query-ranked]',
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

const story = await findStory(oc, storyId);
if (!story) {
  console.error(`No story found for id ${storyId}`);
  process.exit(1);
}

const bound = await setKindroidTarget(oc, story, {
  type: "group",
  id: groupId,
});
console.log("=".repeat(78));
console.log("STORY BOUND TO KINDROID TARGET");
console.log("=".repeat(78));
console.log(
  JSON.stringify(
    { story: bound.name, kindroid_target: bound.kindroid_target },
    null,
    2,
  ),
);

const ctx = await gatherContext(oc, storyId, direction, {
  sceneStrategy: requestedSceneContextStrategy,
});
console.log("\n" + "=".repeat(78));
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

const message = buildKindroidMessage(direction, ctx, true);
console.log("\n" + "=".repeat(78));
console.log("MESSAGE THAT WOULD BE SENT TO KINDROID (advanceGroup)");
console.log("=".repeat(78));
console.log(message);

await oc.close();
