// One-time migration: read a story's export JSON (optionally merging in a
// sibling revision that forked from the same parent -- see --merge), and
// write the multi-file data/stories/<slug>/canon/ tree docs/DATA_LAYOUT.md
// documents. This is the scaffold half of the canon/ workflow; the compile
// half is scripts/compile-story.mjs, which performs the deterministic offline
// import-contract check without importing or mutating OpenChronicle.
//
// Usage:
//   node scripts/scaffold-story.mjs <slug> --base <export.json> \
//     [--merge <file>|<ancestor>] [--out <dir>] [--core-threshold <n>]
//
// --merge <file>|<ancestor> resolves a sibling-revision fork: both <file>
// and the base must trace back to the same <ancestor> export. Separated by
// "|", not ":" -- a colon collides with a Windows drive letter the moment
// someone passes an absolute path instead of a relative one, and "|" is
// illegal in a Windows filename so it can never be ambiguous. For each
// entity, if <file>'s content is <ancestor>'s content plus a clean
// trailing suffix, and the base's version of that entity doesn't already
// contain that suffix, the suffix is appended to the base's content.
// Entities where <file> is NOT a clean append over <ancestor> are left
// alone and reported -- this tool never guesses at a real merge conflict.
//
// Known limitation: only `character` entities get real frontmatter
// extraction (parsed from their leading "Label: value" header lines) and
// heading normalization toward the unified template's section names.
// location/lore/worldbuilding entities are written one-file-per-entity
// with a minimal `name:` frontmatter and their body kept verbatim --
// their own header conventions (bold-label lines, italic taglines) differ
// enough from characters' that a shared parser would be guessing, not
// parsing.

import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toCanonScalar } from "./canon-frontmatter.mjs";
import {
  buildCompiledExportDocument,
  checkImportCompatibility,
  compileCanonDirectory,
} from "./compile-story.mjs";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const STORY_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const ENTITY_TYPES = new Set([
  "character",
  "location",
  "lore",
  "worldbuilding",
  "rule",
  "style",
  "scene",
]);
const OUTPUT_DIRS = [
  "characters",
  "locations",
  "lore",
  "lore/objects",
  "worldbuilding",
];
const WINDOWS_RESERVED_BASENAME_RE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const ISO_WITH_OFFSET_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const BASE_TAGS = ["mnemosyne", "story"];
const CHECK_SENTINEL_TIME = "1970-01-01T00:00:00.000Z";
const IMPORT_MODULE = new URL("../dist/import.js", import.meta.url);

function requireArgValue(rest, index, flag) {
  const value = rest[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseArgs(argv) {
  const [slug, ...rest] = argv;
  const opts = { merges: [], out: null, coreThreshold: 2500 };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--base") opts.base = requireArgValue(rest, i++, a);
    else if (a === "--merge") {
      opts.merges.push(requireArgValue(rest, i++, a));
    } else if (a === "--out") opts.out = requireArgValue(rest, i++, a);
    else if (a === "--core-threshold") {
      opts.coreThreshold = Number(requireArgValue(rest, i++, a));
    } else throw new Error(`unknown arg: ${a}`);
  }
  if (!slug || !STORY_SLUG_RE.test(slug) || !opts.base) {
    throw new Error(
      "usage: node scripts/scaffold-story.mjs <slug> --base <export.json> " +
        "[--merge <file>|<ancestor>] [--out <dir>] [--core-threshold <n>]",
    );
  }
  if (!Number.isSafeInteger(opts.coreThreshold) || opts.coreThreshold < 0) {
    throw new Error("--core-threshold must be a non-negative integer");
  }
  opts.out ??= path.join(REPO_ROOT, "data", "stories", slug, "canon");
  return { slug, ...opts };
}

// type never contains a space (it's one of mnemosyne's fixed entity-type
// strings), so splitting on the FIRST space cleanly separates it from a
// name that may itself contain spaces -- unlike a naive split(" ") on every
// space, which mangles any multi-word name.
function splitKey(k) {
  const i = k.indexOf(" ");
  return i === -1 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)];
}

async function loadExport(file) {
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${file}: could not read export (${message})`, {
      cause: error,
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${file}: could not read valid JSON (${message})`, {
      cause: error,
    });
  }
  try {
    const contract = await loadBuiltImportContract();
    contract.parseExportDocument(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${file}: ${message}`, { cause: error });
  }
  return parsed;
}

function key(e) {
  return `${e.type} ${e.name}`;
}

function portableIdentityKey(entity) {
  return `${entity.type.normalize("NFC").toLowerCase()}\0${entity.name
    .normalize("NFC")
    .toLowerCase()}`;
}

function validateEntity(entity, index, sourceLabel) {
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
    throw new Error(`${sourceLabel}: entities[${index}] must be an object`);
  }
  if (typeof entity.type !== "string" || !ENTITY_TYPES.has(entity.type)) {
    throw new Error(
      `${sourceLabel}: entities[${index}].type is not a supported entity type`,
    );
  }
  if (
    typeof entity.name !== "string" ||
    !entity.name.trim() ||
    entity.name !== entity.name.trim()
  ) {
    throw new Error(
      `${sourceLabel}: entities[${index}].name must be a non-empty trimmed string`,
    );
  }
  if (typeof entity.content !== "string" || !entity.content.trim()) {
    throw new Error(
      `${sourceLabel}: entities[${index}].content must be a non-empty string`,
    );
  }
  if (entity.pinned !== undefined && typeof entity.pinned !== "boolean") {
    throw new Error(
      `${sourceLabel}: entities[${index}].pinned must be true or false`,
    );
  }
  if (
    entity.tags !== undefined &&
    (!Array.isArray(entity.tags) ||
      entity.tags.some(
        (tag) => typeof tag !== "string" || !tag.trim() || /\r|\n/.test(tag),
      ))
  ) {
    throw new Error(
      `${sourceLabel}: entities[${index}].tags must be non-empty one-line strings`,
    );
  }
  if (
    entity.created_at !== undefined &&
    (typeof entity.created_at !== "string" ||
      !ISO_WITH_OFFSET_RE.test(entity.created_at) ||
      Number.isNaN(Date.parse(entity.created_at)))
  ) {
    throw new Error(
      `${sourceLabel}: entities[${index}].created_at must be an ISO datetime with Z or an explicit offset`,
    );
  }
}

function toMap(exportDoc, sourceLabel) {
  if (!exportDoc || !Array.isArray(exportDoc.entities)) {
    throw new Error(`${sourceLabel}: export must contain an entities array`);
  }
  const m = new Map();
  const identities = new Map();
  for (let index = 0; index < exportDoc.entities.length; index += 1) {
    const entity = exportDoc.entities[index];
    validateEntity(entity, index, sourceLabel);
    const identity = portableIdentityKey(entity);
    if (identities.has(identity)) {
      throw new Error(
        `${sourceLabel}: duplicate entity identity ${entity.type} ${JSON.stringify(
          entity.name,
        )} at entities[${identities.get(identity)}] and entities[${index}]`,
      );
    }
    identities.set(identity, index);
    m.set(key(entity), { ...entity });
  }
  return m;
}

// Resolves a fork: for every entity in mergeMap, both the merge and base must
// retain the ancestor as an exact prefix before a clean merge-only suffix can
// be appended. A divergent base stays untouched and is reported for manual
// resolution. Mutates baseMap in place. Returns a report.
function mergeFork(baseMap, mergeMap, ancestorMap, sourceLabel) {
  const report = {
    appended: [],
    skippedAlreadyPresent: [],
    notCleanAppend: [],
    baseDivergedFromAncestor: [],
    newInMerge: [],
  };
  for (const [k, mergeEntity] of mergeMap) {
    const ancestorEntity = ancestorMap.get(k);
    const baseEntity = baseMap.get(k);
    if (!ancestorEntity) {
      report.newInMerge.push(k);
      continue;
    }
    if (!mergeEntity.content.startsWith(ancestorEntity.content)) {
      report.notCleanAppend.push(k);
      continue;
    }
    const suffix = mergeEntity.content.slice(ancestorEntity.content.length);
    if (!suffix.trim()) continue;
    if (!baseEntity) continue; // entity doesn't exist in base at all -- leave for human review
    if (!baseEntity.content.startsWith(ancestorEntity.content)) {
      report.baseDivergedFromAncestor.push(k);
      continue;
    }
    const baseTail = baseEntity.content.slice(ancestorEntity.content.length);
    if (baseTail.includes(suffix)) {
      report.skippedAlreadyPresent.push(k);
      continue;
    }
    baseEntity.content += suffix;
    report.appended.push({
      key: k,
      source: sourceLabel,
      suffixPreview: suffix.slice(0, 80),
    });
  }
  return report;
}

// Matches a clean "Label: value" line -- the label is letters/spaces/slash
// only (covers "Voice / Speech", "Sexual/Romantic Orientation", etc.) and
// the value is non-empty. Shared by the per-line frontmatter pass and the
// paragraph-level bare-section detection below.
const FIELD_LINE_RE = /^([A-Za-z][A-Za-z /]*):\s*(.+)$/;

// A label like "Birthday / Zodiac Sign" or "Sexual/Romantic Orientation"
// would otherwise become the frontmatter key "birthday_/_zodiac_sign" --
// valid YAML, but ugly enough to look broken. Collapse the slash (with any
// surrounding spaces) into the same single underscore a space would get,
// instead of preserving it as its own token.
function fmKeyFromLabel(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, "_")
    .replace(/\s+/g, "_");
}

// Matches a "Label:" line with NOTHING after the colon -- a bare section
// label. Wider label charset than FIELD_LINE_RE (digits, &, /, apostrophe,
// parens, en/em dash) because a template's section titles run richer than
// its single-value fields ("TATTOOS & INK:", "ARCHIVE BACKSTORY (excavated
// from the raw transcripts):", "MOTORCYCLE CANON — MADDOX'S ANTIQUE INDIAN
// SCOUT:").
const BARE_LABEL_RE = /^([A-Za-z][A-Za-z0-9 &/'()–—-]*):\s*$/;

// Splits a character's content into a leading header block and the
// remaining Markdown body. Stops at the first blank line followed by a
// `## ` heading, or the first `## ` heading if there's no blank line.
//
// The header block is grouped into blank-line-delimited paragraphs before
// parsing, because some stories' original templates (Chaos Saga, unlike
// BattleChasers) use a flat "Label:\n<prose>" shape for whole multi-
// paragraph sections (Backstory, Anchor Wound, Relationships, ...) instead
// of this project's usual "## Heading" convention. A paragraph whose first
// line is a bare label (FIELD_LINE_RE would need a value; this one has
// none) with more content beneath it is exactly that shape, so it's
// rendered as a real "## Label" section rather than flattened into an
// undifferentiated blob alongside the simple one-line fields. Every other
// paragraph is parsed line-by-line as before: a line matching "Label:
// value" becomes a frontmatter field, anything else is folded onto the
// front of the body verbatim rather than dropped -- silently discarding a
// line that didn't parse is exactly the kind of loss this whole tool
// exists to prevent.
function splitHeaderBody(content) {
  const lines = content.split("\n");
  let splitAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      splitAt = i;
      break;
    }
  }
  const headerLines = lines.slice(0, splitAt);
  let body = lines.slice(splitAt).join("\n").trim();

  const paragraphs = [];
  let current = [];
  for (const raw of headerLines) {
    if (raw.trim() === "") {
      if (current.length) paragraphs.push(current);
      current = [];
    } else {
      current.push(raw);
    }
  }
  if (current.length) paragraphs.push(current);

  const frontmatter = {};
  const bodyParts = [];
  for (const para of paragraphs) {
    const bare = para[0].match(BARE_LABEL_RE);
    if (bare && para.length > 1) {
      bodyParts.push(`## ${bare[1].trim()}\n\n${para.slice(1).join("\n")}`);
      continue;
    }
    const unparsed = [];
    for (const line of para) {
      const m = line.match(FIELD_LINE_RE);
      if (m) {
        frontmatter[fmKeyFromLabel(m[1])] = m[2].trim();
      } else {
        unparsed.push(line);
      }
    }
    if (unparsed.length > 0) bodyParts.push(unparsed.join("\n"));
  }
  if (bodyParts.length > 0) {
    body = body
      ? `${bodyParts.join("\n\n")}\n\n${body}`
      : bodyParts.join("\n\n");
  }
  return { frontmatter, body };
}

const HEADING_RENAMES = new Map([
  ["## interpersonal dynamics:", "## Relationships"],
  ["## interpersonal dynamics", "## Relationships"],
  ["## tattoos/piercings:", "## Tattoos / Piercings"],
  ["## tattoos/piercings", "## Tattoos / Piercings"],
  ["## tattoos & ink:", "## Tattoos / Piercings"],
  ["## tattoos & ink", "## Tattoos / Piercings"],
  ["## scene behavior & live hooks:", "## Hooks"],
  ["## scene behavior & live hooks", "## Hooks"],
]);

function normalizeHeadings(body) {
  return body
    .split("\n")
    .map((line) => {
      const lower = line.trim().toLowerCase();
      return HEADING_RENAMES.get(lower) ?? line;
    })
    .join("\n");
}

function renderFrontmatter(fields) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    const rendered =
      typeof v === "string" ? toCanonScalar(v) : JSON.stringify(v);
    lines.push(`${k}: ${rendered}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function canonicalRecordMetadata(entity) {
  const tags = [...BASE_TAGS, entity.type];
  const seen = new Set(tags);
  for (const tag of entity.tags ?? []) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return {
    pinned: entity.pinned ?? entity.type === "rule",
    tags,
    created_at: entity.created_at,
  };
}

function authoringImportMetadata(entity) {
  const metadata = {};
  if (entity.pinned !== undefined) metadata.pinned = entity.pinned;
  if (entity.tags !== undefined) {
    const base = new Set([...BASE_TAGS, entity.type]);
    metadata.tags = [...new Set(entity.tags.filter((tag) => !base.has(tag)))];
  }
  if (entity.created_at !== undefined) metadata.created_at = entity.created_at;
  return metadata;
}

function batchMetadataDirective(entity) {
  const metadata = authoringImportMetadata(entity);
  return Object.keys(metadata).length > 0
    ? `<!-- mnemosyne-meta: ${JSON.stringify(metadata)} -->\n\n`
    : "";
}

// Diacritics (e.g. "Karl von Jäger") must be transliterated before the
// non-alphanumeric strip, or the accented letter is discarded entirely --
// "jäger" -> "j-ger" instead of "jager". NFD decomposition splits the base
// letter from its combining accent mark, which the second regex then drops.
function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function checkedSlug(entity) {
  const slug = slugify(entity.name);
  if (!slug) {
    throw new Error(
      `${key(entity)} cannot produce a non-empty portable filename slug`,
    );
  }
  if (WINDOWS_RESERVED_BASENAME_RE.test(slug)) {
    throw new Error(
      `${key(entity)} produces reserved portable filename slug ${JSON.stringify(slug)}`,
    );
  }
  if (Buffer.byteLength(`${slug}.md`, "utf8") > 255) {
    throw new Error(`${key(entity)} produces a filename longer than 255 bytes`);
  }
  return slug;
}

function renderCoreCharacter(entity) {
  const { frontmatter, body } = splitHeaderBody(entity.content);
  // The export entity key is the runtime identity. Preserve a differing
  // embedded `Name:` as the established `current_name` display field rather
  // than letting it silently replace the key and create a second character.
  const embeddedName = frontmatter.name;
  if (embeddedName && embeddedName !== entity.name) {
    if (
      frontmatter.current_name !== undefined &&
      frontmatter.current_name !== embeddedName
    ) {
      throw new Error(
        `${key(entity)} has conflicting embedded Name and Current Name fields`,
      );
    }
    frontmatter.current_name = embeddedName;
  }
  frontmatter.name = entity.name;
  Object.assign(frontmatter, authoringImportMetadata(entity));
  const slug = checkedSlug(entity);
  return {
    relativePath: `characters/${slug}.md`,
    content: `${renderFrontmatter(frontmatter)}\n\n${normalizeHeadings(body)}\n`,
  };
}

// A minor entity's own content sometimes contains its own "## " sub-headings
// (e.g. "## Visual Presence" / "## Encounter Presence") -- demote those to
// "### " so they can't be mistaken for the next entity's heading. Without
// this, a batched file has no way to tell "new entity" from "subsection of
// the current one" apart, since both are bare "## " lines.
function demoteHeadings(body) {
  return body.replace(/^## /gm, "### ");
}

function appendMinorCharacter(minorLines, entity) {
  minorLines.push(
    `## ${entity.name}\n\n${batchMetadataDirective(entity)}${demoteHeadings(
      entity.content.trim(),
    )}\n`,
  );
}

function renderSimpleEntity(subdir, entity) {
  const slug = checkedSlug(entity);
  return {
    relativePath: `${subdir}/${slug}.md`,
    content: `${renderFrontmatter({
      name: entity.name,
      ...authoringImportMetadata(entity),
    })}\n\n${entity.content.trim()}\n`,
  };
}

function portableOutputKey(relativePath) {
  return relativePath.replaceAll("\\", "/").normalize("NFC").toLowerCase();
}

function addPlannedFile(files, owners, file, owner) {
  const collisionKey = portableOutputKey(file.relativePath);
  const previous = owners.get(collisionKey);
  if (previous) {
    throw new Error(
      `output path collision at ${file.relativePath}: ${previous} and ${owner}`,
    );
  }
  owners.set(collisionKey, owner);
  files.push(file);
}

export function buildScaffoldPlan(baseMap, coreThreshold) {
  const files = [];
  const owners = new Map();
  const written = {
    core: [],
    minor: 0,
    locations: [],
    lore: [],
    worldbuilding: [],
  };
  const minorLines = [];
  const rulesLines = [];
  const styleLines = [];
  const expectedIdentities = new Map();
  const expectedMetadata = new Map();

  for (const entity of baseMap.values()) {
    if (entity.type !== "scene") {
      const identity = portableIdentityKey(entity);
      expectedIdentities.set(identity, key(entity));
      expectedMetadata.set(identity, {
        label: key(entity),
        ...canonicalRecordMetadata(entity),
      });
    }
    if (entity.type === "character") {
      if (entity.content.length >= coreThreshold) {
        const file = renderCoreCharacter(entity);
        addPlannedFile(files, owners, file, key(entity));
        written.core.push(file.relativePath);
      } else {
        appendMinorCharacter(minorLines, entity);
        written.minor += 1;
      }
    } else if (entity.type === "location") {
      const file = renderSimpleEntity("locations", entity);
      addPlannedFile(files, owners, file, key(entity));
      written.locations.push(file.relativePath);
    } else if (entity.type === "lore") {
      const file = renderSimpleEntity("lore", entity);
      addPlannedFile(files, owners, file, key(entity));
      written.lore.push(file.relativePath);
    } else if (entity.type === "worldbuilding") {
      const file = renderSimpleEntity("worldbuilding", entity);
      addPlannedFile(files, owners, file, key(entity));
      written.worldbuilding.push(file.relativePath);
    } else if (entity.type === "rule") {
      rulesLines.push(
        `## ${entity.name}\n\n${batchMetadataDirective(entity)}${demoteHeadings(
          entity.content.trim(),
        )}\n`,
      );
    } else if (entity.type === "style") {
      styleLines.push(
        `## ${entity.name}\n\n${batchMetadataDirective(entity)}${demoteHeadings(
          entity.content.trim(),
        )}\n`,
      );
    } else if (entity.type === "scene") {
      // Not promoted automatically: canon/scenes/ is reserved for finished,
      // locked, or explicitly established scenes. See DATA_LAYOUT.md.
    }
  }

  if (minorLines.length > 0) {
    addPlannedFile(
      files,
      owners,
      {
        relativePath: "characters/_minor.md",
        content: minorLines.join("\n"),
      },
      "minor character batch",
    );
  }
  if (rulesLines.length > 0) {
    addPlannedFile(
      files,
      owners,
      { relativePath: "rules.md", content: rulesLines.join("\n") },
      "rule batch",
    );
  }
  if (styleLines.length > 0) {
    addPlannedFile(
      files,
      owners,
      { relativePath: "style.md", content: styleLines.join("\n") },
      "style batch",
    );
  }
  if (files.length === 0) {
    throw new Error("export contains no scaffoldable canon entities");
  }

  files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, "en"),
  );
  return {
    files,
    written,
    ruleCount: rulesLines.length,
    styleCount: styleLines.length,
    expectedIdentities,
    expectedMetadata,
  };
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

async function assertTargetAbsent(outDir) {
  if (await lstatOrNull(outDir)) {
    throw new Error(
      `refusing to overwrite existing scaffold target: ${outDir}`,
    );
  }
}

function humanizeSlug(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function loadBuiltImportContract() {
  try {
    return await import(`${IMPORT_MODULE.href}?scaffold-check=${Date.now()}`);
  } catch (error) {
    throw new Error(
      "full scaffold preflight requires dist/import.js; run `npm run build:server` first",
      { cause: error },
    );
  }
}

async function preflightStagedTree(slug, stage, plan) {
  const compiled = await compileCanonDirectory({ slug, dir: stage });
  const actualRecords = new Map(
    compiled.records.map((record) => [portableIdentityKey(record), record]),
  );
  const missing = [...plan.expectedIdentities]
    .filter(([identity]) => !actualRecords.has(identity))
    .map(([, label]) => label);
  const unexpected = [...actualRecords]
    .filter(([identity]) => !plan.expectedIdentities.has(identity))
    .map(([, record]) => key(record));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `staged compiler identity mismatch` +
        `${missing.length ? `; missing: ${missing.join(", ")}` : ""}` +
        `${unexpected.length ? `; unexpected: ${unexpected.join(", ")}` : ""}`,
    );
  }

  const metadataMismatches = [];
  for (const [identity, expected] of plan.expectedMetadata) {
    const actual = actualRecords.get(identity);
    if (
      actual.pinned !== expected.pinned ||
      JSON.stringify(actual.tags) !== JSON.stringify(expected.tags) ||
      actual.created_at !== expected.created_at
    ) {
      metadataMismatches.push(expected.label);
    }
  }
  if (metadataMismatches.length > 0) {
    throw new Error(
      `staged compiler metadata mismatch: ${metadataMismatches.join(", ")}`,
    );
  }

  const document = buildCompiledExportDocument({
    records: compiled.records,
    storyName: humanizeSlug(slug),
    storyCreatedAt: CHECK_SENTINEL_TIME,
    exportedAt: CHECK_SENTINEL_TIME,
  });
  return checkImportCompatibility(document, await loadBuiltImportContract());
}

async function publishPlanAtomically(slug, outDir, plan) {
  await assertTargetAbsent(outDir);
  const parent = path.dirname(outDir);
  await mkdir(parent, { recursive: true });
  let stage = await mkdtemp(
    path.join(parent, `.${path.basename(outDir)}.scaffold-`),
  );
  try {
    for (const dir of OUTPUT_DIRS) {
      await mkdir(path.join(stage, dir), { recursive: true });
    }
    for (const file of plan.files) {
      const destination = path.join(stage, ...file.relativePath.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, file.content, {
        encoding: "utf8",
        flag: "wx",
      });
    }

    const importCheck = await preflightStagedTree(slug, stage, plan);

    // Repeat the no-overwrite check immediately before publication. rename()
    // is atomic on one filesystem; staging beside the destination keeps it on
    // that filesystem and prevents a failed write from exposing partial canon.
    await assertTargetAbsent(outDir);
    await rename(stage, outDir);
    stage = null;
    return importCheck;
  } finally {
    if (stage) await rm(stage, { recursive: true, force: true });
  }
}

export async function scaffoldStory(options) {
  const opts = { ...options, out: path.resolve(options.out) };
  await assertTargetAbsent(opts.out);

  const base = await loadExport(opts.base);
  const baseMap = toMap(base, opts.base);

  const mergeReports = [];
  for (const spec of opts.merges) {
    const parts = spec.split("|");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`--merge expects <file>|<ancestor>, got: ${spec}`);
    }
    const [mergeFile, ancestorFile] = parts;
    const mergeDoc = await loadExport(mergeFile);
    const ancestorDoc = await loadExport(ancestorFile);
    const report = mergeFork(
      baseMap,
      toMap(mergeDoc, mergeFile),
      toMap(ancestorDoc, ancestorFile),
      path.basename(mergeFile),
    );
    mergeReports.push({ source: mergeFile, ancestor: ancestorFile, ...report });
  }

  const plan = buildScaffoldPlan(baseMap, opts.coreThreshold);
  const importCheck = await publishPlanAtomically(opts.slug, opts.out, plan);
  return { ...plan, out: opts.out, mergeReports, importCheck };
}

function printReport(opts, result) {
  const { importCheck, written, mergeReports, ruleCount, styleCount } = result;

  console.log(`Scaffolded ${opts.slug} -> ${opts.out}`);
  console.log(`  core characters: ${written.core.length}`);
  console.log(`  minor characters (batched): ${written.minor}`);
  console.log(`  locations: ${written.locations.length}`);
  console.log(`  lore: ${written.lore.length}`);
  console.log(`  worldbuilding: ${written.worldbuilding.length}`);
  console.log(`  rules: ${ruleCount}, style: ${styleCount}`);
  console.log(
    `  import contract: schema accepted; dry-run planned ${importCheck.records} creates; writes=0`,
  );

  for (const r of mergeReports) {
    console.log(`\nMerge report: ${r.source} (ancestor ${r.ancestor})`);
    console.log(`  appended: ${r.appended.length}`);
    console.log(
      `  already present (skipped): ${r.skippedAlreadyPresent.length}`,
    );
    if (r.notCleanAppend.length > 0) {
      console.log(
        `  NOT a clean append -- needs manual review: ${r.notCleanAppend.length}`,
      );
      for (const k of r.notCleanAppend) {
        const [t, n] = splitKey(k);
        console.log(`    - ${t}: ${n}`);
      }
    }
    if (r.baseDivergedFromAncestor.length > 0) {
      console.log(
        `  base diverged from ancestor -- unresolved: ${r.baseDivergedFromAncestor.length}`,
      );
      for (const k of r.baseDivergedFromAncestor) {
        const [t, n] = splitKey(k);
        console.log(`    - ${t}: ${n}`);
      }
    }
    if (r.newInMerge.length > 0) {
      console.log(
        `  new in merge source (no ancestor entity) -- needs manual review: ${r.newInMerge.length}`,
      );
      for (const k of r.newInMerge) {
        const [t, n] = splitKey(k);
        console.log(`    - ${t}: ${n}`);
      }
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = await scaffoldStory(opts);
  printReport(opts, result);
}

const invokedScript = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (
  invokedScript &&
  (process.platform === "win32"
    ? invokedScript.toLowerCase() === SCRIPT_FILE.toLowerCase()
    : invokedScript === SCRIPT_FILE)
) {
  await main().catch((err) => {
    console.error(`scaffold-story: ${err.message}`);
    process.exitCode = 1;
  });
}
