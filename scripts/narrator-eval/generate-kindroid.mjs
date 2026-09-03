#!/usr/bin/env node
/**
 * Run the narrator corpus through a Kindroid kin via kindroid-mcp, using
 * mnemosyne's own client and message builder so each case is sent exactly as
 * mnemo_continue would send it (docs/NARRATOR_EVAL.md).
 *
 *   KINDROID_MCP_URL=... node scripts/narrator-eval/generate-kindroid.mjs \
 *     --kin <ai_id> [--out <beats.json>] [--no-break]
 *
 * The target may also come from KINDROID_STORYTELLING_KIN, but --kin wins and
 * the resolved target is echoed before the first write: this writes twelve
 * real messages (and, by default, twelve chat breaks) into a real kin's
 * persistent chat, so pointing it at a story's own kin would edit that story.
 *
 * Each case is preceded by a chat break seeded with the corpus greeting so the
 * kin's short-term context holds only the corpus (pass --no-break to let cases
 * accumulate). Note this resets short-term context only: isolation also
 * depends on the kin having memory formation, memory recall, learned context
 * and time awareness switched off.
 *
 * Beats go under data/ (gitignored). Nothing is printed but the target, ids,
 * lengths and timings. A case that fails to generate is recorded with its
 * error, counted in the envelope, and makes this script exit non-zero so a
 * partial run cannot be scored by accident.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "../dist-preflight.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const url = process.env.KINDROID_MCP_URL;
const kin = opt("--kin", process.env.KINDROID_STORYTELLING_KIN);
if (!url || !kin) {
  console.error(
    "KINDROID_MCP_URL is required, and a target via --kin <ai_id> or KINDROID_STORYTELLING_KIN",
  );
  process.exit(2);
}
const doBreak = !args.includes("--no-break");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = resolve(
  opt("--out", `data/narrator-eval/beats-kindroid-${stamp}.json`),
);

const { KindroidClient } = await import("../../dist/kindroid-client.js");
const { buildCompanionMessage, DEFAULT_USER_NAME } =
  await import("../../dist/companion-message.js");
const corpus = JSON.parse(await readFile(resolve(here, "corpus.json"), "utf8"));
const userName = process.env.MNEMO_USER_NAME?.trim() || DEFAULT_USER_NAME;

const flatten = (rows) => rows.map((r) => `${r.name}\n${r.body}`);
const baseContext = {
  rules: flatten(corpus.seed.rules),
  style: flatten(corpus.seed.style),
  characters: flatten(corpus.seed.characters),
  locations: flatten(corpus.seed.locations),
  scenes: flatten(corpus.seed.scenes),
  lore: [],
  worldbuilding: [],
};

console.log(
  `target kin ${kin} -- writing ${corpus.cases.length} messages${doBreak ? " and chat breaks" : ""} into its persistent chat`,
);

const client = new KindroidClient(
  new URL(url),
  process.env.KINDROID_MCP_AUTH_TOKEN,
);
const beats = [];
let errors = 0;
for (const c of corpus.cases) {
  const context = c.extra_scene
    ? {
        ...baseContext,
        scenes: [...baseContext.scenes, `Scene x\n${c.extra_scene}`],
      }
    : baseContext;
  const message = buildCompanionMessage(
    c.direction,
    context,
    undefined,
    userName,
  );
  const t0 = Date.now();
  try {
    if (doBreak) await client.chatBreak(kin, corpus.greeting);
    const text = await client.sendMessage(kin, message);
    beats.push({
      case_id: c.id,
      beat_text: text,
      message_len: message.length,
      ms: Date.now() - t0,
      provider: "kindroid",
    });
    console.log(
      `${c.id.padEnd(20)} ${String(text.length).padStart(5)} chars ${Date.now() - t0} ms`,
    );
  } catch (err) {
    errors += 1;
    beats.push({
      case_id: c.id,
      beat_text: "",
      message_len: message.length,
      ms: Date.now() - t0,
      provider: "kindroid",
      error: err.message,
    });
    console.log(`${c.id.padEnd(20)} ERROR ${err.message.slice(0, 120)}`);
  }
}
await client.close();
await mkdir(dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      corpus_version: corpus.version,
      provider: "kindroid",
      kin_id: kin,
      chat_break: doBreak,
      user_name: userName,
      errors,
      complete: errors === 0,
      beats,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`beats: ${outPath}${errors ? ` (${errors} FAILED)` : ""}`);
if (errors > 0) process.exit(1);
