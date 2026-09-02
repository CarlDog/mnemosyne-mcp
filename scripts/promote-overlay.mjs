#!/usr/bin/env node
// Promote a story's verified draft overlay (or a selected subset of it) into
// active canon. This is the tool docs/DATA_LAYOUT.md ("Drafts") and
// docs/DATA_ARCHITECTURE_PROPOSAL.md 4.3 defer to: promotion is what this
// tool does, and nothing else copies from drafts/ into canon/.
//
// Usage:
//   node scripts/promote-overlay.mjs <story-slug> --revision <label> \
//     (--all | --paths <a,b,...>) [--approved-by <name>] [--apply]
//
// Without --apply the tool only plans: it runs the verifier and prints what
// would change. With --apply it requires --approved-by, and:
//   1. verifies the whole overlay (verify-draft-overlay.mjs) and, for a
//      subset, verifies a subset manifest written to _control/ (--manifest);
//   2. copies every affected canon file, draft file, and overlay.json to
//      data/workspace/<stamp>-promotion-<slug>-<revision>/before/ (a CONTENT
//      backup, the restore path);
//   3. recomputes every baseline and draft hash immediately before writing
//      and writes the same banner-stripped bytes the verifier staged
//      (scripts/draft-notice.mjs is the one implementation);
//   4. applies atomically in this order: canon writes/removes, draft deletes,
//      then the reduced overlay.json renamed into place last;
//   5. writes the revision's evidence to history/overlays/<revision>/
//      (promotion.json with every hash, plus a copy of _control/ as it stood)
//      and appends a dated paragraph to _control/PASS.md;
//   6. re-verifies (--canon-only, and the full overlay if entries remain);
//      on any failure restores the backup and re-verifies again.
//
// --approved-by is an AUDIT RECORD, not a gate: it proves someone ran the
// tool with a name attached, nothing more (an autonomous agent can supply it).
// Real prevention is the operator's decision to run this command at all.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import { stripLeadingDraftBlockquote } from "./draft-notice.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const STORIES_ROOT = path.join(REPO_ROOT, "data", "stories");
const WORKSPACE = path.join(REPO_ROOT, "data", "workspace");
const VERIFIER = path.join(REPO_ROOT, "scripts", "verify-draft-overlay.mjs");
const SUBSET_MANIFEST = "overlay.promotion.json";
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const LABEL_RE = /^[a-z0-9][a-z0-9-]*$/;
const TIMEOUT_MS = 120_000;

class PromotionError extends Error {}

function fail(message) {
  throw new PromotionError(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "").slice(0, 15) + "Z";
}

function parseArgs(argv) {
  const opts = {
    slug: null,
    revision: null,
    approvedBy: null,
    all: false,
    paths: null,
    apply: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--revision") opts.revision = argv[++i] ?? null;
    else if (a === "--approved-by") opts.approvedBy = argv[++i] ?? null;
    else if (a === "--paths")
      opts.paths = (argv[++i] ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    else if (a === "--all") opts.all = true;
    else if (a === "--apply") opts.apply = true;
    else if (opts.slug === null && SLUG_RE.test(a)) opts.slug = a;
    else fail(`unexpected argument: ${a}`);
  }
  if (!opts.slug) fail("usage: <story-slug> is required");
  if (!opts.revision || !LABEL_RE.test(opts.revision))
    fail("usage: --revision <label> is required (lowercase slug)");
  if (opts.all === Boolean(opts.paths))
    fail("usage: exactly one of --all or --paths <a,b,...> is required");
  if (opts.apply && !opts.approvedBy)
    fail("usage: --apply requires --approved-by <name> (audit record)");
  return opts;
}

function run(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VERIFIER, ...args], {
      cwd: REPO_ROOT,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new PromotionError(`${label} timed out after ${TIMEOUT_MS} ms`));
    }, TIMEOUT_MS);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function verify(args, label) {
  const r = await run(args, label);
  if (r.code !== 0) {
    fail(`${label} failed:\n${(r.stdout + r.stderr).trim()}`);
  }
  return r.stdout;
}

async function readManifest(file, slug) {
  const raw = await readFile(file);
  const text = raw.toString("utf8");
  const parsed = JSON.parse(text);
  if (parsed.story_slug !== slug) fail("manifest story_slug does not match");
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  return { raw, parsed, nl };
}

function serializeManifest(parsed, nl) {
  return (JSON.stringify(parsed, null, 2) + "\n").replaceAll("\n", nl);
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const storyRoot = path.join(STORIES_ROOT, opts.slug);
  const canonRoot = path.join(storyRoot, "canon");
  const draftsRoot = path.join(storyRoot, "drafts");
  const controlRoot = path.join(draftsRoot, "_control");
  const manifestPath = path.join(controlRoot, "overlay.json");
  const historyRoot = path.join(
    storyRoot,
    "history",
    "overlays",
    opts.revision,
  );
  if (!(await exists(manifestPath)))
    fail(`no overlay manifest for ${opts.slug}`);
  if (await exists(historyRoot))
    fail(
      `history/overlays/${opts.revision} already exists; choose a new label`,
    );

  // 1. whole-overlay verification (the gate for everything below)
  const fullReport = await verify([opts.slug], "overlay verification");

  const { parsed: manifest, nl } = await readManifest(manifestPath, opts.slug);
  const selected = opts.all
    ? manifest.files
    : manifest.files.filter((e) => opts.paths.includes(e.path));
  if (!opts.all) {
    const known = new Set(manifest.files.map((e) => e.path));
    for (const p of opts.paths)
      if (!known.has(p)) fail(`--paths names a path not in the manifest: ${p}`);
  }
  if (selected.length === 0) fail("nothing selected for promotion");
  const remaining = manifest.files.filter((e) => !selected.includes(e));

  // subset verification (same rules as the full check, on exactly this subset)
  let subsetReport = null;
  const subsetManifestPath = path.join(controlRoot, SUBSET_MANIFEST);
  if (remaining.length > 0) {
    await writeFile(
      subsetManifestPath,
      serializeManifest({ ...manifest, files: selected }, nl),
    );
    try {
      subsetReport = await verify(
        ["--manifest", `_control/${SUBSET_MANIFEST}`, opts.slug],
        "subset verification",
      );
    } finally {
      await rm(subsetManifestPath, { force: true });
    }
  }

  console.log(
    `${opts.apply ? "Promoting" : "Plan for promoting"} ${selected.length} of ${manifest.files.length} overlay operation(s) of ${opts.slug} as revision ${opts.revision}:`,
  );
  for (const e of selected) console.log(`  ${e.operation.padEnd(7)} ${e.path}`);
  if (!opts.apply) {
    console.log(
      "Dry run: nothing written. Add --apply --approved-by <name> to promote.",
    );
    return;
  }

  // 2. content backup
  const backupRoot = path.join(
    WORKSPACE,
    `${stamp()}-promotion-${opts.slug}-${opts.revision}`,
  );
  const before = path.join(backupRoot, "before");
  await mkdir(before, { recursive: true });
  await cp(manifestPath, path.join(before, "_control", "overlay.json"), {
    recursive: true,
  });
  for (const e of selected) {
    const canonFile = path.join(canonRoot, ...e.path.split("/"));
    const draftFile = path.join(draftsRoot, ...e.path.split("/"));
    if (await exists(canonFile))
      await cp(canonFile, path.join(before, "canon", ...e.path.split("/")));
    if (await exists(draftFile))
      await cp(draftFile, path.join(before, "drafts", ...e.path.split("/")));
  }

  // 3. recompute hashes from bytes immediately before writing; build every
  //    promoted byte string in memory before touching canon (never truncate
  //    a canon file before its replacement exists)
  const plan = [];
  for (const e of selected) {
    const canonFile = path.join(canonRoot, ...e.path.split("/"));
    const draftFile = path.join(draftsRoot, ...e.path.split("/"));
    let promoted = null;
    if (e.operation !== "remove") {
      const draftBytes = await readFile(draftFile);
      const draftHash = sha256(draftBytes);
      if (draftHash !== e.draft_sha256)
        fail(`${e.path}: draft hash changed since verification`);
      promoted = stripLeadingDraftBlockquote(draftBytes, e.path, fail);
    }
    if (e.operation !== "add") {
      const canonBytes = await readFile(canonFile);
      if (sha256(canonBytes) !== e.baseline_sha256)
        fail(`${e.path}: active baseline changed since verification`);
    } else if (await exists(canonFile)) {
      fail(`${e.path}: add collides with an existing active path`);
    }
    plan.push({ entry: e, canonFile, draftFile, promoted });
  }

  // 4. atomic apply: canon, then drafts, then the manifest last
  const restore = async () => {
    for (const { entry, canonFile, draftFile } of plan) {
      const b = path.join(before, "canon", ...entry.path.split("/"));
      if (await exists(b)) {
        await mkdir(path.dirname(canonFile), { recursive: true });
        await cp(b, canonFile);
      } else {
        await rm(canonFile, { force: true });
      }
      const d = path.join(before, "drafts", ...entry.path.split("/"));
      if (await exists(d)) {
        await mkdir(path.dirname(draftFile), { recursive: true });
        await cp(d, draftFile);
      }
    }
    await cp(path.join(before, "_control", "overlay.json"), manifestPath);
  };
  let record;
  try {
    for (const { entry, canonFile, promoted } of plan) {
      if (entry.operation === "remove") await rm(canonFile, { force: false });
      else {
        await mkdir(path.dirname(canonFile), { recursive: true });
        await writeFile(canonFile, promoted, {
          flag: entry.operation === "add" ? "wx" : "w",
        });
      }
    }
    for (const { entry, draftFile } of plan) {
      if (entry.operation !== "remove") await rm(draftFile, { force: false });
    }
    const reduced = serializeManifest({ ...manifest, files: remaining }, nl);
    const tmp = manifestPath + ".tmp";
    await writeFile(tmp, reduced);
    await rename(tmp, manifestPath);

    // 5. evidence
    await mkdir(historyRoot, { recursive: true });
    await cp(controlRoot, path.join(historyRoot, "control-at-promotion"), {
      recursive: true,
    });
    record = {
      schema_version: 1,
      story_slug: opts.slug,
      revision: opts.revision,
      promoted_at: new Date().toISOString(),
      approved_by: opts.approvedBy,
      approval_is_audit_record_not_gate: true,
      operations: plan.map(({ entry, promoted }) => ({
        path: entry.path,
        operation: entry.operation,
        baseline_sha256: entry.baseline_sha256,
        draft_sha256: entry.draft_sha256,
        promoted_sha256: promoted ? sha256(promoted) : null,
      })),
      remaining_operations: remaining.length,
      backup: path.relative(REPO_ROOT, backupRoot).split(path.sep).join("/"),
      verifier_report_before: fullReport,
      subset_verifier_report: subsetReport,
    };
    await writeFile(
      path.join(historyRoot, "promotion.json"),
      JSON.stringify(record, null, 2) + "\n",
    );
    const passNote =
      `${nl}${nl}## Promotion ${opts.revision} (${record.promoted_at.slice(0, 10)})${nl}${nl}` +
      `${plan.length} operation(s) promoted into canon by scripts/promote-overlay.mjs ` +
      `(approved-by: ${opts.approvedBy}, an audit record); ${remaining.length} remain in this overlay. ` +
      `Evidence: history/overlays/${opts.revision}/ (promotion.json with every hash, and _control/ as it stood).${nl}`;
    await writeFile(path.join(controlRoot, "PASS.md"), passNote, { flag: "a" });

    // 6. re-verify; restore on failure
    await verify(
      ["--canon-only", opts.slug],
      "post-promotion canon verification",
    );
    if (remaining.length > 0) {
      await verify([opts.slug], "post-promotion overlay verification");
    } else {
      // empty overlay: the manifest must still verify (files: [])
      await verify([opts.slug], "post-promotion empty-overlay verification");
    }
  } catch (error) {
    console.error(
      `promotion failed after apply began; restoring backup: ${error.message}`,
    );
    await restore();
    await rm(historyRoot, { recursive: true, force: true });
    throw error;
  }
  console.log(
    `Promoted ${plan.length} operation(s) as revision ${opts.revision}; ${remaining.length} remain. ` +
      `Evidence: ${path.relative(REPO_ROOT, historyRoot).split(path.sep).join("/")}. ` +
      `Backup kept at ${record.backup} (retire when satisfied).`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`promote-overlay: ${error.message}`);
  process.exitCode = 1;
}
