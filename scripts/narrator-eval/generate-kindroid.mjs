#!/usr/bin/env node
/**
 * Run the narrator corpus through a Kindroid kin via kindroid-mcp, using
 * mnemosyne's own client and message builder so each case is sent exactly as
 * mnemo_continue would send it (docs/NARRATOR_EVAL.md).
 *
 *   KINDROID_MCP_URL=... node scripts/narrator-eval/generate-kindroid.mjs \
 *     --kin <ai_id> [--out <beats.json>] [--no-break]
 *     [--only <case_id>] [--repeats <n>]
 *
 * --only narrows to one case and --repeats samples it more than once. A full
 * run samples every case exactly once, which is the wrong shape when a single
 * case is the open question: estimating a rate needs many samples of one case,
 * not one sample of many. Score a repeats run with repeat-rate.mjs, not with
 * score.mjs, which expects one beat per case.
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
const only = opt("--only");
// --ab interleaves two arms of one case: the shipping message, and the same
// message with the inert-data notice added. Alternating rather than blocking
// them keeps service drift over a long run off any single arm.
const ab = args.includes("--ab");
const repeats = Number(opt("--repeats", "1"));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 200) {
  console.error("--repeats must be a whole number from 1 to 200");
  process.exit(2);
}
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
// --only narrows to one case; --repeats samples it more than once, which is
// what estimating a rate needs. Each repeat gets its own chat break, so the
// samples are as independent as a chat break can make them. A repeats run is
// for rate analysis and is not a corpus run: do not feed it to the gate.
const selected = only
  ? corpus.cases.filter((c) => c.id === only)
  : corpus.cases;
if (only && selected.length === 0) {
  console.error(`no case with id ${only}`);
  process.exit(2);
}
const plan = [];
for (const c of selected) {
  for (let i = 0; i < repeats; i += 1) {
    if (ab) {
      plan.push({ c, repeat: i, arm: "control", inertNotice: false });
      plan.push({ c, repeat: i, arm: "notice", inertNotice: true });
    } else {
      plan.push({ c, repeat: i });
    }
  }
}
console.log(
  `target kin ${kin} -- ${selected.length} case${selected.length === 1 ? "" : "s"} x ${repeats} = ${plan.length} messages${doBreak ? " and chat breaks" : ""} into its persistent chat`,
);

const beats = [];
let errors = 0;

// Written after every beat, not only at the end. A long --repeats run is
// interruptible, and an interrupted run that saved nothing is a wasted run.
// `complete` stays false until the loop finishes, so a partial file is
// self-describing and the scorer's integrity check will withhold the gate.
let finished = false;
async function save(done) {
  finished = done;
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
        only: only ?? null,
        repeats,
        ab,
        planned: plan.length,
        errors,
        complete: finished && errors === 0,
        beats,
      },
      null,
      2,
    ),
    "utf8",
  );
}
for (const { c, repeat, arm, inertNotice } of plan) {
  const context = c.extra_scene
    ? {
        ...baseContext,
        scenes: [...baseContext.scenes, `Scene x\n${c.extra_scene}`],
      }
    : baseContext;
  const message = buildCompanionMessage(
    c.direction,
    context,
    inertNotice ? { inertNotice: true } : undefined,
    userName,
  );
  const t0 = Date.now();
  try {
    if (doBreak) await client.chatBreak(kin, corpus.greeting);
    const text = await client.sendMessage(kin, message);
    beats.push({
      case_id: c.id,
      repeat,
      ...(arm ? { arm } : {}),
      beat_text: text,
      message_len: message.length,
      ms: Date.now() - t0,
      provider: "kindroid",
    });
    console.log(
      `${(arm ? `${arm}#${repeat}` : repeats > 1 ? `${c.id}#${repeat}` : c.id).padEnd(24)} ${String(text.length).padStart(5)} chars ${Date.now() - t0} ms`,
    );
    await save(false);
  } catch (err) {
    errors += 1;
    beats.push({
      case_id: c.id,
      repeat,
      ...(arm ? { arm } : {}),
      beat_text: "",
      message_len: message.length,
      ms: Date.now() - t0,
      provider: "kindroid",
      error: err.message,
    });
    console.log(
      `${(repeats > 1 ? `${c.id}#${repeat}` : c.id).padEnd(24)} ERROR ${err.message.slice(0, 110)}`,
    );
    await save(false);
  }
}
await client.close();
await save(true);
console.log(`beats: ${outPath}${errors ? ` (${errors} FAILED)` : ""}`);
if (errors > 0) process.exit(1);
