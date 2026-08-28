// mnemo_export_story(out_path) and mnemo_import_story(file_path) resolve a
// caller-supplied path and read/write it with the server process's full
// authority. Under stdio that is a local-operator capability. The HTTP
// transport registers the SAME tool surface, so without a guard an HTTP caller
// could read or write anywhere the process can.
//
// docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §1; STATUS.md lists it under Known Gaps.
//
// These tests pin the guard itself and both of its answers, because the risk
// here is a silent default: a future refactor that drops the argument would
// otherwise re-open the hole with every test still green.

import { describe, it, expect } from "vitest";
import { assertFilesystemPathAllowed } from "../src/tools/helpers.js";

describe("assertFilesystemPathAllowed", () => {
  it("permits a caller-supplied path when paths are allowed (stdio)", () => {
    expect(() => assertFilesystemPathAllowed(true, "out_path")).not.toThrow();
  });

  it("refuses a caller-supplied path when they are not (HTTP)", () => {
    expect(() => assertFilesystemPathAllowed(false, "out_path")).toThrow(
      /refused over the HTTP transport/,
    );
  });

  it("names the offending field so the caller knows what to drop", () => {
    expect(() => assertFilesystemPathAllowed(false, "file_path")).toThrow(
      /`file_path`/,
    );
    expect(() => assertFilesystemPathAllowed(false, "out_path")).toThrow(
      /`out_path`/,
    );
  });

  it("tells the caller what to do instead, not just that it failed", () => {
    // A refusal that does not say "omit it, or use stdio" just looks broken.
    expect(() => assertFilesystemPathAllowed(false, "out_path")).toThrow(
      /Omit it .*default location, or run the server over stdio/,
    );
  });

  it("refuses on the exact boolean, never on truthiness of a stray value", () => {
    // Guards that accept anything falsy drift into accepting undefined from a
    // caller that simply forgot to thread the argument.
    expect(() => assertFilesystemPathAllowed(false, "x")).toThrow();
    expect(() => assertFilesystemPathAllowed(true, "x")).not.toThrow();
  });
});
