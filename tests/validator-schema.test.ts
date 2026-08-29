// Schema-constrained, runtime-validated verdicts
// (docs/OLLAMA_ADOPTION_ASSESSMENT.md §3, P0). Before this, the verdict
// shape existed only in the prompt plus a generic cast: a malformed issue
// survived, and a misspelled severity could never equal "error", so
// classifyVerdict() reported clean. Pinned here:
//   1. validateContent rejects every malformed-verdict class instead of
//      coercing it into an empty clean report.
//   2. The structured path sends Ollama's top-level `format` field with the
//      literal JSON Schema (and not inside options).
//   3. The hand-maintained JSON Schema and the zod schema cannot drift:
//      keys, required lists, and the severity enum are compared
//      programmatically.

import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import {
  validateContent,
  ValidationReportSchema,
  VALIDATION_REPORT_JSON_SCHEMA,
} from "../src/validator.js";
import {
  OllamaProvider,
  type GeneratedBeat,
  type LlmGenerateOptions,
  type LlmProvider,
} from "../src/llm.js";
import type { ContextBundle } from "../src/prompt.js";

const emptyContext: ContextBundle = {
  rules: [],
  style: [],
  characters: [],
  locations: [],
  scenes: [],
  lore: [],
  worldbuilding: [],
};

function stubReturning(text: string): LlmProvider {
  return { name: "stub-validator", generate: async () => ({ text }) };
}

const validIssue = {
  severity: "error",
  rule: "past tense only",
  violating_text: "she walks in",
  explanation: "present tense violates the past-tense rule",
};

describe("validateContent rejects malformed verdicts", () => {
  const rejects = async (payload: unknown, pattern: RegExp) => {
    await expect(
      validateContent(
        stubReturning(
          typeof payload === "string" ? payload : JSON.stringify(payload),
        ),
        emptyContext,
        "content",
      ),
    ).rejects.toThrow(pattern);
  };

  it("misspelled severity", async () => {
    await rejects(
      { issues: [{ ...validIssue, severity: "eror" }], summary: "s" },
      /malformed verdict/,
    );
  });

  it("missing required issue field", async () => {
    const noExplanation: Partial<typeof validIssue> = { ...validIssue };
    delete noExplanation.explanation;
    await rejects(
      { issues: [noExplanation], summary: "s" },
      /malformed verdict/,
    );
  });

  it("wrong type for issues", async () => {
    await rejects({ issues: "none", summary: "s" }, /malformed verdict/);
  });

  it("empty violating_text (no quote, no issue)", async () => {
    await rejects(
      { issues: [{ ...validIssue, violating_text: "" }], summary: "s" },
      /malformed verdict/,
    );
  });

  it("extra field at the issue level", async () => {
    await rejects(
      { issues: [{ ...validIssue, confidence: 0.9 }], summary: "s" },
      /malformed verdict/,
    );
  });

  it("extra field at the report level", async () => {
    await rejects(
      { issues: [], summary: "s", verdict: "clean" },
      /malformed verdict/,
    );
  });

  it("missing summary", async () => {
    await rejects({ issues: [] }, /malformed verdict/);
  });

  it("truncated JSON", async () => {
    await rejects('{"issues": [{"severity": "err', /unparseable JSON/);
  });
});

describe("validateContent accepts well-formed verdicts", () => {
  it("a valid report with issues", async () => {
    const report = await validateContent(
      stubReturning(JSON.stringify({ issues: [validIssue], summary: "one" })),
      emptyContext,
      "content",
    );
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.severity).toBe("error");
  });

  it("a valid empty-issues report", async () => {
    const report = await validateContent(
      stubReturning(JSON.stringify({ issues: [], summary: "clean" })),
      emptyContext,
      "content",
    );
    expect(report.issues).toEqual([]);
  });

  it("legacy fenced JSON still parses", async () => {
    const report = await validateContent(
      stubReturning(
        "```json\n" +
          JSON.stringify({ issues: [], summary: "clean" }) +
          "\n```",
      ),
      emptyContext,
      "content",
    );
    expect(report.summary).toBe("clean");
  });
});

describe("structured-output path", () => {
  it("uses generateStructured with the literal JSON Schema when the provider supports it", async () => {
    let receivedFormat: unknown;
    const structured: LlmProvider & {
      generateStructured: (
        opts: LlmGenerateOptions,
        format: Record<string, unknown>,
      ) => Promise<GeneratedBeat>;
    } = {
      name: "stub-structured",
      generate: async () => {
        throw new Error(
          "plain generate must not be used when structured is available",
        );
      },
      generateStructured: async (_opts, format) => {
        receivedFormat = format;
        return { text: JSON.stringify({ issues: [], summary: "clean" }) };
      },
    };
    const report = await validateContent(structured, emptyContext, "content");
    expect(report.summary).toBe("clean");
    expect(receivedFormat).toBe(VALIDATION_REPORT_JSON_SCHEMA);
  });

  it("Ollama sends format at the TOP LEVEL of the request, not inside options", async () => {
    const realFetch = globalThis.fetch;
    let body: Record<string, unknown> | undefined;
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) => {
      body = JSON.parse(init?.body as string) as Record<string, unknown>;
      return {
        ok: true,
        json: async () => ({
          message: { content: '{"issues": [], "summary": "clean"}' },
          done: true,
          done_reason: "stop",
        }),
      };
    }) as unknown as typeof fetch;
    try {
      const provider = new OllamaProvider({
        url: "http://127.0.0.1:1",
        defaultModel: "test-model",
      });
      await provider.generateStructured(
        { systemPrompt: "s", userMessage: "u" },
        VALIDATION_REPORT_JSON_SCHEMA,
      );
      expect(body?.format).toEqual(VALIDATION_REPORT_JSON_SCHEMA);
      expect(
        (body?.options as Record<string, unknown> | undefined)?.format,
      ).toBeUndefined();
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe("JSON Schema / zod schema drift guard", () => {
  // The literal JSON Schema (sent to Ollama) is hand-maintained because
  // this repo is on zod 3 (no toJSONSchema). These assertions compare it
  // structurally against the zod source of truth so an edit to one copy
  // fails here until the other follows.
  const reportShape = ValidationReportSchema.shape;
  const issueShape = (reportShape.issues as z.ZodArray<z.AnyZodObject>).element
    .shape;

  it("report-level keys and required list match", () => {
    const zodKeys = Object.keys(reportShape).sort();
    expect(
      Object.keys(VALIDATION_REPORT_JSON_SCHEMA.properties).sort(),
    ).toEqual(zodKeys);
    expect([...VALIDATION_REPORT_JSON_SCHEMA.required].sort()).toEqual(zodKeys);
    expect(VALIDATION_REPORT_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  it("issue-level keys and required list match", () => {
    const zodKeys = Object.keys(issueShape).sort();
    const issueSchema = VALIDATION_REPORT_JSON_SCHEMA.properties.issues.items;
    expect(Object.keys(issueSchema.properties).sort()).toEqual(zodKeys);
    expect([...issueSchema.required].sort()).toEqual(zodKeys);
    expect(issueSchema.additionalProperties).toBe(false);
  });

  it("severity enum matches", () => {
    const zodEnum = (issueShape.severity as z.ZodEnum<[string, ...string[]]>)
      .options;
    expect([
      ...VALIDATION_REPORT_JSON_SCHEMA.properties.issues.items.properties
        .severity.enum,
    ]).toEqual([...zodEnum]);
  });
});
