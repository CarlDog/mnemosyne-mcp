import { describe, expect, it } from "vitest";

// @ts-expect-error plain ESM script without types
import { lint, parseFrontmatter } from "../scripts/prose-lint.mjs";

type Finding = { level: string; rule: string; message: string; line: number };
type Result = { findings: Finding[]; errors: number; warnings: number };

const brief = parseFrontmatter(`---
chapter: 3
head: guest
tense: present
house: true
must_not_know:
  - Noor
  - Andrea
forbidden_terms: [audited, "do not agree"]
---
body`) as Record<string, unknown>;

describe("prose-lint", () => {
  it("parses block and inline lists from brief frontmatter", () => {
    expect(brief.must_not_know).toEqual(["Noor", "Andrea"]);
    expect(brief.forbidden_terms).toEqual(["audited", "do not agree"]);
    expect(brief.house).toBe("true");
  });

  it("passes clean prose", () => {
    const r = lint(
      "# 3. The house\n\nThe guest wakes before the light and lies still.\n",
      brief,
    ) as Result;
    expect(r.errors).toBe(0);
  });

  it("flags prolepsis, editorial vocabulary, refrains, and engine naming", () => {
    const text =
      "# x\n\nShe would later regret it. After the cutoff nothing changed. That was the thing. The horror of it was plain.\n";
    const r = lint(text, {}) as Result;
    const rules = r.findings.map((f) => f.rule);
    expect(rules).toContain("5 prolepsis");
    expect(rules).toContain("6 editorial vocabulary");
    expect(rules).toContain("17 banned refrain");
    expect(rules).toContain("7 engine named");
    expect(r.errors).toBe(4);
  });

  it("flags what the head cannot know and brief-forbidden terms as whole words", () => {
    const text =
      "# x\n\nThe guest thought of Noor and of the sentence: do not agree. Andrean cheese.\n";
    const r = lint(text, brief) as Result;
    const msgs = r.findings.map((f) => f.message);
    expect(msgs.some((m) => m.includes('"Noor"'))).toBe(true);
    expect(msgs.some((m) => m.includes('"do not agree"'))).toBe(true);
    // "Andrean" must not match "Andrea"
    expect(msgs.some((m) => m.includes('"Andrea"'))).toBe(false);
  });

  it("rejects a house chapter that opens on a pronoun", () => {
    const r = lint("# 3\n\nShe wakes before the light.\n", brief) as Result;
    expect(r.findings.some((f) => f.rule === "4 anchoring")).toBe(true);
  });

  it("warns past the simile budget and never fails on warnings alone", () => {
    const text =
      "# x\n\nHe moved the way a cat moves, as one moves, the way water moves, as a woman moves.\n";
    const r = lint(text, {}) as Result;
    expect(r.errors).toBe(0);
    expect(r.warnings).toBeGreaterThan(0);
    expect(r.findings[0]?.rule).toBe("18 simile budget");
  });

  it("does not lint the DRAFT CONTROL RECORD header note", () => {
    const text =
      "> **DRAFT CONTROL RECORD — NOT ACTIVE CANON**\n>\n> Engines: heat and horror; the cutoff.\n\n# x\n\nClean prose.\n";
    const r = lint(text, {}) as Result;
    expect(r.errors).toBe(0);
  });
});
