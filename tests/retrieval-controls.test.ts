// OC retrieval controls (docs/RETRIEVAL_CONTROLS_DESIGN.md, ratified
// 2026-08-28), slices 1-2. Pinned here:
//   1. Pass-through: mode/phrase/pinnedLimit land verbatim in the OC
//      request (wire names mode/phrase/pinned_limit).
//   2. The relevance schema matches the CAPTURED per-mode wire shapes --
//      an object, rrf_score present only in hybrid mode, absent entirely
//      on pinned-floated rows -- on a search-specific schema, so
//      memory_get/list results are unaffected.
//   3. Phrase-first overwrite lookup: an exact-name entity the hybrid
//      window misses is still found (and updated, not duplicated).

import { describe, it, expect, afterEach } from "vitest";
import { OcClient, type OcMemory } from "../src/oc-client.js";
import { saveEntity } from "../src/entities.js";
import {
  isVagueDirection,
  buildEnrichedQuery,
  gatherContext,
  ENRICHMENT_EXCERPT_MAX_CHARS,
} from "../src/prompt.js";

const STORY_ID = "11111111-2222-4333-8444-555555555555";

function memory(content: string, id = "m1"): OcMemory {
  return {
    id,
    content,
    project_id: STORY_ID,
    tags: ["mnemosyne", "story", "character"],
    pinned: false,
    created_at: "2026-01-01T00:00:00Z",
  };
}

/** OcClient with the network layer replaced by a recording stub. */
function stubbedOc(
  respond: (name: string, args: Record<string, unknown>) => unknown,
): {
  oc: OcClient;
  calls: Array<{ name: string; args: Record<string, unknown> }>;
} {
  const oc = new OcClient(new URL("http://127.0.0.1:1"));
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  (oc as unknown as { connected: boolean }).connected = true;
  (oc as unknown as { client: unknown }).client = {
    callTool: async ({
      name,
      arguments: args,
    }: {
      name: string;
      arguments: Record<string, unknown>;
    }) => {
      calls.push({ name, args });
      return { structuredContent: respond(name, args) };
    },
  };
  return { oc, calls };
}

describe("search option pass-through", () => {
  it("mode/phrase/pinned_limit land verbatim; omitted stays omitted", async () => {
    const { oc, calls } = stubbedOc(() => []);
    await oc.memorySearch({
      query: "aria",
      projectId: STORY_ID,
      mode: "keyword",
      phrase: true,
      pinnedLimit: 0,
    });
    await oc.memorySearch({ query: "aria" });
    expect(calls[0]?.args).toMatchObject({
      query: "aria",
      mode: "keyword",
      phrase: true,
      pinned_limit: 0,
    });
    expect(calls[1]?.args).not.toHaveProperty("mode");
    expect(calls[1]?.args).not.toHaveProperty("phrase");
    expect(calls[1]?.args).not.toHaveProperty("pinned_limit");
  });
});

describe("relevance schema (captured per-mode wire shapes)", () => {
  const fixtures = [
    // hybrid: rrf_score present
    {
      ...memory("[Character] Aria\n\nbody"),
      relevance: {
        channel: "hybrid",
        rrf_score: 0.032,
        semantic_similarity: 0.55,
        keyword_rank: 1,
      },
    },
    // keyword: NO rrf_score
    {
      ...memory("[Character] Brin\n\nbody", "m2"),
      relevance: { channel: "keyword", keyword_rank: 2 },
    },
    // semantic: NO rrf_score
    {
      ...memory("[Character] Cade\n\nbody", "m3"),
      relevance: { channel: "semantic", semantic_similarity: 0.48 },
    },
    // pinned-floated row: relevance ABSENT entirely
    memory("[Character] Dara\n\nbody", "m4"),
  ];

  it("parses every captured shape and preserves the object", async () => {
    const { oc } = stubbedOc(() => fixtures);
    const rows = await oc.memorySearch({ query: "x" });
    expect(rows).toHaveLength(4);
    expect(rows[0]?.relevance?.rrf_score).toBe(0.032);
    expect(rows[1]?.relevance?.keyword_rank).toBe(2);
    expect(rows[1]?.relevance?.rrf_score).toBeUndefined();
    expect(rows[2]?.relevance?.semantic_similarity).toBe(0.48);
    expect(rows[3]?.relevance).toBeUndefined();
  });

  it("memory_get keeps the base schema (no relevance field expected)", async () => {
    const { oc } = stubbedOc(() => memory("[Character] Aria\n\nbody"));
    const row = await oc.memoryGet("m1");
    expect(row?.id).toBe("m1");
    expect(row).not.toHaveProperty("relevance");
  });
});

describe("phrase-first overwrite lookup", () => {
  it("finds an exact-name entity the hybrid window misses and updates it", async () => {
    const header = memory("[Character] Aria\n\nThe real header memory.", "hit");
    const { oc, calls } = stubbedOc((name, args) => {
      if (name === "memory_search" && args.phrase === true) return [header];
      if (name === "memory_search") return []; // hybrid window crowded out
      if (name === "memory_update")
        return { ...header, content: args.content as string };
      throw new Error(`unexpected tool ${name}`);
    });
    const result = await saveEntity(oc, STORY_ID, {
      type: "character",
      name: "Aria",
      body: "Updated body.",
    });
    expect(result.created).toBe(false);
    expect(result.memory_id).toBe("hit");
    // Phrase search ran FIRST, with keyword mode.
    expect(calls[0]?.args).toMatchObject({ mode: "keyword", phrase: true });
    // No create happened.
    expect(calls.map((c) => c.name)).not.toContain("memory_save");
  });

  it("falls back to the hybrid search when the phrase pass misses", async () => {
    const { oc, calls } = stubbedOc((name, args) => {
      if (name === "memory_search" && args.phrase === true) return [];
      if (name === "memory_search")
        return [memory("[Character] Aria\n\nvia hybrid", "hyb")];
      if (name === "memory_update")
        return memory("[Character] Aria\n\nUpdated.", "hyb");
      throw new Error(`unexpected tool ${name}`);
    });
    const result = await saveEntity(oc, STORY_ID, {
      type: "character",
      name: "Aria",
      body: "Updated.",
    });
    expect(result.memory_id).toBe("hyb");
    expect(calls.filter((c) => c.name === "memory_search").length).toBe(2);
  });
});

// --- slice 3: vague-direction enrichment (flag-off by default) -------------

afterEach(() => {
  delete process.env.MNEMO_QUERY_ENRICHMENT;
});

describe("isVagueDirection (ratified heuristic)", () => {
  const names = ["Aria Voss", "The Docks"];
  it.each([
    ["continue", true],
    ["Go on.", true],
    ["What happens next?", true],
    ["Aria Voss dies", false], // short but rich: entity-name token
    ["zzz ambush now", true], // short, no known name
    ["keep going with whatever feels right", false], // long = not vague
  ])("%s -> %s", (direction, expected) => {
    expect(isVagueDirection(direction, names)).toBe(expected);
  });
});

describe("buildEnrichedQuery", () => {
  it("puts the direction FIRST and hard-bounds the excerpt tail", () => {
    const body = "x".repeat(500) + "THE-TAIL";
    const q = buildEnrichedQuery("go on", "Scene 9", body);
    expect(q.startsWith("go on\n")).toBe(true);
    expect(q).toContain("THE-TAIL");
    const excerpt = q.slice(q.indexOf("Scene 9: ") + "Scene 9: ".length);
    expect(excerpt.length).toBeLessThanOrEqual(ENRICHMENT_EXCERPT_MAX_CHARS);
  });
});

function enrichmentOc(): {
  oc: OcClient;
  searches: Array<{ query: string; tags?: string[] }>;
  listCalls: number;
} {
  const state = {
    oc: undefined as unknown as OcClient,
    searches: [] as Array<{ query: string; tags?: string[] }>,
    listCalls: 0,
  };
  const sceneRow = (id: string, createdAt: string, tags: string[]) => ({
    id,
    content_preview: `[Scene] ${id}`,
    content_length: 100,
    project_id: STORY_ID,
    tags,
    pinned: false,
    created_at: createdAt,
  });
  state.oc = {
    memorySearch: async (opts: { query: string; tags?: string[] }) => {
      state.searches.push({ query: opts.query, tags: opts.tags });
      return [];
    },
    memoryListCompact: async () => {
      state.listCalls += 1;
      return [
        {
          id: "char-row",
          content_preview: "[Character] Aria Voss",
          content_length: 50,
          project_id: STORY_ID,
          tags: ["mnemosyne", "story", "character"],
          pinned: false,
          created_at: "2026-01-01T00:00:00Z",
        },
        // newest scene is validation:errors -> must be SKIPPED
        sceneRow("Scene Bad", "2026-01-03T00:00:00Z", [
          "mnemosyne",
          "story",
          "scene",
          "validation:errors",
        ]),
        sceneRow("Scene Good", "2026-01-02T00:00:00Z", [
          "mnemosyne",
          "story",
          "scene",
        ]),
      ];
    },
    memoryGet: async (id: string) =>
      ({
        id,
        content: `[Scene] ${id}

The rain kept falling on the docks.`,
        project_id: STORY_ID,
        tags: ["mnemosyne", "story", "scene"],
        pinned: false,
        created_at: "2026-01-02T00:00:00Z",
      }) satisfies OcMemory,
  } as unknown as OcClient;
  return state;
}

describe("gatherContext enrichment wiring", () => {
  it("flag off (default): no compact scan, raw query everywhere (query-ranked)", async () => {
    const state = enrichmentOc();
    await gatherContext(state.oc, STORY_ID, "go on", {
      sceneStrategy: "query-ranked",
    });
    expect(state.listCalls).toBe(0);
    expect(state.searches.every((s) => s.query === "go on")).toBe(true);
  });

  it("flag on + vague: reference queries are enriched from the newest NON-errors scene; rules stay raw", async () => {
    process.env.MNEMO_QUERY_ENRICHMENT = "true";
    const state = enrichmentOc();
    await gatherContext(state.oc, STORY_ID, "go on", {
      sceneStrategy: "query-ranked",
    });
    const byTag = (tag: string) =>
      state.searches.filter((s) => s.tags?.includes(tag));
    expect(byTag("rule")[0]?.query).toBe("go on");
    const charQuery = byTag("character")[0]?.query ?? "";
    expect(charQuery.startsWith("go on\n")).toBe(true);
    // Skipped the newer validation:errors scene; enriched from Scene Good.
    expect(charQuery).toContain("Scene Good");
    expect(charQuery).toContain("rain kept falling");
    expect(charQuery).not.toContain("Scene Bad");
  });

  it("flag on + information-rich short direction: untouched (entity-name condition)", async () => {
    process.env.MNEMO_QUERY_ENRICHMENT = "true";
    const state = enrichmentOc();
    await gatherContext(state.oc, STORY_ID, "Aria Voss dies", {
      sceneStrategy: "query-ranked",
    });
    expect(state.searches.every((s) => s.query === "Aria Voss dies")).toBe(
      true,
    );
  });
});
