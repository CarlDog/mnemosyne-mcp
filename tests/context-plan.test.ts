// Context admission (docs/CONTEXT_PLAN_DESIGN.md, ratified 2026-08-28),
// slices 1-2. Pinned here:
//   1. planContext determinism: drop tiers (untagged scenes -> clean
//      scenes -> references; protected NEVER), memory_id tie-break.
//   2. The direction counts toward fit; protected+direction over budget is
//      "rejected"; unknown budget is instrument-only.
//   3. Plan-driven rendering: a dropped entry's text is absent from the
//      rendered prompt -- the manifest cannot describe a payload the model
//      didn't see.
//   4. Enforcement mode: enforce turns a rejected plan into a pre-dispatch
//      error (zero provider calls); warn dispatches with the verdict in
//      the manifest.
//   5. Ollama slice 2: truncate:false + shift:false are TOP-LEVEL request
//      fields, num_ctx is the stable effective window (min(trained, cap)),
//      and warmup is an empty-message load at the same window.

import { describe, it, expect, vi, afterEach } from "vitest";
import { planContext, type ContextEntry } from "../src/context-plan.js";
import { renderAdmittedBundle, type ContextBundle } from "../src/prompt.js";
import { continueScene } from "./helpers/application.js";
import { OllamaProvider, type LlmProvider } from "../src/llm.js";
import type { OcClient, OcMemory } from "../src/oc-client.js";

const STORY_ID = "11111111-2222-4333-8444-555555555555";

function entry(over: Partial<ContextEntry>): ContextEntry {
  return {
    memory_id: "m",
    entity_type: "character",
    name: "N",
    tags: ["mnemosyne", "story"],
    pinned: false,
    created_at: "2026-01-01T00:00:00Z",
    chars: 350,
    est_tokens: 100,
    admission: "included",
    reason: "reference",
    ...over,
  };
}

const baseInputs = {
  provider: "ollama",
  outputReserve: 100,
  estFixedTokens: 50,
  directionChars: 35, // 10 tokens
  marginTokens: 40,
};

describe("planContext", () => {
  it("drops untagged scenes first, then clean scenes, then references; protected never", () => {
    const entries = [
      entry({ memory_id: "rule1", entity_type: "rule", reason: "protected" }),
      entry({ memory_id: "char1" }),
      entry({
        memory_id: "sceneClean",
        entity_type: "scene",
        tags: ["mnemosyne", "story", "scene", "validation:clean"],
        reason: "scene:clean",
      }),
      entry({
        memory_id: "sceneUntagged",
        entity_type: "scene",
        tags: ["mnemosyne", "story", "scene"],
        reason: "scene:untagged",
      }),
    ];
    // budgetForEntries = 500 - 100 - 50 - 10 - 40 = 300 -> fits 3 of 4.
    const { plan, admitted } = planContext(entries, {
      ...baseInputs,
      inputBudget: 500,
    });
    expect(plan.verdict).toBe("partial");
    expect(admitted.map((e) => e.memory_id)).toEqual([
      "rule1",
      "char1",
      "sceneClean",
    ]);
    // budgetForEntries = 200 -> untagged AND clean scenes drop, char stays.
    const tighter = planContext(entries, { ...baseInputs, inputBudget: 400 });
    expect(tighter.admitted.map((e) => e.memory_id)).toEqual([
      "rule1",
      "char1",
    ]);
  });

  it("memory_id is the terminal tie-break under equal relevance and timestamps", () => {
    const entries = [
      entry({ memory_id: "bbb" }),
      entry({ memory_id: "aaa" }),
      entry({ memory_id: "ccc" }),
    ];
    // Room for exactly two 100-token entries.
    const { admitted } = planContext(entries, {
      ...baseInputs,
      inputBudget: 400,
    });
    // "aaa" sorts first in drop priority (same tier/relevance/time) and
    // is dropped first; bbb + ccc stay.
    expect(admitted.map((e) => e.memory_id).sort()).toEqual(["bbb", "ccc"]);
  });

  it("the direction counts toward fit, and protected overflow is 'rejected'", () => {
    const entries = [
      entry({
        memory_id: "rule1",
        entity_type: "rule",
        est_tokens: 250,
        reason: "protected",
      }),
    ];
    const fits = planContext(entries, { ...baseInputs, inputBudget: 500 });
    expect(fits.plan.verdict).toBe("complete");
    // A huge direction alone flips it to rejected: 3500 chars = 1000 tokens.
    const rejected = planContext(entries, {
      ...baseInputs,
      directionChars: 3500,
      inputBudget: 500,
    });
    expect(rejected.plan.verdict).toBe("rejected");
    expect(rejected.plan.est_direction_tokens).toBe(1000);
  });

  it("unknown budget is instrument-only: nothing drops", () => {
    const entries = [entry({ memory_id: "a", est_tokens: 999_999 })];
    const { plan, admitted } = planContext(entries, { ...baseInputs });
    expect(plan.verdict).toBe("complete");
    expect(admitted).toHaveLength(1);
    expect(plan.input_budget).toBeUndefined();
  });
});

describe("plan-driven rendering", () => {
  it("a dropped entry's text is absent from the rendered bundle", () => {
    const bundle: ContextBundle = {
      rules: [],
      style: [],
      characters: ["Keep\nkept body", "Drop\ndropped body"],
      locations: [],
      scenes: [],
      lore: [],
      worldbuilding: [],
      entries: [
        entry({ memory_id: "keep", name: "Keep", chars: 14 }),
        entry({ memory_id: "drop", name: "Drop", chars: 17 }),
      ],
    };
    const rendered = renderAdmittedBundle(bundle, new Set(["keep"]));
    expect(rendered.characters).toEqual(["Keep\nkept body"]);
    expect(JSON.stringify(rendered)).not.toContain("dropped body");
  });
});

// --- continueScene integration with a real OllamaProvider ------------------

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.MNEMO_CONTEXT_ADMISSION;
});

const BIG_RULE_BODY = "R".repeat(8000); // ~2286 tokens

function planOc(): OcClient {
  return {
    memorySearch: async (opts: { tags?: string[] }) => {
      if (opts.tags?.includes("rule")) {
        return [
          {
            id: "rule-big",
            content: `[Rule] Big\n\n${BIG_RULE_BODY}`,
            project_id: STORY_ID,
            tags: ["mnemosyne", "story", "rule"],
            pinned: true,
            created_at: "2026-01-01T00:00:00Z",
          } satisfies OcMemory,
        ];
      }
      return [];
    },
    memoryList: async () => [],
    memorySave: async () =>
      ({
        id: "saved-1",
        content: "",
        project_id: STORY_ID,
        tags: [],
        pinned: false,
        created_at: "2026-01-01T00:00:00Z",
      }) satisfies OcMemory,
  } as unknown as OcClient;
}

function stubOllamaFetch(): {
  chatCalls: number;
  lastBody?: Record<string, unknown>;
} {
  const state = {
    chatCalls: 0,
    lastBody: undefined as Record<string, unknown> | undefined,
  };
  globalThis.fetch = vi.fn(
    async (input: URL | RequestInfo, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/show") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ model_info: { "llama.context_length": 4096 } }),
        };
      }
      if (path === "/api/ps") {
        return { ok: true, status: 200, json: async () => ({ models: [] }) };
      }
      state.chatCalls += 1;
      state.lastBody = JSON.parse(init?.body as string) as Record<
        string,
        unknown
      >;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: "A beat." },
          done: true,
          done_reason: "stop",
        }),
      };
    },
  ) as unknown as typeof fetch;
  return state;
}

const smallWindowProvider = () =>
  new OllamaProvider({
    url: "http://127.0.0.1:1",
    defaultModel: "m",
    maxContextWindow: 1024,
  });

const neverValidator: LlmProvider = {
  name: "stub-validator",
  generate: async () => {
    throw new Error("validator must not run");
  },
};

describe("continueScene admission enforcement", () => {
  it("enforce: a rejected plan performs ZERO chat calls", async () => {
    process.env.MNEMO_CONTEXT_ADMISSION = "enforce";
    const state = stubOllamaFetch();
    await expect(
      continueScene(planOc(), smallWindowProvider(), neverValidator, STORY_ID, {
        direction: "go on",
        sceneStrategy: "query-ranked",
        reinvokeHint: "call again",
      }),
    ).rejects.toMatchObject({ outcome: "rejected_before_dispatch" });
    expect(state.chatCalls).toBe(0);
  });

  it("warn (default): the same plan dispatches, with the verdict in the manifest", async () => {
    const state = stubOllamaFetch();
    const result = await continueScene(
      planOc(),
      smallWindowProvider(),
      neverValidator,
      STORY_ID,
      {
        direction: "go on",
        sceneStrategy: "query-ranked",
        reinvokeHint: "call again",
      },
    );
    expect(state.chatCalls).toBe(1);
    expect(result.context_plan?.verdict).toBe("rejected");
    expect(result.context_plan?.input_budget).toBe(1024);
  });

  it("slice 2 request contract: truncate/shift top-level, stable num_ctx = min(trained, cap)", async () => {
    const state = stubOllamaFetch();
    await continueScene(
      planOc(),
      smallWindowProvider(),
      neverValidator,
      STORY_ID,
      {
        direction: "go on",
        sceneStrategy: "query-ranked",
        reinvokeHint: "call again",
      },
    );
    expect(state.lastBody?.truncate).toBe(false);
    expect(state.lastBody?.shift).toBe(false);
    expect(
      (state.lastBody?.options as { num_ctx?: number } | undefined)?.num_ctx,
    ).toBe(1024); // min(4096 trained, 1024 cap)
  });

  it("companion selection lands in the manifest", async () => {
    const state = stubOllamaFetch();
    void state;
    const companion: LlmProvider = {
      name: "botify",
      generate: async () => ({
        text: "A beat.",
        context_selection: ["scene-1", "char-2"],
      }),
    };
    const result = await continueScene(
      planOc(),
      companion,
      neverValidator,
      STORY_ID,
      {
        direction: "go on",
        sceneStrategy: "query-ranked",
        reinvokeHint: "call again",
      },
    );
    expect(result.context_plan?.companion_selection).toEqual([
      "scene-1",
      "char-2",
    ]);
  });
});

describe("warmup (slice 2)", () => {
  it("is an empty-message load at the same effective window", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === "/api/show") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              model_info: { "llama.context_length": 4096 },
            }),
          };
        }
        if (path === "/api/ps") {
          return { ok: true, status: 200, json: async () => ({ models: [] }) };
        }
        bodies.push(
          JSON.parse(init?.body as string) as Record<string, unknown>,
        );
        return {
          ok: true,
          status: 200,
          json: async () => ({ done: true, done_reason: "load" }),
        };
      },
    ) as unknown as typeof fetch;
    await smallWindowProvider().warmup();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.messages).toEqual([]);
    expect(
      (bodies[0]?.options as { num_ctx?: number } | undefined)?.num_ctx,
    ).toBe(1024);
  });

  it("zero keep_alive skips the preload entirely", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await new OllamaProvider({
      url: "http://127.0.0.1:1",
      defaultModel: "m",
      keepAlive: "0",
    }).warmup();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
