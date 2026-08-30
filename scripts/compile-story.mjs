// Deterministic canon authoring compiler + offline import-contract check.
//
// Usage:
//   node scripts/compile-story.mjs <slug> [--dir <canon-dir>] [--check]
//   node scripts/compile-story.mjs <slug> [--dir <canon-dir>] --out <file>
//     [--story-name <name>] [--story-created-at <iso>]
//     [--exported-at <iso>]
//
// With no mode flag, --check is implied. Check mode performs no writes: it
// compiles the directory in memory, serializes a mnemosyne_export:1 document,
// then submits that document to the built server's real parseExportDocument()
// and planImport() preflight with an empty destination set. --out does the same
// proof first, then creates one new file with exclusive-create semantics.

import {
  lstat,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const IMPORT_MODULE = new URL("../dist/import.js", import.meta.url);
const STORY_DATA_ROOT = path.join(REPO_ROOT, "data", "stories");
const TYPE_ORDER = [
  "character",
  "location",
  "rule",
  "style",
  "scene",
  "lore",
  "worldbuilding",
];
const ONE_FILE_CATEGORIES = new Map([
  ["character", "characters"],
  ["location", "locations"],
  ["scene", "scenes"],
  ["lore", "lore"],
  ["worldbuilding", "worldbuilding"],
]);
const IMPORT_FIELDS = new Set(["name", "pinned", "tags", "created_at"]);
const BASE_TAGS = ["mnemosyne", "story"];
const OC_MEMORY_CONTENT_CAP = 100_000;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const FRONTMATTER_KEY_RE = /^([a-z_][a-z0-9_]*):\s*(.*)$/;
const BATCH_METADATA_RE =
  /^<!--\s*mnemosyne-meta:\s*(\{[^\r\n]*\})\s*-->\s*(?:\n|$)/;
const BATCH_METADATA_DIRECTIVE_RE = /<!--\s*mnemosyne-meta\b/i;
const SCENE_CATALOG_KEY_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+){3}$/;
const ISO_WITH_OFFSET_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const DRAFT_RESIDUE_RE =
  /DRAFT — NOT ACTIVE CANON|DRAFT CONTROL RECORD|^\s*>\s*\*\*DRAFT\b/gm;
const CHECK_SENTINEL_TIME = "1970-01-01T00:00:00.000Z";

const LABEL_OVERRIDES = new Map([
  ["birthday_zodiac_sign", "Birthday / Zodiac Sign"],
  ["nationality_accent", "Nationality / Accent"],
  ["pronouns_gender_identity", "Pronouns / Gender Identity"],
  ["sexual_romantic_orientation", "Sexual / Romantic Orientation"],
  ["voice_speech", "Voice / Speech"],
  ["voice_speech_style", "Voice / Speech Style"],
]);

export class CanonCompileError extends Error {
  constructor(message) {
    super(message);
    this.name = "CanonCompileError";
  }
}

function fail(message) {
  throw new CanonCompileError(message);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeNewlines(text) {
  return text.replace(/\r\n?/g, "\n");
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
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

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32"
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
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

async function readUtf8(file, label) {
  const bytes = await readFile(file);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    fail(`${label}: not valid UTF-8 (${errorMessage(error)})`);
  }
}

function assertNoDraftResidue(text, label) {
  DRAFT_RESIDUE_RE.lastIndex = 0;
  if (DRAFT_RESIDUE_RE.test(text)) {
    fail(`${label}: contains a draft/control marker and is not import-ready`);
  }
}

function assertIsoTimestamp(value, label) {
  if (
    typeof value !== "string" ||
    !ISO_WITH_OFFSET_RE.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    fail(`${label}: expected an ISO datetime with Z or an explicit offset`);
  }
  return value;
}

function parseInlineArray(value, label) {
  if (!value.endsWith("]")) {
    fail(`${label}: inline array is missing its closing bracket`);
  }
  const body = value.slice(1, -1).trim();
  if (!body) return [];
  const tokens = [];
  let token = "";
  let quoted = false;
  let escaped = false;
  for (const character of body) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quoted) {
      token += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      token += character;
      quoted = !quoted;
      continue;
    }
    if (character === "," && !quoted) {
      tokens.push(token.trim());
      token = "";
      continue;
    }
    token += character;
  }
  if (quoted || escaped) fail(`${label}: unterminated quoted array item`);
  const finalToken = token.trim();
  if (finalToken) {
    tokens.push(finalToken);
  } else if (!body.trimEnd().endsWith(",")) {
    fail(label + ": array item cannot be empty");
  }

  return tokens.map((item, index) => {
    if (!item) fail(`${label}[${index}]: array item cannot be empty`);
    if (item.startsWith('"')) {
      try {
        const parsed = JSON.parse(item);
        if (typeof parsed !== "string" || /\r|\n/.test(parsed)) {
          fail(`${label}[${index}]: quoted array item must be one line`);
        }
        return parsed;
      } catch (error) {
        if (error instanceof CanonCompileError) throw error;
        fail(
          `${label}[${index}]: malformed quoted item (${errorMessage(error)})`,
        );
      }
    }
    if (/[[\]{}]/.test(item) || item.startsWith("'")) {
      fail(
        `${label}[${index}]: nested or single-quoted values are unsupported`,
      );
    }
    if (item === "true") return true;
    if (item === "false") return false;
    if (item === "null") fail(`${label}[${index}]: null is not valid metadata`);
    return item;
  });
}

function parseFrontmatterValue(raw, label) {
  const value = raw.trim();
  if (!value) fail(`${label}: frontmatter value cannot be empty`);

  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        for (const [index, item] of parsed.entries()) {
          if (
            item === null ||
            !["string", "number", "boolean"].includes(typeof item) ||
            (typeof item === "string" && /\r|\n/.test(item))
          ) {
            fail(`${label}[${index}]: arrays may contain only scalar values`);
          }
        }
        return parsed;
      }
    } catch (error) {
      if (error instanceof CanonCompileError) throw error;
      return parseInlineArray(value, label);
    }
    fail(`${label}: bracketed metadata must be an inline array`);
  }

  if (value.startsWith('"')) {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      fail(
        `${label}: malformed JSON-style frontmatter value (${errorMessage(error)})`,
      );
    }
    if (typeof parsed === "string") {
      if (/\r|\n/.test(parsed)) fail(`${label}: string contains a line break`);
      return parsed;
    }
    fail(`${label}: quoted metadata must decode to a string`);
  }

  if (value.startsWith("'")) {
    if (value.length < 2 || !value.endsWith("'")) {
      fail(`${label}: unterminated single-quoted frontmatter value`);
    }
    const body = value.slice(1, -1);
    let parsed = "";
    for (let index = 0; index < body.length; index += 1) {
      const character = body[index];
      if (character !== "'") {
        parsed += character;
        continue;
      }
      if (body[index + 1] !== "'") {
        fail(
          `${label}: single quotes inside a single-quoted YAML value must be doubled`,
        );
      }
      parsed += "'";
      index += 1;
    }
    return parsed;
  }

  if (value.startsWith("{")) {
    fail(
      `${label}: nested objects are unsupported; use a quoted scalar or array`,
    );
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") fail(`${label}: null is not valid metadata`);
  return value;
}

export function parseCanonFrontmatter(rawText, label = "entity") {
  const text = normalizeNewlines(rawText);
  assertNoDraftResidue(text, label);
  if (!text.startsWith("---\n")) {
    fail(`${label}: does not start with YAML frontmatter`);
  }
  const lines = text.split("\n");
  let closingLine = -1;
  const fields = new Map();
  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];
    if (line === "---") {
      closingLine = index;
      break;
    }
    if (!line.trim()) continue;
    const match = line.match(FRONTMATTER_KEY_RE);
    if (!match) {
      fail(
        `${label}:${index + 1}: invalid frontmatter line ${JSON.stringify(line)}`,
      );
    }
    const key = match[1];
    if (fields.has(key)) {
      fail(
        `${label}:${index + 1}: duplicate frontmatter key ${JSON.stringify(key)}`,
      );
    }
    let rawValue = match[2];
    if (!rawValue.trim() && lines[index + 1]?.trimStart().startsWith("[")) {
      index += 1;
      rawValue = lines[index].trim();
    }
    const valueStart = rawValue.trimStart();
    if (valueStart.startsWith("[") && !valueStart.trimEnd().endsWith("]")) {
      const parts = [rawValue];
      let closed = false;
      while (index + 1 < lines.length) {
        index += 1;
        const continuation = lines[index];
        if (continuation === "---") {
          fail(
            label +
              ":" +
              (index + 1) +
              ":" +
              key +
              ": inline array is missing its closing bracket",
          );
        }
        parts.push(continuation.trim());
        if (continuation.trimEnd().endsWith("]")) {
          closed = true;
          break;
        }
      }
      if (!closed) {
        fail(
          label +
            ":" +
            (index + 1) +
            ":" +
            key +
            ": inline array is missing its closing bracket",
        );
      }
      rawValue = parts.join(" ");
    }
    fields.set(
      key,
      parseFrontmatterValue(rawValue, `${label}:${index + 1}:${key}`),
    );
  }
  if (closingLine === -1) {
    fail(`${label}: frontmatter opened but never closed`);
  }

  const bodyLines = lines.slice(closingLine + 1);
  if (bodyLines[0] === "") bodyLines.shift();
  const body = bodyLines.join("\n").trimEnd();
  return { fields, body };
}

function requireStringField(fields, key, label) {
  const value = fields.get(key);
  if (typeof value !== "string" || !value.trim() || /\r|\n/.test(value)) {
    fail(`${label}: frontmatter ${key} must be a non-empty one-line string`);
  }
  return value;
}

function optionalPinned(fields, type, label) {
  if (!fields.has("pinned")) return type === "rule";
  const value = fields.get("pinned");
  if (typeof value !== "boolean") {
    fail(`${label}: frontmatter pinned must be true or false`);
  }
  return value;
}

function buildRecordTags(fields, type, label) {
  const extras = fields.get("tags") ?? [];
  if (!Array.isArray(extras)) {
    fail(`${label}: frontmatter tags must be a JSON-style array of strings`);
  }
  const tags = [...BASE_TAGS, type];
  const seen = new Set(tags);
  for (const [index, tag] of extras.entries()) {
    if (typeof tag !== "string" || !tag.trim() || /\r|\n/.test(tag)) {
      fail(`${label}: tags[${index}] must be a non-empty one-line string`);
    }
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

function createdAtFromFields(fields, label, required) {
  const value = fields.get("created_at");
  if (value === undefined) {
    if (required) fail(`${label}: scene frontmatter requires created_at`);
    return undefined;
  }
  return assertIsoTimestamp(value, `${label}:created_at`);
}

function metadataLabel(key) {
  const override = LABEL_OVERRIDES.get(key);
  if (override) return override;
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function renderMetadataValue(value) {
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

function renderEntityContent(fields, body, type) {
  if (type === "scene") return body;
  const metadata = [];
  for (const [key, value] of fields) {
    if (IMPORT_FIELDS.has(key)) continue;
    metadata.push(`${metadataLabel(key)}: ${renderMetadataValue(value)}`);
  }
  return metadata.length > 0 ? `${metadata.join("\n")}\n\n${body}` : body;
}

function assertRecordFits(record, label) {
  const storedLength =
    record.type.length + record.name.length + record.content.length + 5;
  if (storedLength > OC_MEMORY_CONTENT_CAP) {
    fail(
      `${label}: compiled record exceeds OC's ${OC_MEMORY_CONTENT_CAP.toLocaleString("en-US")}-char ` +
        `stored-memory cap (${storedLength.toLocaleString("en-US")} chars including header)`,
    );
  }
}

function makeRecord(type, name, content, fields, label, requireTimestamp) {
  if (!content.trim()) fail(`${label}: entity body is empty`);
  const record = {
    type,
    name,
    content,
    pinned: optionalPinned(fields, type, label),
    tags: buildRecordTags(fields, type, label),
  };
  const createdAt = createdAtFromFields(fields, label, requireTimestamp);
  if (createdAt) record.created_at = createdAt;
  assertRecordFits(record, label);
  return record;
}

async function collectMarkdownFiles(root, relativeDir) {
  const start = path.join(root, relativeDir);
  const startStat = await lstatOrNull(start);
  if (!startStat) return [];
  if (startStat.isSymbolicLink() || !startStat.isDirectory()) {
    fail(`${toPosix(relativeDir)}: expected a real directory, not a link`);
  }

  const files = [];
  async function walk(directory, relative) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const lower = entry.name.toLowerCase();
      if (
        entry.isDirectory() &&
        (entry.name === "_control" || entry.name.startsWith("_"))
      ) {
        continue;
      }
      if (
        lower === "readme.md" ||
        (entry.name.startsWith("_") && lower.endsWith(".md"))
      ) {
        continue;
      }
      const file = path.join(directory, entry.name);
      const childRelative = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) {
        fail(`${toPosix(childRelative)}: symbolic links are not compiled`);
      }
      if (entry.isDirectory()) {
        await walk(file, childRelative);
      } else if (entry.isFile() && lower.endsWith(".md")) {
        files.push(childRelative);
      }
    }
  }
  await walk(start, relativeDir);
  return files.sort((left, right) =>
    toPosix(left).localeCompare(toPosix(right), "en"),
  );
}

async function compileOneFile(root, type, relativePath) {
  const label = toPosix(relativePath);
  const text = await readUtf8(path.join(root, relativePath), label);
  const { fields, body } = parseCanonFrontmatter(text, label);
  const name = requireStringField(fields, "name", label);

  if (type === "scene") {
    const catalogKey = requireStringField(fields, "catalog_key", label);
    if (!SCENE_CATALOG_KEY_RE.test(catalogKey)) {
      fail(`${label}: invalid scene catalog_key ${JSON.stringify(catalogKey)}`);
    }
    const expectedPrefix = `${catalogKey.toLowerCase()}--`;
    if (!path.basename(relativePath).startsWith(expectedPrefix)) {
      fail(`${label}: filename must begin ${JSON.stringify(expectedPrefix)}`);
    }
  }

  const content = renderEntityContent(fields, body, type);
  return makeRecord(type, name, content, fields, label, type === "scene");
}

function parseBatchSections(rawText, label, { preservePreamble = false } = {}) {
  const text = normalizeNewlines(rawText);
  assertNoDraftResidue(text, label);
  if (text.startsWith("---\n")) {
    fail(`${label}: batched entity files must not have frontmatter`);
  }
  const lines = text.split("\n");
  const headings = [];
  let fence = null;
  for (let index = 0; index < lines.length; index++) {
    if (fence !== null) {
      const closingFence = lines[index].match(/^\s*(`{3,}|~{3,})\s*$/);
      if (
        closingFence &&
        closingFence[1][0] === fence.marker &&
        closingFence[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    const openingFence = lines[index].match(/^\s*(`{3,}|~{3,})/);
    if (openingFence) {
      fence = {
        marker: openingFence[1][0],
        length: openingFence[1].length,
        line: index + 1,
      };
      continue;
    }
    const heading = lines[index].match(/^##\s+(.+?)\s*$/);
    if (heading) {
      headings.push({ index, name: heading[1].trim() });
    } else if (/^##\s*$/.test(lines[index])) {
      fail(`${label}:${index + 1}: empty level-two heading`);
    }
  }
  if (fence !== null) {
    fail(`${label}:${fence.line}: unterminated fenced code block`);
  }
  if (headings.length === 0) {
    fail(`${label}: exists but contains no level-two entity headings`);
  }
  const preamble = lines.slice(0, headings[0].index).join("\n").trim();
  if (preamble && !preservePreamble) {
    fail(
      `${label}: contains non-entity content before its first level-two heading`,
    );
  }
  if (BATCH_METADATA_DIRECTIVE_RE.test(preamble)) {
    fail(
      `${label}: mnemosyne-meta directives are not allowed before the first entity heading`,
    );
  }

  return headings.map((heading, index) => {
    const end = headings[index + 1]?.index ?? lines.length;
    const rawSectionContent = lines
      .slice(heading.index + 1, end)
      .join("\n")
      .trim();
    if (!heading.name || /\r|\n/.test(heading.name)) {
      fail(`${label}:${heading.index + 1}: invalid entity name`);
    }
    if (BATCH_METADATA_DIRECTIVE_RE.test(heading.name)) {
      fail(
        `${label}:${heading.index + 1}: mnemosyne-meta directives are not allowed in entity headings`,
      );
    }
    if (!rawSectionContent) {
      fail(
        `${label}:${heading.index + 1}: ${JSON.stringify(heading.name)} has an empty body`,
      );
    }
    const metadataMatch = rawSectionContent.match(BATCH_METADATA_RE);
    const fields = new Map();
    let sectionContent = rawSectionContent;
    if (metadataMatch) {
      let metadata;
      try {
        metadata = JSON.parse(metadataMatch[1]);
      } catch (error) {
        fail(
          label +
            ":" +
            (heading.index + 2) +
            ": invalid mnemosyne-meta JSON (" +
            errorMessage(error) +
            ")",
        );
      }
      if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata)
      ) {
        fail(
          label +
            ":" +
            (heading.index + 2) +
            ": mnemosyne-meta must be a JSON object",
        );
      }
      for (const key of Object.keys(metadata)) {
        if (key !== "pinned" && key !== "tags" && key !== "created_at") {
          fail(
            label +
              ":" +
              (heading.index + 2) +
              ": unsupported mnemosyne-meta key " +
              JSON.stringify(key),
          );
        }
      }
      if ("pinned" in metadata) {
        if (typeof metadata.pinned !== "boolean") {
          fail(
            label +
              ":" +
              (heading.index + 2) +
              ": mnemosyne-meta pinned must be boolean",
          );
        }
        fields.set("pinned", metadata.pinned);
      }
      if ("tags" in metadata) {
        if (
          !Array.isArray(metadata.tags) ||
          metadata.tags.some(
            (tag) =>
              typeof tag !== "string" || !tag.trim() || /\r|\n/.test(tag),
          )
        ) {
          fail(
            label +
              ":" +
              (heading.index + 2) +
              ": mnemosyne-meta tags must be non-empty one-line strings",
          );
        }
        fields.set("tags", metadata.tags);
      }
      if ("created_at" in metadata) {
        fields.set(
          "created_at",
          assertIsoTimestamp(
            metadata.created_at,
            `${label}:${heading.index + 2}:mnemosyne-meta created_at`,
          ),
        );
      }
      sectionContent = rawSectionContent.slice(metadataMatch[0].length).trim();
      if (!sectionContent) {
        fail(
          label +
            ":" +
            (heading.index + 1) +
            ": " +
            JSON.stringify(heading.name) +
            " has metadata but no body",
        );
      }
    }
    if (BATCH_METADATA_DIRECTIVE_RE.test(sectionContent)) {
      fail(
        `${label}:${heading.index + 1}: ${JSON.stringify(heading.name)} has a misplaced or duplicate mnemosyne-meta directive; at most one is allowed, immediately after the heading`,
      );
    }
    // `_minor.md` may carry a batch-wide retrieval qualification before its
    // first entity (for example, what a Region label does and does not prove).
    // Every batched character becomes an independent OC record, so repeat that
    // qualification in each record instead of silently dropping or orphaning it.
    const content = preamble
      ? `${preamble}\n\n${sectionContent}`
      : sectionContent;
    return { name: heading.name, content, fields };
  });
}

async function compileBatchFile(
  root,
  relativePath,
  type,
  { preservePreamble = false } = {},
) {
  const file = path.join(root, relativePath);
  const fileStat = await lstatOrNull(file);
  if (!fileStat) return [];
  const label = toPosix(relativePath);
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    fail(`${label}: expected a real file, not a link`);
  }
  const sections = parseBatchSections(await readUtf8(file, label), label, {
    preservePreamble,
  });
  return sections.map(({ name, content, fields }) =>
    makeRecord(type, name, content, fields, `${label}:## ${name}`, false),
  );
}

function assertUniqueRecords(records) {
  const seen = new Map();
  for (const [index, record] of records.entries()) {
    const key = `${record.type}\u0000${record.name.toLocaleLowerCase("en")}`;
    const first = seen.get(key);
    if (first) {
      fail(
        `duplicate (${record.type}, ${JSON.stringify(record.name)}) compiled from ` +
          `record ${first.index} (${JSON.stringify(first.name)}) and record ${index}`,
      );
    }
    seen.set(key, { index, name: record.name });
  }
}

export async function compileCanonDirectory({ slug, dir }) {
  if (!SLUG_RE.test(slug)) {
    fail(`invalid story slug ${JSON.stringify(slug)}`);
  }
  const root = path.resolve(dir);
  const rootStat = await lstatOrNull(root);
  if (!rootStat) fail(`${root}: canon directory does not exist`);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    fail(`${root}: canon root must be a real directory, not a link`);
  }

  const recordsByType = new Map(TYPE_ORDER.map((type) => [type, []]));
  for (const [type, category] of ONE_FILE_CATEGORIES) {
    const files = await collectMarkdownFiles(root, category);
    for (const relativePath of files) {
      recordsByType
        .get(type)
        .push(await compileOneFile(root, type, relativePath));
    }
  }
  recordsByType.get("character").push(
    ...(await compileBatchFile(root, "characters/_minor.md", "character", {
      preservePreamble: true,
    })),
  );
  recordsByType
    .get("rule")
    .push(...(await compileBatchFile(root, "rules.md", "rule")));
  recordsByType
    .get("style")
    .push(...(await compileBatchFile(root, "style.md", "style")));

  const records = TYPE_ORDER.flatMap((type) => recordsByType.get(type));
  if (records.length === 0)
    fail(`${root}: canon directory contains no entities`);
  assertUniqueRecords(records);

  const counts = Object.fromEntries(
    TYPE_ORDER.map((type) => [type, recordsByType.get(type).length]).filter(
      ([, count]) => count > 0,
    ),
  );
  return { slug, dir: root, records, counts };
}

export function buildCompiledExportDocument({
  records,
  storyName,
  storyCreatedAt,
  exportedAt,
}) {
  if (
    typeof storyName !== "string" ||
    !storyName.trim() ||
    /\r|\n/.test(storyName)
  ) {
    fail("story name must be a non-empty one-line string");
  }
  assertIsoTimestamp(storyCreatedAt, "story created_at");
  assertIsoTimestamp(exportedAt, "exported_at");
  return {
    mnemosyne_export: 1,
    exported_at: exportedAt,
    story: { name: storyName, created_at: storyCreatedAt },
    entities: records.map((record) => ({ ...record, tags: [...record.tags] })),
  };
}

export function checkImportCompatibility(document, contract) {
  if (
    !contract ||
    typeof contract.parseExportDocument !== "function" ||
    typeof contract.planImport !== "function"
  ) {
    fail("import contract must provide parseExportDocument() and planImport()");
  }
  const parsed = contract.parseExportDocument(JSON.stringify(document));
  const plan = contract.planImport(parsed.records, new Set(), "error");
  if (plan.aborted) {
    const details = plan.entries
      .filter((entry) => entry.status !== "create")
      .map(
        (entry) =>
          `${entry.type}:${entry.name}=${entry.status}${entry.reason ? ` (${entry.reason})` : ""}`,
      )
      .join("; ");
    fail(
      `existing import preflight rejected compiled records: ${plan.aborted}${details ? `: ${details}` : ""}`,
    );
  }
  if (plan.entries.some((entry) => entry.status !== "create")) {
    fail("existing import preflight returned a non-create status unexpectedly");
  }
  return {
    dry_run: true,
    total_written: 0,
    records: parsed.records.length,
    statuses: { create: plan.entries.length },
  };
}

async function loadBuiltImportContract() {
  try {
    return await import(`${IMPORT_MODULE.href}?compile-check=${Date.now()}`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error.code === "ERR_MODULE_NOT_FOUND" ||
        error.code === "MODULE_NOT_FOUND")
    ) {
      fail(
        "the offline check uses the built server's real import schema/preflight, " +
          "but dist/import.js is missing; run `npm run build:server` first",
      );
    }
    fail(`could not load the built import contract: ${errorMessage(error)}`);
  }
}

async function loadStoryIdentity(slug) {
  const storyFile = path.join(STORY_DATA_ROOT, slug, "story.json");
  const storyStat = await lstatOrNull(storyFile);
  if (!storyStat) return null;
  if (storyStat.isSymbolicLink() || !storyStat.isFile()) {
    fail(`${storyFile}: story identity must be a real file, not a link`);
  }
  let parsed;
  try {
    parsed = JSON.parse(await readUtf8(storyFile, storyFile));
  } catch (error) {
    if (error instanceof CanonCompileError) throw error;
    fail(`${storyFile}: invalid JSON (${errorMessage(error)})`);
  }
  if (
    parsed?.mnemosyne_story !== 1 ||
    parsed?.slug !== slug ||
    typeof parsed?.story?.name !== "string" ||
    typeof parsed?.story?.created_at !== "string"
  ) {
    fail(`${storyFile}: invalid or mismatched mnemosyne story identity`);
  }
  assertIsoTimestamp(parsed.story.created_at, `${storyFile}:story.created_at`);
  return { name: parsed.story.name, createdAt: parsed.story.created_at };
}

function humanizeSlug(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseArgs(argv) {
  const [slug, ...rest] = argv;
  if (!slug || !SLUG_RE.test(slug)) {
    fail(
      "usage: node scripts/compile-story.mjs <slug> [--dir <canon-dir>] " +
        "[--check | --out <file>] [--story-name <name>] " +
        "[--story-created-at <iso>] [--exported-at <iso>]",
    );
  }
  const opts = {
    slug,
    dir: path.join(STORY_DATA_ROOT, slug, "canon"),
    check: false,
    out: null,
    storyName: null,
    storyCreatedAt: null,
    exportedAt: null,
  };
  const valueFlags = new Map([
    ["--dir", "dir"],
    ["--out", "out"],
    ["--story-name", "storyName"],
    ["--story-created-at", "storyCreatedAt"],
    ["--exported-at", "exportedAt"],
  ]);
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--check") {
      opts.check = true;
      continue;
    }
    const key = valueFlags.get(arg);
    if (!key) fail(`unknown argument: ${arg}`);
    const value = rest[++index];
    if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
    opts[key] = value;
  }
  if (opts.check && opts.out) fail("--check and --out are mutually exclusive");
  if (!opts.out) opts.check = true;
  return opts;
}

export async function writeCompiledExport(file, document, sourceDir) {
  const resolved = path.resolve(file);
  if (samePath(sourceDir, resolved) || isWithin(sourceDir, resolved)) {
    fail(
      `refusing to write an export inside its source canon directory: ${resolved}`,
    );
  }
  const parent = path.dirname(resolved);
  const parentStat = await lstatOrNull(parent);
  if (!parentStat || parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    fail(`output parent must already exist as a real directory: ${parent}`);
  }
  const realSourceDir = await realpath(path.resolve(sourceDir));
  const realParent = await realpath(parent);
  const realOutput = path.join(realParent, path.basename(resolved));
  if (
    samePath(realSourceDir, realOutput) ||
    isWithin(realSourceDir, realOutput)
  ) {
    fail(
      `refusing to write an export inside its source canon directory: ${resolved}`,
    );
  }
  try {
    await writeFile(realOutput, `${JSON.stringify(document, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      fail(`refusing to overwrite existing output: ${resolved}`);
    }
    throw error;
  }
  return resolved;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const compiled = await compileCanonDirectory(opts);
  const identity = await loadStoryIdentity(opts.slug);
  if (opts.out && !identity && (!opts.storyName || !opts.storyCreatedAt)) {
    fail(
      "writing requires data/stories/<slug>/story.json or both " +
        "--story-name and --story-created-at",
    );
  }
  const document = buildCompiledExportDocument({
    records: compiled.records,
    storyName: opts.storyName ?? identity?.name ?? humanizeSlug(opts.slug),
    storyCreatedAt:
      opts.storyCreatedAt ?? identity?.createdAt ?? CHECK_SENTINEL_TIME,
    exportedAt:
      opts.exportedAt ??
      (opts.check ? CHECK_SENTINEL_TIME : new Date().toISOString()),
  });
  const contract = await loadBuiltImportContract();
  const check = checkImportCompatibility(document, contract);

  let output = null;
  if (opts.out) {
    output = await writeCompiledExport(opts.out, document, compiled.dir);
  }
  console.log(
    `${opts.check ? "Checked" : "Compiled"} ${opts.slug} -> ${compiled.dir}`,
  );
  console.log(`  entities: ${compiled.records.length}`);
  for (const type of TYPE_ORDER) {
    const count = compiled.counts[type];
    if (count) console.log(`  ${type}: ${count}`);
  }
  console.log(
    `  import contract: schema accepted; dry-run planned ${check.records} creates; writes=0`,
  );
  if (output)
    console.log(
      `  output: ${output} (created; existing files are never overwritten)`,
    );
}

const invokedAsScript =
  process.argv[1] !== undefined &&
  samePath(fileURLToPath(pathToFileURL(process.argv[1])), SCRIPT_FILE);

if (invokedAsScript) {
  await main().catch((error) => {
    console.error(`compile-story: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
