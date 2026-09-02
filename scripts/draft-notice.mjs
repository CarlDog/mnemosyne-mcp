// The one implementation of the draft-notice rule shared by the overlay
// verifier and the promotion tool, so the bytes the verifier stages are the
// bytes promotion writes. See docs/DATA_LAYOUT.md ("Drafts"): a proposed
// Markdown entity carries `> **DRAFT — NOT ACTIVE CANON**` immediately after
// valid YAML frontmatter, or at byte zero for a file without frontmatter;
// promotion strips only that complete leading blockquote block.
import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";

export const DRAFT_BANNER = "> **DRAFT — NOT ACTIVE CANON**";
export const DRAFT_MARKER = "DRAFT — NOT ACTIVE CANON";
export const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export function readLine(text, start) {
  if (start >= text.length) {
    return { content: "", next: text.length, terminated: false };
  }
  const newline = text.indexOf("\n", start);
  if (newline === -1) {
    const content = text.slice(start).endsWith("\r")
      ? text.slice(start, -1)
      : text.slice(start);
    return { content, next: text.length, terminated: false };
  }
  const end =
    newline > start && text[newline - 1] === "\r" ? newline - 1 : newline;
  return {
    content: text.slice(start, end),
    next: newline + 1,
    terminated: true,
  };
}

function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

// Returns the promoted bytes (BOM preserved if present). `fail` is called with
// a message for every rule violation and must throw.
export function stripLeadingDraftBlockquote(bytes, relativePath, fail) {
  const hasBom = bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM);
  const payload = hasBom ? bytes.subarray(UTF8_BOM.length) : bytes;
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch (error) {
    fail(`${relativePath}: draft is not valid UTF-8 (${describeError(error)})`);
  }

  let searchOffset = 0;
  const first = readLine(text, 0);
  if (first.content === "---") {
    let cursor = first.next;
    let closed = false;
    while (cursor <= text.length) {
      const line = readLine(text, cursor);
      if (line.content.trimEnd() === DRAFT_BANNER) {
        fail(
          `${relativePath}: draft banner occurs before the YAML closing ` +
            'delimiter; frontmatter must close on its own "---" line first',
        );
      }
      if (line.content === "---") {
        if (!line.terminated && line.next === text.length) {
          fail(
            `${relativePath}: YAML closes at end of file before any draft body`,
          );
        }
        searchOffset = line.next;
        closed = true;
        break;
      }
      if (!line.terminated) break;
      cursor = line.next;
    }
    if (!closed)
      fail(`${relativePath}: YAML frontmatter opened but never closed`);
  }

  let bannerStart = searchOffset;
  while (bannerStart < text.length) {
    const line = readLine(text, bannerStart);
    if (line.content.trim() !== "") break;
    bannerStart = line.next;
  }
  const banner = readLine(text, bannerStart);
  if (banner.content.trimEnd() !== DRAFT_BANNER) {
    const location =
      first.content === "---" ? "after YAML frontmatter" : "at file start";
    fail(
      `${relativePath}: expected the leading draft blockquote ${location}; ` +
        "only a leading banner block may be stripped",
    );
  }

  let afterBlock = banner.next;
  while (afterBlock < text.length) {
    const line = readLine(text, afterBlock);
    if (!line.content.startsWith(">")) break;
    afterBlock = line.next;
  }
  if (afterBlock >= text.length) {
    fail(
      `${relativePath}: leading draft blockquote must be followed by a ` +
        "blank-line boundary and promoted body content",
    );
  }
  const boundary = readLine(text, afterBlock);
  if (boundary.content.trim() !== "") {
    fail(
      `${relativePath}: leading draft blockquote must end at a blank-line ` +
        "boundary before promoted body content",
    );
  }
  while (afterBlock < text.length) {
    const line = readLine(text, afterBlock);
    if (line.content.trim() !== "") break;
    afterBlock = line.next;
  }
  if (!text.slice(afterBlock).trim()) {
    fail(
      `${relativePath}: draft notice is not followed by promoted body content`,
    );
  }

  const promoted = text.slice(0, bannerStart) + text.slice(afterBlock);
  if (promoted.includes(DRAFT_MARKER)) {
    fail(
      `${relativePath}: draft marker remains after stripping the leading block`,
    );
  }
  const encoded = Buffer.from(promoted, "utf8");
  return hasBom ? Buffer.concat([UTF8_BOM, encoded]) : encoded;
}
