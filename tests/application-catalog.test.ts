import { describe, expect, it } from "vitest";
import { listEntityCatalog } from "../src/application/list-entities.js";
import { listStoryCatalog } from "../src/application/list-stories.js";
import type { OcClient, OcMemory } from "../src/oc-client.js";

function memory(id: string, content: string, projectId = "story-1"): OcMemory {
  return {
    id,
    content,
    project_id: projectId,
    tags: ["mnemosyne"],
    pinned: false,
    created_at: "2026-08-31T00:00:00.000Z",
    updated_at: null,
    source: "test",
  };
}

describe("application catalog use cases", () => {
  it("returns transport-neutral story summaries and a count", async () => {
    const marker = memory(
      "marker-1",
      "[Mnemosyne Story] Example\nCreated: 2026-08-31T00:00:00.000Z\nSchema: 3",
    );
    const oc = {
      memorySearch: async () => [marker],
    } as unknown as OcClient;

    await expect(listStoryCatalog(oc)).resolves.toEqual({
      stories: [
        {
          id: "story-1",
          name: "Example",
          created_at: "2026-08-31T00:00:00.000Z",
        },
      ],
      count: 1,
    });
  });

  it("enumerates, filters, strips bodies, and surfaces skipped memories", async () => {
    const oc = {
      memoryList: async () => [
        memory("marker-1", "story marker"),
        memory("character-1", "[Character] Ada\n\nRuns the observatory."),
        memory("scene-1", "[Scene] Arrival\n\nAda enters the archive."),
        memory("unknown-1", "not a Mnemosyne entity"),
      ],
    } as unknown as OcClient;

    await expect(
      listEntityCatalog(
        oc,
        { id: "story-1", marker_memory_id: "marker-1" },
        { query: "observatory", includeBody: false },
      ),
    ).resolves.toEqual({
      entities: [
        {
          type: "character",
          name: "Ada",
          memory_id: "character-1",
          pinned: false,
          tags: ["mnemosyne"],
          created_at: "2026-08-31T00:00:00.000Z",
          updated_at: undefined,
        },
      ],
      count: 1,
      skipped_memory_ids: ["unknown-1"],
    });
  });
});
