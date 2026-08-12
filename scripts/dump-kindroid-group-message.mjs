// One-shot diagnostic: bind a story's Kindroid target to a group chat, then
// build the exact message mnemo_continue would send to that group via
// KindroidProvider -- context-gathering + buildKindroidMessage's keyphrase
// folding, with no live server restart required.
//
// Exists because the live-connected mnemosyne MCP server only holds
// whatever dist/ looked like when it was started -- it predates the
// per-story Kindroid group-binding feature, so mnemo_story_use's exposed
// tool schema doesn't accept kindroid_group_id at all right now. This script
// talks to OC directly instead (same OC_URL any mnemosyne deployment uses,
// no Kindroid credentials needed -- it only builds the message text, it
// never calls Kindroid).
//
// Usage:
//   OC_URL=http://your-nas:18000/mcp \
//     node scripts/dump-kindroid-group-message.mjs <story_id> <group_id> "<direction>"

import { OcClient } from "../dist/oc-client.js";
import { findStory, setKindroidTarget } from "../dist/stories.js";
import { gatherContext } from "../dist/prompt.js";
import { buildKindroidMessage } from "../dist/kindroid-provider.js";

const [, , storyId, groupId, ...directionParts] = process.argv;
if (!storyId || !groupId || directionParts.length === 0) {
  console.error(
    'usage: node scripts/dump-kindroid-group-message.mjs <story_id> <group_id> "<direction>"',
  );
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

const ctx = await gatherContext(oc, storyId, direction);
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
