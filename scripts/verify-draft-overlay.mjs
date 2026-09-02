// Read-only verifier for a story's manifest-driven draft overlay.
//
// Usage:
//   node scripts/verify-draft-overlay.mjs <story-slug>
//   node scripts/verify-draft-overlay.mjs --canon-only <story-slug>
//   node scripts/verify-draft-overlay.mjs --manifest _control/<file>.json <story-slug>
//
// --manifest verifies a SUBSET manifest (the promotion tool writes one for a
// partial promotion); non-control drafts outside it may exist unmanifested.
// An empty `files` array is valid: it is an overlay between proposals.
//
// --canon-only stages active canon with an empty operation list and runs
// the same pointer check, structural validator, and import preflight on it,
// so `canon/` is verified on its own, without help from `drafts/`. It needs
// no overlay manifest and never reads `drafts/`.
//
// Reads data/stories/<slug>/drafts/_control/overlay.json with schema 1
// (add/replace) or schema 2 (add/replace/remove):
// {
//   "schema_version": 1,
//   "story_slug": "battlechasers",
//   "files": [
//     {
//       "path": "locations/example.md",
//       "operation": "replace",
//       "baseline_sha256": "<64 hex characters>",
//       "draft_sha256": "<64 hex characters>"
//     },
//     {
//       "path": "lore/new-record.md",
//       "operation": "add",
//       "baseline_sha256": null,
//       "draft_sha256": "<64 hex characters>"
//     },
//     {
//       "path": "worldbuilding/editorial-record.md",
//       "operation": "remove",
//       "baseline_sha256": "<64 hex characters>",
//       "draft_sha256": null
//     }
//   ]
// }
//
// The manifest is the only promotion-path authority. This script never scans
// drafts/ to infer additional promotion targets, never writes canon/ or
// references/, and never performs a runtime/OpenChronicle import. It stages a
// temporary authoring tree, verifies it, then removes that tree.

import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";
import { parseCanonScalar } from "./canon-frontmatter.mjs";
import {
  DRAFT_MARKER,
  stripLeadingDraftBlockquote as stripDraftNotice,
} from "./draft-notice.mjs";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const STORIES_ROOT = path.join(REPO_ROOT, "data", "stories");
const VALIDATOR = path.join(REPO_ROOT, "scripts", "validate-canon.mjs");
const COMPILER = path.join(REPO_ROOT, "scripts", "compile-story.mjs");
const TEMP_PREFIX = "mnemosyne-draft-overlay-";
const VALIDATOR_TIMEOUT_MS = 30_000;
const VALIDATOR_KILL_GRACE_MS = 5_000;
const VALIDATOR_MAX_OUTPUT_BYTES = 1_000_000;
const SHA256_RE = /^[a-f0-9]{64}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const FRONTMATTER_KEY_RE = /^([a-z_][a-z0-9_]*):\s*(.*)$/;
const IMAGE_POINTER_RE =
  /data\/stories\/[a-z0-9][a-z0-9_-]*\/references\/[A-Za-z0-9._~!$&'+,;=@%/-]+\.(?:png|jpe?g|webp|gif|avif)/gi;
const RESIDUE_MARKERS = [DRAFT_MARKER, "DRAFT CONTROL RECORD"];

class VerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "VerificationError";
  }
}

function fail(message) {
  throw new VerificationError(message);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseArgs(argv) {
  const canonOnly = argv.includes("--canon-only");
  let manifestRelative = null;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--canon-only") continue;
    if (argv[i] === "--manifest") {
      manifestRelative = argv[++i] ?? null;
      continue;
    }
    rest.push(argv[i]);
  }
  if (
    rest.length !== 1 ||
    !SLUG_RE.test(rest[0]) ||
    (manifestRelative !== null &&
      !/^_control\/[A-Za-z0-9._-]+\.json$/.test(manifestRelative))
  ) {
    fail(
      "usage: node scripts/verify-draft-overlay.mjs [--canon-only] " +
        "[--manifest _control/<file>.json] <story-slug> " +
        "(lowercase letters, digits, and hyphens only)",
    );
  }
  return { slug: rest[0], canonOnly, manifestRelative };
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32"
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

function isWithin(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function toPosixRelative(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function resolveManifestPath(root, relativePath) {
  const resolved = path.resolve(root, ...relativePath.split("/"));
  if (!isWithin(root, resolved)) {
    fail(`manifest path escapes its allowed root: ${relativePath}`);
  }
  return resolved;
}

function validateManifestPath(value, index) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`manifest files[${index}].path must be a non-empty string`);
  }
  if (value.includes("\\")) {
    fail(
      `manifest files[${index}].path must use POSIX '/' separators: ${value}`,
    );
  }
  if (
    value.includes("\0") ||
    value.startsWith("/") ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value
  ) {
    fail(
      `manifest files[${index}].path is not normalized and relative: ${value}`,
    );
  }
  const parts = value.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    fail(`manifest files[${index}].path has an unsafe component: ${value}`);
  }
  if (parts.some((part) => part.toLowerCase() === "_control")) {
    fail(
      `manifest files[${index}].path targets reserved _control data: ${value}`,
    );
  }
  if (!value.endsWith(".md")) {
    fail(`manifest files[${index}].path is not a Markdown file: ${value}`);
  }
  return value;
}

function validateHash(value, label) {
  if (typeof value !== "string" || !SHA256_RE.test(value)) {
    fail(`${label} must be a 64-character hexadecimal SHA-256`);
  }
  return value.toLowerCase();
}

function assertKnownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    fail(`${label} contains unknown field(s): ${unknown.sort().join(", ")}`);
  }
}

function validateManifest(raw, slug) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("overlay manifest must be a JSON object");
  }
  assertKnownKeys(
    raw,
    new Set(["schema_version", "story_slug", "files"]),
    "overlay manifest",
  );
  if (raw.schema_version !== 1 && raw.schema_version !== 2) {
    fail(
      `overlay manifest schema_version must be 1 or 2, got ${raw.schema_version}`,
    );
  }
  if (raw.story_slug !== slug) {
    fail(
      `overlay manifest story_slug ${JSON.stringify(raw.story_slug)} does not ` +
        `match requested story ${JSON.stringify(slug)}`,
    );
  }
  if (!Array.isArray(raw.files)) {
    fail("overlay manifest files must be an array (empty between proposals)");
  }

  const seen = new Map();
  const entries = raw.files.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      fail(`manifest files[${index}] must be an object`);
    }
    assertKnownKeys(
      item,
      new Set(["path", "operation", "baseline_sha256", "draft_sha256"]),
      `manifest files[${index}]`,
    );
    const relativePath = validateManifestPath(item.path, index);
    const collisionKey = relativePath.toLowerCase();
    if (seen.has(collisionKey)) {
      fail(
        `manifest path collision between files[${seen.get(collisionKey)}] and ` +
          `files[${index}]: ${relativePath}`,
      );
    }
    seen.set(collisionKey, index);

    const allowedOperations =
      raw.schema_version === 1
        ? new Set(["replace", "add"])
        : new Set(["replace", "add", "remove"]);
    if (!allowedOperations.has(item.operation)) {
      fail(
        `manifest files[${index}].operation is not allowed by schema ` +
          `${raw.schema_version}: ${JSON.stringify(item.operation)}`,
      );
    }
    let draftSha256 = null;
    if (item.operation === "remove") {
      if (!Object.hasOwn(item, "draft_sha256") || item.draft_sha256 !== null) {
        fail(
          `manifest files[${index}] is a remove operation and must set ` +
            "draft_sha256 to null",
        );
      }
    } else {
      draftSha256 = validateHash(
        item.draft_sha256,
        `manifest files[${index}].draft_sha256`,
      );
    }
    let baselineSha256 = null;
    if (item.operation === "replace" || item.operation === "remove") {
      baselineSha256 = validateHash(
        item.baseline_sha256,
        `manifest files[${index}].baseline_sha256`,
      );
    } else if (
      !Object.hasOwn(item, "baseline_sha256") ||
      item.baseline_sha256 !== null
    ) {
      fail(
        `manifest files[${index}] is an add operation and must set ` +
          "baseline_sha256 to null",
      );
    }

    return {
      path: relativePath,
      operation: item.operation,
      baselineSha256,
      draftSha256,
    };
  });

  const caseFolded = new Set(entries.map((entry) => entry.path.toLowerCase()));
  for (const entry of entries) {
    const parts = entry.path.toLowerCase().split("/");
    for (let i = 1; i < parts.length; i++) {
      const possibleFileParent = parts.slice(0, i).join("/");
      if (caseFolded.has(possibleFileParent)) {
        fail(
          `manifest paths cannot nest beneath another file path: ` +
            `${possibleFileParent} and ${entry.path}`,
        );
      }
    }
  }

  return entries;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function lstatOrNull(file) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function assertRegularFile(file, label) {
  const fileStat = await lstatOrNull(file);
  if (!fileStat) fail(`${label} does not exist: ${file}`);
  if (fileStat.isSymbolicLink()) {
    fail(`${label} must not be a symbolic link: ${file}`);
  }
  if (!fileStat.isFile()) fail(`${label} is not a regular file: ${file}`);
}

async function walkRegularFiles(root, label) {
  const rootStat = await lstatOrNull(root);
  if (!rootStat) fail(`${label} directory does not exist: ${root}`);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    fail(`${label} root must be a real directory, not a link: ${root}`);
  }

  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        fail(`${label} contains a symbolic link: ${full}`);
      }
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      } else {
        fail(`${label} contains a non-regular filesystem entry: ${full}`);
      }
    }
  }
  await walk(root);
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

async function hashTree(root, label) {
  const result = new Map();
  for (const file of await walkRegularFiles(root, label)) {
    result.set(toPosixRelative(root, file), sha256(await readFile(file)));
  }
  return result;
}

function compareHashTrees(expected, actual, label) {
  const problems = [];
  for (const [relativePath, expectedHash] of expected) {
    const actualHash = actual.get(relativePath);
    if (actualHash === undefined) problems.push(`missing ${relativePath}`);
    else if (actualHash !== expectedHash)
      problems.push(`changed ${relativePath}`);
  }
  for (const relativePath of actual.keys()) {
    if (!expected.has(relativePath))
      problems.push(`unexpected ${relativePath}`);
  }
  if (problems.length > 0) {
    fail(`${label} differs:\n  - ${problems.join("\n  - ")}`);
  }
}

function stripLeadingDraftBlockquote(bytes, relativePath) {
  return stripDraftNotice(bytes, relativePath, fail);
}

async function loadManifest(manifestPath, slug) {
  const draftsRoot = path.dirname(path.dirname(manifestPath));
  await assertResolvedInside(draftsRoot, manifestPath, "overlay manifest");
  let parsed;
  try {
    const bytes = await readFile(manifestPath);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(text);
  } catch (error) {
    fail(`could not read or parse overlay manifest: ${errorMessage(error)}`);
  }
  return validateManifest(parsed, slug);
}

async function assertManifestCompleteness(
  entries,
  draftsRoot,
  subsetMode = false,
) {
  // The manifest remains the sole promotion authority. This inventory scan
  // only proves that the author did not leave an unmanifested Markdown file
  // outside _control/; it never adds an inferred path to the overlay.
  const manifestPaths = new Set(
    entries
      .filter((entry) => entry.operation !== "remove")
      .map((entry) => entry.path),
  );
  const removalPaths = new Set(
    entries
      .filter((entry) => entry.operation === "remove")
      .map((entry) => entry.path),
  );
  const draftPaths = new Set();
  for (const file of await walkRegularFiles(draftsRoot, "draft overlay")) {
    if (path.extname(file).toLowerCase() !== ".md") continue;
    const relativePath = toPosixRelative(draftsRoot, file);
    if (
      relativePath.split("/").some((part) => part.toLowerCase() === "_control")
    ) {
      continue;
    }
    draftPaths.add(relativePath);
  }

  const problems = [];
  for (const relativePath of draftPaths) {
    if (!subsetMode && !manifestPaths.has(relativePath)) {
      problems.push(`unmanifested draft Markdown: ${relativePath}`);
    }
  }
  for (const relativePath of manifestPaths) {
    if (!draftPaths.has(relativePath)) {
      problems.push(
        `manifest path is not a non-control draft Markdown: ${relativePath}`,
      );
    }
  }
  for (const relativePath of removalPaths) {
    if (draftPaths.has(relativePath)) {
      problems.push(
        `remove operation has a promotable draft tombstone: ${relativePath}`,
      );
    }
  }
  if (problems.length > 0) {
    fail(`overlay manifest is incomplete:\n  - ${problems.join("\n  - ")}`);
  }
}

async function verifyManifestHashes(entries, canonRoot, draftsRoot) {
  const verified = [];
  for (const entry of entries) {
    let draftBytes = null;
    if (entry.operation !== "remove") {
      const draftFile = resolveManifestPath(draftsRoot, entry.path);
      await assertResolvedInside(
        draftsRoot,
        draftFile,
        `draft for ${entry.path}`,
      );
      draftBytes = await readFile(draftFile);
      const actualDraftHash = sha256(draftBytes);
      if (actualDraftHash !== entry.draftSha256) {
        fail(
          `${entry.path}: draft SHA-256 mismatch; ` +
            `manifest=${entry.draftSha256}, actual=${actualDraftHash}`,
        );
      }
    }

    const canonFile = resolveManifestPath(canonRoot, entry.path);
    if (entry.operation === "replace" || entry.operation === "remove") {
      await assertRegularFile(canonFile, `active baseline for ${entry.path}`);
      const actualBaselineHash = sha256(await readFile(canonFile));
      if (actualBaselineHash !== entry.baselineSha256) {
        fail(
          `${entry.path}: active baseline SHA-256 mismatch; ` +
            `manifest=${entry.baselineSha256}, actual=${actualBaselineHash}`,
        );
      }
    } else if (await lstatOrNull(canonFile)) {
      fail(
        `${entry.path}: add operation collides with an existing active path`,
      );
    }
    verified.push({ ...entry, draftBytes });
  }
  return verified;
}

function verifyOnlyManifestChanges(activeHashes, stagedHashes, entries) {
  const manifestPaths = new Set(entries.map((entry) => entry.path));
  const expectedPaths = new Set(activeHashes.keys());
  for (const entry of entries) {
    if (entry.operation === "add") expectedPaths.add(entry.path);
    if (entry.operation === "remove") expectedPaths.delete(entry.path);
  }

  const problems = [];
  for (const relativePath of expectedPaths) {
    if (!stagedHashes.has(relativePath))
      problems.push(`missing ${relativePath}`);
  }
  for (const relativePath of stagedHashes.keys()) {
    if (!expectedPaths.has(relativePath))
      problems.push(`unexpected ${relativePath}`);
  }
  for (const [relativePath, activeHash] of activeHashes) {
    if (
      !manifestPaths.has(relativePath) &&
      stagedHashes.get(relativePath) !== activeHash
    ) {
      problems.push(`non-manifest path changed: ${relativePath}`);
    }
  }
  if (problems.length > 0) {
    fail(
      `staged overlay changed paths outside the manifest:\n  - ${problems.join("\n  - ")}`,
    );
  }
}

async function assertNoDraftResidue(stageRoot) {
  for (const file of await walkRegularFiles(stageRoot, "staged canon")) {
    const relativePath = toPosixRelative(stageRoot, file);
    if (
      relativePath.split("/").some((part) => part.toLowerCase() === "_control")
    ) {
      fail(`staged canon contains a reserved _control path: ${relativePath}`);
    }
    const bytes = await readFile(file);
    for (const marker of RESIDUE_MARKERS) {
      if (bytes.includes(Buffer.from(marker, "utf8"))) {
        fail(
          `staged canon contains ${JSON.stringify(marker)} in ${relativePath}`,
        );
      }
    }
  }
}

async function validateStagedTemplateFrontmatter(stageRoot) {
  const templates = (await walkRegularFiles(stageRoot, "staged canon")).filter(
    (file) => {
      const basename = path.basename(file).toLowerCase();
      return (
        path.extname(basename) === ".md" &&
        basename.startsWith("_") &&
        basename.includes("template")
      );
    },
  );

  for (const file of templates) {
    const relativePath = toPosixRelative(stageRoot, file);
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true })
        .decode(await readFile(file))
        .replace(/\r\n/g, "\n");
    } catch (error) {
      fail(
        `${relativePath}: template is not valid UTF-8 (${errorMessage(error)})`,
      );
    }
    if (!content.startsWith("---\n")) {
      fail(`${relativePath}: template does not start with YAML frontmatter`);
    }
    const lines = content.split("\n");
    let closingLine = -1;
    const fields = new Map();
    for (let index = 1; index < lines.length; index++) {
      if (lines[index] === "---") {
        closingLine = index;
        break;
      }
      if (!lines[index].trim()) continue;
      const match = lines[index].match(FRONTMATTER_KEY_RE);
      if (!match) {
        fail(
          `${relativePath}: unparseable template frontmatter line: ` +
            JSON.stringify(lines[index]),
        );
      }
      const [, key, rawValue] = match;
      if (fields.has(key)) {
        fail(
          `${relativePath}:${index + 1}: duplicate template frontmatter key ` +
            JSON.stringify(key),
        );
      }
      fields.set(key, rawValue);
      // Template files deliberately use blank values and HTML comments as
      // placeholders. They never compile into records, but every populated
      // scalar must still obey the same strict subset as canon entities.
      if (rawValue.trim()) {
        try {
          parseCanonScalar(rawValue);
        } catch (error) {
          fail(
            `${relativePath}:${index + 1}:${key}: invalid template ` +
              `frontmatter value (${errorMessage(error)})`,
          );
        }
      }
    }
    if (closingLine === -1) {
      fail(`${relativePath}: template frontmatter opened but never closed`);
    }
    if (
      !lines
        .slice(closingLine + 1)
        .join("\n")
        .trim()
    ) {
      fail(`${relativePath}: template has frontmatter but no body content`);
    }
  }
  return templates.length;
}

function runBoundedNodeScript(script, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: REPO_ROOT,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    let outputBytes = 0;
    let terminalReason = null;
    let settled = false;
    let killGraceTimer = null;

    const timeoutTimer = setTimeout(() => {
      terminate(
        `${label} timed out after ${VALIDATOR_TIMEOUT_MS.toLocaleString()} ms`,
      );
    }, VALIDATOR_TIMEOUT_MS);

    function clearTimers() {
      clearTimeout(timeoutTimer);
      if (killGraceTimer) clearTimeout(killGraceTimer);
    }

    function rejectOnce(error) {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(error);
    }

    function terminate(reason) {
      if (settled || terminalReason) return;
      terminalReason = reason;
      let killRequested;
      try {
        killRequested = child.kill("SIGKILL");
      } catch (error) {
        rejectOnce(
          new VerificationError(
            `${reason}; could not terminate child process: ${errorMessage(error)}`,
          ),
        );
        return;
      }
      if (
        !killRequested &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
        rejectOnce(
          new VerificationError(
            `${reason}; child-process termination request was refused`,
          ),
        );
        return;
      }
      killGraceTimer = setTimeout(() => {
        rejectOnce(
          new VerificationError(
            `${reason}; child process did not exit within ` +
              `${VALIDATOR_KILL_GRACE_MS.toLocaleString()} ms after termination`,
          ),
        );
      }, VALIDATOR_KILL_GRACE_MS);
    }

    function capture(chunks, chunk) {
      if (settled || terminalReason) return;
      outputBytes += chunk.length;
      if (outputBytes > VALIDATOR_MAX_OUTPUT_BYTES) {
        terminate(
          `${label} emitted more than ` +
            `${VALIDATOR_MAX_OUTPUT_BYTES.toLocaleString()} bytes`,
        );
        return;
      }
      chunks.push(Buffer.from(chunk));
    }

    child.stdout.on("data", (chunk) => {
      capture(stdoutChunks, chunk);
    });
    child.stderr.on("data", (chunk) => {
      capture(stderrChunks, chunk);
    });
    child.once("error", (error) => {
      rejectOnce(
        new VerificationError(`could not start ${label}: ${error.message}`),
      );
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      clearTimers();
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (terminalReason) {
        rejectOnce(
          new VerificationError(
            `${terminalReason} (exit=${code}, signal=${signal ?? "none"})` +
              `${stdout ? `\nstdout:\n${stdout.trimEnd()}` : ""}` +
              `${stderr ? `\nstderr:\n${stderr.trimEnd()}` : ""}`,
          ),
        );
        return;
      }
      if (code === 0) {
        settled = true;
        resolve({ stdout: stdout.trimEnd(), stderr: stderr.trimEnd() });
        return;
      }
      rejectOnce(
        new VerificationError(
          `${label} failed (exit=${code}, signal=${signal ?? "none"})` +
            `${stdout ? `\nstdout:\n${stdout.trimEnd()}` : ""}` +
            `${stderr ? `\nstderr:\n${stderr.trimEnd()}` : ""}`,
        ),
      );
    });
  });
}

function runCanonValidator(slug, targetRoot, label) {
  return runBoundedNodeScript(VALIDATOR, [slug, "--dir", targetRoot], label);
}

function runCanonImportCheck(slug, targetRoot, label) {
  return runBoundedNodeScript(
    COMPILER,
    [slug, "--dir", targetRoot, "--check"],
    label,
  );
}

async function assertResolvedInside(root, file, label) {
  await assertRegularFile(file, label);
  const [realRoot, realFile] = await Promise.all([
    realpath(root),
    realpath(file),
  ]);
  if (!samePath(realRoot, realFile) && !isWithin(realRoot, realFile)) {
    fail(`${label} resolves outside its allowed root: ${file}`);
  }
}

async function assertRealDirectory(directory, label) {
  const directoryStat = await lstatOrNull(directory);
  if (!directoryStat) fail(`${label} does not exist: ${directory}`);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    fail(`${label} must be a real directory, not a link: ${directory}`);
  }
  return realpath(directory);
}

async function resolveContainedStoryRoot(storyRoot) {
  const [realRepoRoot, realStoriesRoot] = await Promise.all([
    assertRealDirectory(REPO_ROOT, "repository root"),
    assertRealDirectory(STORIES_ROOT, "stories root"),
  ]);
  if (!isWithin(realRepoRoot, realStoriesRoot)) {
    fail(`stories root resolves outside the repository: ${realStoriesRoot}`);
  }

  const storyStat = await lstatOrNull(storyRoot);
  if (!storyStat) fail(`story root does not exist: ${storyRoot}`);
  if (storyStat.isSymbolicLink() || !storyStat.isDirectory()) {
    fail(`story root must be a real directory, not a link: ${storyRoot}`);
  }
  const realStoryRoot = await realpath(storyRoot);
  if (!isWithin(realStoriesRoot, realStoryRoot)) {
    fail(`story root resolves outside the stories root: ${realStoryRoot}`);
  }
  return realStoryRoot;
}

function sourceLineNumber(text, index) {
  let line = 1;
  for (let cursor = text.indexOf("\n"); cursor !== -1 && cursor < index;) {
    line++;
    cursor = text.indexOf("\n", cursor + 1);
  }
  return line;
}

async function verifyVisualPointers(stageRoot, storyRoot) {
  const referencesRoot = path.join(storyRoot, "references");
  const storySlug = path.basename(storyRoot);
  const requiredPrefix = `data/stories/${storySlug}/references/`;
  const pointers = [];
  for (const file of await walkRegularFiles(stageRoot, "staged canon")) {
    if (path.extname(file).toLowerCase() !== ".md") continue;
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(
        await readFile(file),
      );
    } catch (error) {
      fail(
        `${toPosixRelative(stageRoot, file)} is not valid UTF-8 ` +
          `(${errorMessage(error)})`,
      );
    }
    const source = toPosixRelative(stageRoot, file);
    const matchedStarts = new Set();
    IMAGE_POINTER_RE.lastIndex = 0;
    for (const match of text.matchAll(IMAGE_POINTER_RE)) {
      const matchStart = match.index;
      const lineStart = text.lastIndexOf("\n", matchStart - 1) + 1;
      const nextNewline = text.indexOf("\n", matchStart);
      const lineEnd = nextNewline === -1 ? text.length : nextNewline;
      const sourceLine = sourceLineNumber(text, matchStart);
      const line = text.slice(lineStart, lineEnd).replace(/\r$/, "");
      if (line.trim() !== `- ${match[0]}`) {
        fail(
          `${source}:${sourceLine}: malformed visual pointer; expected the ` +
            `entire Markdown line to be ${JSON.stringify(`- ${match[0]}`)}`,
        );
      }
      matchedStarts.add(
        matchStart + match[0].toLowerCase().indexOf("references/"),
      );
      pointers.push({
        source,
        line: sourceLine,
        path: match[0],
      });
    }

    const referenceTokenRe = /references[\\/]/gi;
    for (const token of text.matchAll(referenceTokenRe)) {
      const sourceLine = sourceLineNumber(text, token.index);
      if (token[0].endsWith("\\")) {
        fail(
          `${source}:${sourceLine}: visual pointer uses a backslash; ` +
            "repo-relative pointers must use '/'",
        );
      }
      if (!matchedStarts.has(token.index)) {
        fail(
          `${source}:${sourceLine}: unmatched or malformed references/ ` +
            "occurrence; expected a supported image path on its own " +
            "Markdown bullet line",
        );
      }
    }
  }

  const checked = new Set();
  const resolvedHashes = new Map();
  if (pointers.length === 0) {
    return {
      occurrences: 0,
      unique: 0,
      referencesRoot,
      resolvedHashes,
    };
  }
  await assertRealDirectory(referencesRoot, "story references root");
  for (const pointer of pointers) {
    if (checked.has(pointer.path)) continue;
    checked.add(pointer.path);
    const normalized = path.posix.normalize(pointer.path);
    if (
      normalized !== pointer.path ||
      !normalized.startsWith(requiredPrefix) ||
      normalized.startsWith("../") ||
      path.posix.isAbsolute(normalized)
    ) {
      fail(
        `${pointer.source}:${pointer.line}: unsafe visual pointer ${pointer.path}`,
      );
    }
    const referencesRelative = normalized.slice(requiredPrefix.length);
    const asset = resolveManifestPath(referencesRoot, referencesRelative);
    await assertResolvedInside(
      referencesRoot,
      asset,
      `visual asset ${pointer.path}`,
    );
    const assetBytes = await readFile(asset);
    resolvedHashes.set(referencesRelative, sha256(assetBytes));
    const sidecar = path.join(
      path.dirname(asset),
      `${path.basename(asset, path.extname(asset))}.json`,
    );
    await assertResolvedInside(
      referencesRoot,
      sidecar,
      `same-basename sidecar for ${pointer.path}`,
    );
    try {
      const sidecarBytes = await readFile(sidecar);
      resolvedHashes.set(
        toPosixRelative(referencesRoot, sidecar),
        sha256(sidecarBytes),
      );
      const sidecarText = new TextDecoder("utf-8", { fatal: true }).decode(
        sidecarBytes,
      );
      const sidecarValue = JSON.parse(sidecarText);
      if (
        !sidecarValue ||
        typeof sidecarValue !== "object" ||
        Array.isArray(sidecarValue)
      ) {
        fail(`sidecar is valid JSON but not an object: ${sidecar}`);
      }
    } catch (error) {
      if (error instanceof VerificationError) throw error;
      fail(`could not parse sidecar ${sidecar}: ${errorMessage(error)}`);
    }
  }
  return {
    occurrences: pointers.length,
    unique: checked.size,
    referencesRoot,
    resolvedHashes,
  };
}

async function rehashResolvedFiles(root, expectedHashes, label) {
  const actualHashes = new Map();
  for (const relativePath of [...expectedHashes.keys()].sort()) {
    const file = resolveManifestPath(root, relativePath);
    await assertResolvedInside(root, file, `${label} file ${relativePath}`);
    actualHashes.set(relativePath, sha256(await readFile(file)));
  }
  compareHashTrees(expectedHashes, actualHashes, label);
}

async function createSafeTempRoot() {
  const tempBase = await realpath(tmpdir());
  const tempRoot = await mkdtemp(path.join(tempBase, TEMP_PREFIX));
  const realTempRoot = await realpath(tempRoot);
  if (
    !samePath(path.dirname(realTempRoot), tempBase) ||
    !path.basename(realTempRoot).startsWith(TEMP_PREFIX)
  ) {
    const lexicalSafe =
      samePath(path.dirname(tempRoot), tempBase) &&
      path.basename(tempRoot).startsWith(TEMP_PREFIX);
    if (lexicalSafe) {
      await rm(tempRoot, { recursive: true, force: false, maxRetries: 2 });
    }
    fail(
      `temporary directory failed containment validation: ${realTempRoot}` +
        (lexicalSafe ? " (removed)" : " (cleanup refused)"),
    );
  }
  return { tempBase, tempRoot, realTempRoot };
}

async function removeSafeTempRoot(temp) {
  const currentReal = await realpath(temp.tempRoot);
  if (
    !samePath(currentReal, temp.realTempRoot) ||
    !samePath(path.dirname(currentReal), temp.tempBase) ||
    !path.basename(currentReal).startsWith(TEMP_PREFIX)
  ) {
    fail(`refusing to remove unverified temporary directory: ${currentReal}`);
  }
  await rm(currentReal, { recursive: true, force: false, maxRetries: 2 });
  if (await lstatOrNull(currentReal)) {
    fail(`temporary directory still exists after cleanup: ${currentReal}`);
  }
}

async function verifyCanonOnly(slug) {
  const storyRoot = await resolveContainedStoryRoot(
    path.join(STORIES_ROOT, slug),
  );
  const canonRoot = path.join(storyRoot, "canon");
  await assertRealDirectory(canonRoot, "active canon");
  let activeBefore = null;
  let stageRoot = null;
  let stagedBeforeValidation = null;
  let visualSnapshot = null;
  let temp = null;
  let report = null;
  const failures = [];
  try {
    activeBefore = await hashTree(canonRoot, "active canon");
    temp = await createSafeTempRoot();
    stageRoot = path.join(temp.realTempRoot, "canon-only");
    await cp(canonRoot, stageRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    stagedBeforeValidation = await hashTree(stageRoot, "staged canon");
    compareHashTrees(activeBefore, stagedBeforeValidation, "staged canon copy");
    const templates = await validateStagedTemplateFrontmatter(stageRoot);
    visualSnapshot = await verifyVisualPointers(stageRoot, storyRoot);
    const validator = await runCanonValidator(
      slug,
      stageRoot,
      "active canon validator",
    );
    const importCheck = await runCanonImportCheck(
      slug,
      stageRoot,
      "active canon import dry-run",
    );
    report = { validator, importCheck, visuals: visualSnapshot, templates };
  } catch (error) {
    failures.push(`verification failed: ${errorMessage(error)}`);
  }
  if (activeBefore) {
    try {
      compareHashTrees(
        activeBefore,
        await hashTree(canonRoot, "active canon after verification"),
        "active canon changed during verification",
      );
    } catch (error) {
      failures.push(
        `active-canon integrity check failed: ${errorMessage(error)}`,
      );
    }
  }
  if (stageRoot && stagedBeforeValidation) {
    try {
      compareHashTrees(
        stagedBeforeValidation,
        await hashTree(stageRoot, "staged canon after validation"),
        "staged canon changed during validation",
      );
    } catch (error) {
      failures.push(
        `staged-canon integrity check failed: ${errorMessage(error)}`,
      );
    }
  }
  if (visualSnapshot) {
    try {
      await rehashResolvedFiles(
        visualSnapshot.referencesRoot,
        visualSnapshot.resolvedHashes,
        "resolved visual assets changed during validation",
      );
    } catch (error) {
      failures.push(
        `visual-asset integrity check failed: ${errorMessage(error)}`,
      );
    }
  }
  if (temp) {
    try {
      await removeSafeTempRoot(temp);
    } catch (error) {
      failures.push(
        `temporary-directory cleanup failed: ${errorMessage(error)}`,
      );
    }
  }
  if (failures.length > 0) fail(failures.join("\n"));
  if (!report) fail("verification ended without producing a report");
  console.log(`Verified active canon alone for ${slug} (--canon-only)`);
  console.log(
    `  visual pointers: ${report.visuals.occurrences} occurrences, ` +
      `${report.visuals.unique} unique; assets and sidecars OK`,
  );
  console.log(
    `  underscore-prefixed Markdown templates: ${report.templates} OK`,
  );
  console.log("  structural validator: active canon OK");
  if (report.validator.stdout) console.log(report.validator.stdout);
  if (report.validator.stderr) console.error(report.validator.stderr);
  console.log("  offline import schema/preflight: active canon OK; writes=0");
  if (report.importCheck.stdout) console.log(report.importCheck.stdout);
  if (report.importCheck.stderr) console.error(report.importCheck.stderr);
  console.log("  active canon hashes unchanged");
  console.log("  temporary staging directory removed");
}

async function verifyOverlay(slug, manifestRelative = null) {
  const storyRoot = await resolveContainedStoryRoot(
    path.join(STORIES_ROOT, slug),
  );
  const canonRoot = path.join(storyRoot, "canon");
  const draftsRoot = path.join(storyRoot, "drafts");
  // --manifest names a subset manifest inside _control/ (the promotion tool
  // writes one for a partial promotion); other non-control drafts may then
  // exist unmanifested, because they belong to the overlay's full manifest.
  const subsetMode = manifestRelative !== null;
  const manifestRelativePath = manifestRelative ?? "_control/overlay.json";
  const manifestPath = path.join(
    draftsRoot,
    ...manifestRelativePath.split("/"),
  );

  let activeBefore = null;
  let draftsBefore = null;
  let manifestHashBefore = null;
  let baselineCopyBeforeValidation = null;
  let isolatedCopyBeforeValidation = null;
  let stagedBeforeValidation = null;
  let baselineCopyRoot = null;
  let isolatedCopyRoot = null;
  let stageRoot = null;
  let visualSnapshot = null;
  let temp = null;
  let report = null;
  const failures = [];

  try {
    activeBefore = await hashTree(canonRoot, "active canon");
    draftsBefore = await hashTree(draftsRoot, "draft overlay");
    manifestHashBefore = draftsBefore.get(manifestRelativePath) ?? null;
    if (!manifestHashBefore) {
      fail(`draft overlay snapshot does not contain ${manifestRelativePath}`);
    }
    await assertResolvedInside(draftsRoot, manifestPath, "overlay manifest");
    const immediateManifestHash = sha256(await readFile(manifestPath));
    if (immediateManifestHash !== manifestHashBefore) {
      fail("overlay manifest changed while its input snapshot was captured");
    }
    const entries = await loadManifest(manifestPath, slug);
    await assertManifestCompleteness(entries, draftsRoot, subsetMode);
    const verifiedEntries = await verifyManifestHashes(
      entries,
      canonRoot,
      draftsRoot,
    );

    temp = await createSafeTempRoot();
    baselineCopyRoot = path.join(temp.realTempRoot, "active-canon-copy");
    isolatedCopyRoot = path.join(temp.realTempRoot, "isolated-drafts-copy");
    stageRoot = path.join(temp.realTempRoot, "merged-canon");
    await cp(canonRoot, baselineCopyRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    baselineCopyBeforeValidation = await hashTree(
      baselineCopyRoot,
      "disposable active baseline copy",
    );
    compareHashTrees(
      activeBefore,
      baselineCopyBeforeValidation,
      "disposable active baseline copy",
    );
    await cp(draftsRoot, isolatedCopyRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    isolatedCopyBeforeValidation = await hashTree(
      isolatedCopyRoot,
      "disposable isolated draft copy",
    );
    compareHashTrees(
      draftsBefore,
      isolatedCopyBeforeValidation,
      "disposable isolated draft copy",
    );
    await cp(canonRoot, stageRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    compareHashTrees(
      activeBefore,
      await hashTree(stageRoot, "staged baseline"),
      "staged baseline copy",
    );

    for (const entry of verifiedEntries) {
      const target = resolveManifestPath(stageRoot, entry.path);
      if (entry.operation === "remove") {
        await rm(target, { force: false, recursive: false });
        continue;
      }
      await mkdir(path.dirname(target), { recursive: true });
      const promotedBytes = stripLeadingDraftBlockquote(
        entry.draftBytes,
        entry.path,
      );
      await writeFile(target, promotedBytes, {
        flag: entry.operation === "add" ? "wx" : "w",
      });
    }

    await assertNoDraftResidue(stageRoot);
    const templates = await validateStagedTemplateFrontmatter(stageRoot);
    const stagedHashes = await hashTree(stageRoot, "staged overlay");
    stagedBeforeValidation = stagedHashes;
    verifyOnlyManifestChanges(activeBefore, stagedHashes, entries);
    visualSnapshot = await verifyVisualPointers(stageRoot, storyRoot);
    const baselineValidator = await runCanonValidator(
      slug,
      baselineCopyRoot,
      "active baseline validator",
    );
    // An overlay with no staged draft entities (empty between proposals, or
    // removals only) has nothing for the isolated validator to read; the
    // merged validator below still covers the resulting canon.
    const stagedDrafts = entries.some((entry) => entry.operation !== "remove");
    const isolatedValidator = stagedDrafts
      ? await runCanonValidator(
          slug,
          isolatedCopyRoot,
          "isolated draft validator",
        )
      : "skipped (no staged draft entities)";
    const mergedValidator = await runCanonValidator(
      slug,
      stageRoot,
      "merged overlay validator",
    );
    const mergedImportCheck = await runCanonImportCheck(
      slug,
      stageRoot,
      "merged overlay import dry-run",
    );
    report = {
      manifestPath,
      entries: entries.length,
      replacements: entries.filter((entry) => entry.operation === "replace")
        .length,
      additions: entries.filter((entry) => entry.operation === "add").length,
      removals: entries.filter((entry) => entry.operation === "remove").length,
      validators: {
        baseline: baselineValidator,
        isolated: isolatedValidator,
        merged: mergedValidator,
      },
      importCheck: mergedImportCheck,
      visuals: visualSnapshot,
      templates,
    };
  } catch (error) {
    failures.push(`verification failed: ${errorMessage(error)}`);
  }

  if (activeBefore) {
    try {
      compareHashTrees(
        activeBefore,
        await hashTree(canonRoot, "active canon after verification"),
        "active canon changed during verification",
      );
    } catch (error) {
      failures.push(
        `active-canon integrity check failed: ${errorMessage(error)}`,
      );
    }
  }

  if (draftsBefore) {
    try {
      compareHashTrees(
        draftsBefore,
        await hashTree(draftsRoot, "draft overlay after validation"),
        "draft overlay changed during validation",
      );
    } catch (error) {
      failures.push(
        `draft-overlay integrity check failed: ${errorMessage(error)}`,
      );
    }
  }

  if (manifestHashBefore) {
    try {
      await assertResolvedInside(draftsRoot, manifestPath, "overlay manifest");
      const manifestHashAfter = sha256(await readFile(manifestPath));
      if (manifestHashAfter !== manifestHashBefore) {
        fail("overlay manifest changed during validation");
      }
    } catch (error) {
      failures.push(`manifest integrity check failed: ${errorMessage(error)}`);
    }
  }

  if (baselineCopyRoot && baselineCopyBeforeValidation) {
    try {
      compareHashTrees(
        baselineCopyBeforeValidation,
        await hashTree(
          baselineCopyRoot,
          "disposable active baseline copy after validation",
        ),
        "disposable active baseline copy changed during validation",
      );
    } catch (error) {
      failures.push(
        `baseline-copy integrity check failed: ${errorMessage(error)}`,
      );
    }
  }

  if (isolatedCopyRoot && isolatedCopyBeforeValidation) {
    try {
      compareHashTrees(
        isolatedCopyBeforeValidation,
        await hashTree(
          isolatedCopyRoot,
          "disposable isolated draft copy after validation",
        ),
        "disposable isolated draft copy changed during validation",
      );
    } catch (error) {
      failures.push(
        `isolated-copy integrity check failed: ${errorMessage(error)}`,
      );
    }
  }

  if (stageRoot && stagedBeforeValidation) {
    try {
      compareHashTrees(
        stagedBeforeValidation,
        await hashTree(stageRoot, "staged canon after validation"),
        "staged canon changed during validation",
      );
    } catch (error) {
      failures.push(
        `staged-canon integrity check failed: ${errorMessage(error)}`,
      );
    }
  }

  if (visualSnapshot) {
    try {
      await rehashResolvedFiles(
        visualSnapshot.referencesRoot,
        visualSnapshot.resolvedHashes,
        "resolved visual assets changed during validation",
      );
    } catch (error) {
      failures.push(
        `visual-asset integrity check failed: ${errorMessage(error)}`,
      );
    }
  }

  if (temp) {
    try {
      await removeSafeTempRoot(temp);
    } catch (error) {
      failures.push(
        `temporary-directory cleanup failed: ${errorMessage(error)}`,
      );
    }
  }

  if (failures.length > 0) fail(failures.join("\n"));
  if (!report) fail("verification ended without producing a report");

  console.log(
    `Verified draft overlay for ${slug}${subsetMode ? " (subset manifest)" : ""}`,
  );
  console.log(`  manifest: ${report.manifestPath}`);
  console.log(
    `  files: ${report.entries} ` +
      `(${report.replacements} ${report.replacements === 1 ? "replacement" : "replacements"}, ` +
      `${report.additions} ${report.additions === 1 ? "addition" : "additions"}, ` +
      `${report.removals} ${report.removals === 1 ? "removal" : "removals"})`,
  );
  console.log(
    `  visual pointers: ${report.visuals.occurrences} occurrences, ` +
      `${report.visuals.unique} unique; assets and sidecars OK`,
  );
  console.log(
    `  underscore-prefixed Markdown templates: ${report.templates} OK`,
  );
  console.log(
    "  structural validators: active baseline, isolated drafts, merged overlay OK",
  );
  for (const [label, validator] of Object.entries(report.validators)) {
    if (validator.stdout) console.log(`  ${label}:\n${validator.stdout}`);
    if (validator.stderr)
      console.error(`  ${label} stderr:\n${validator.stderr}`);
  }
  console.log("  offline import schema/preflight: merged overlay OK; writes=0");
  if (report.importCheck.stdout) {
    console.log(`  merged import dry-run:\n${report.importCheck.stdout}`);
  }
  if (report.importCheck.stderr) {
    console.error(
      `  merged import dry-run stderr:\n${report.importCheck.stderr}`,
    );
  }
  console.log(
    "  manifest, drafts, staged canon, and resolved asset hashes unchanged",
  );
  console.log("  active canon hashes unchanged");
  console.log("  temporary staging directory removed");
}

try {
  const { slug, canonOnly, manifestRelative } = parseArgs(
    process.argv.slice(2),
  );
  if (canonOnly) {
    await verifyCanonOnly(slug);
  } else {
    await verifyOverlay(slug, manifestRelative);
  }
} catch (error) {
  console.error(`verify-draft-overlay: ${errorMessage(error)}`);
  process.exitCode = 1;
}
