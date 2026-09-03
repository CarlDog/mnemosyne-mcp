#!/usr/bin/env node
/**
 * Run the narrator corpus through a Kindroid kin via kindroid-mcp, using
 * mnemosyne's own client and message builder so each case is sent exactly as
 * mnemo_continue would send it (docs/NARRATOR_EVAL.md).
 *
 *   KINDROID_MCP_URL=... KINDROID_STORYTELLING_KIN=... \
 *   node scripts/narrator-eval/generate-kindroid.mjs [--out <beats.json>] [--no-break]
 *
 * Each case is preceded by a chat break seeded with the corpus greeting so the
 * kin's short-term context holds only the corpus (pass --no-break to let
 * cases accumulate). Beats go under data/ (gitignored); nothing is printed
 * but ids, lengths, and timings.
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
const kin = process.env.KINDROID_STORYTELLING_KIN;
if (!url || !kin) {
  console.error("KINDROID_MCP_URL and KINDROID_STORYTELLING_KIN are required");
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

const client = new KindroidClient(
  new URL(url),
  process.env.KINDROID_MCP_AUTH_TOKEN,
);
const beats = [];
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
      ms: Date.now() - t0,
      provider: "kindroid",
    });
    console.log(
      `${c.id.padEnd(20)} ${String(text.length).padStart(5)} chars ${Date.now() - t0} ms`,
    );
  } catch (err) {
    beats.push({
      case_id: c.id,
      beat_text: "",
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
      kin: "kindroid",
      beats,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`beats: ${outPath}`);
