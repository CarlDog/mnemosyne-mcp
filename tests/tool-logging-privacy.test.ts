// Privacy-safe tool logging (OpenClaw assessment §7): narrative prose --
// entity content, scene directions -- must not be default telemetry on a
// private storytelling server designed for mature material. The old invoke
// line logged the first 200 chars of every long string at info and the FULL
// args at debug. Pinned here:
//   1. sanitizeToolArgsForLog replaces prose fields and long strings with
//      lengths, arrays with counts, and passes short identifiers through.
//   2. withLogging emits NO story text to stderr by default, even at
//      LOG_LEVEL=debug -- full args require the MNEMO_LOG_CONTENT=true
//      opt-in.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  sanitizeToolArgsForLog,
  withLogging,
  asText,
} from "../src/tools/helpers.js";

const PROSE = "She pressed the sigil into the doorframe and the ward woke.";

describe("sanitizeToolArgsForLog", () => {
  it("replaces prose fields with lengths even when short", () => {
    expect(
      sanitizeToolArgsForLog({ content: PROSE, direction: "kiss her" }),
    ).toEqual({
      content: `(${PROSE.length} chars)`,
      direction: "(8 chars)",
    });
  });

  it("replaces any long string with its length (unanticipated prose)", () => {
    const long = "x".repeat(500);
    expect(sanitizeToolArgsForLog({ query: long })).toEqual({
      query: "(500 chars)",
    });
  });

  it("passes short identifiers, numbers, and booleans through", () => {
    expect(
      sanitizeToolArgsForLog({
        type: "character",
        name: "Aria Voss",
        story: "chaos-saga",
        max_tokens: 2048,
        validate: true,
      }),
    ).toEqual({
      type: "character",
      name: "Aria Voss",
      story: "chaos-saga",
      max_tokens: 2048,
      validate: true,
    });
  });

  it("replaces arrays with element counts (import entities carry whole bodies)", () => {
    expect(
      sanitizeToolArgsForLog({ entities: [{ body: PROSE }, { body: PROSE }] }),
    ).toEqual({ entities: "(2 items)" });
  });
});

describe("withLogging emits no story text by default", () => {
  const savedContent = process.env.MNEMO_LOG_CONTENT;
  afterEach(() => {
    if (savedContent === undefined) delete process.env.MNEMO_LOG_CONTENT;
    else process.env.MNEMO_LOG_CONTENT = savedContent;
    vi.restoreAllMocks();
  });

  const handler = withLogging("mnemo_test", async () => asText({ ok: true }));
  const stubExtra = { signal: new AbortController().signal };

  it("no stderr line contains the prose without the opt-in", async () => {
    delete process.env.MNEMO_LOG_CONTENT;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await handler({ direction: PROSE, content: PROSE }, stubExtra);
    const lines = spy.mock.calls.map((c) => String(c[0]));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain("sigil");
    }
  });

  it("MNEMO_LOG_CONTENT=true is the explicit opt-in for full args", async () => {
    process.env.MNEMO_LOG_CONTENT = "true";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await handler({ direction: PROSE }, stubExtra);
    const lines = spy.mock.calls.map((c) => String(c[0]));
    // The full-args line goes through log.debug; under the default info
    // level it is suppressed by the logger, so the opt-in alone still
    // emits no prose at LOG_LEVEL=info -- both env gates must be open.
    // What we can pin regardless of the suite's LOG_LEVEL: nothing at
    // info level carries the prose.
    const infoLines = lines.filter((l) => l.includes(" INFO "));
    for (const line of infoLines) {
      expect(line).not.toContain("sigil");
    }
  });
});
