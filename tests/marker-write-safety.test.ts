// Marker write safety (docs/GENRE_RUNTIME_REVIEW.md findings 1 and 2).
//
// The motivating defect was NOT a race. Every marker write used to rebuild the
// record from PARSED fields, so any stored value this build's parser rejects
// was silently dropped on the next unrelated write. Reproduced before the fix:
// a story declaring a genre term that a later dictionary revision removed lost
// its genres and all of its guidance when someone set a narrator profile. One
// binary, one session, no concurrency.
//
// The fix is line surgery: a write drops only the lines it owns and keeps every
// other line exactly as stored. These tests pin that, and the failure modes it
// introduces at the boundaries.

import { describe, expect, it } from "vitest";
import {
  createStory,
  findStory,
  markerFieldLines,
  parseMarkerContent,
  rewriteMarkerLines,
  setContentRating,
  setGenre,
  setNarratorProfile,
  updateStoryMarker,
  type MnemoStory,
} from "../src/stories.js";
import { registerStoryTools } from "../src/tools/stories.js";
import type { OcClient } from "../src/oc-client.js";

const CREATED = "2026-09-19T12:00:00.000Z";
const PROJECT = "11111111-2222-4333-8444-555555555555";

/** A marker store that counts writes, so "one write, not four" is testable. */
function store(initial?: string) {
  const memories = new Map<string, string>();
  if (initial !== undefined) memories.set("marker-1", initial);
  let writes = 0;
  let reads = 0;
  let staleSearchBody: string | undefined;
  const memory = (id: string) => ({
    id,
    content: memories.get(id),
    project_id: PROJECT,
    tags: ["mnemosyne", "story-marker"],
  });
  const oc = {
    projectCreate: async () => ({ id: PROJECT }),
    memorySave: async (opts: { content: string }) => {
      memories.set("marker-1", opts.content);
      return { id: "marker-1" };
    },
    memoryUpdate: async (opts: { memoryId: string; content: string }) => {
      writes += 1;
      if (!memories.has(opts.memoryId)) {
        throw new Error(`fake OC: write to unknown memory ${opts.memoryId}`);
      }
      memories.set(opts.memoryId, opts.content);
      return { id: opts.memoryId };
    },
    memoryGet: async (memoryId: string) => {
      reads += 1;
      return memories.has(memoryId) ? memory(memoryId) : null;
    },
    // The search index may lag a write the handler itself just made -- the
    // tool already documents that. Serving a stale body here is how a test
    // can tell "resolved from the caller's snapshot" apart from "resolved
    // from the fresh read", which are otherwise identical.
    memorySearch: async (opts: { tags?: string[] }) =>
      opts.tags?.includes("story-marker")
        ? [...memories.keys()].map((id) =>
            staleSearchBody === undefined
              ? memory(id)
              : { ...memory(id), content: staleSearchBody },
          )
        : [],
    memoryListCompact: async () => [],
    memoryList: async () => [],
  } as unknown as OcClient;
  return {
    oc,
    marker: () => memories.get("marker-1") ?? "",
    set: (content: string) => memories.set("marker-1", content),
    drop: () => memories.delete("marker-1"),
    serveStaleSearch: (content: string) => {
      staleSearchBody = content;
    },
    counts: () => ({ writes, reads }),
  };
}

function markerWith(...extra: string[]): string {
  return [
    "[Mnemosyne Story] Harbour",
    `Created: ${CREATED}`,
    "Schema: 7",
    ...extra,
  ].join("\n");
}

describe("a write preserves every line it does not own", () => {
  it("keeps a value THIS build's parser rejects (the motivating defect)", () => {
    // "action" was a real dictionary v1 term; v2 merged it into
    // "action-adventure", so this build rejects it and the whole declaration
    // reads as undeclared. It must still survive on disk.
    const stored = markerWith(
      "Content-Rating: nsfw",
      "Genre: action, romance",
      "Genre-Lean: A chase with a love story underneath it.",
      "Genre-Convention: Every set piece costs somebody something.",
    );
    expect(
      parseMarkerContent(stored)?.genre,
      "parser rejects it",
    ).toBeUndefined();

    const after = rewriteMarkerLines(
      stored,
      ["narratorProfile"],
      markerFieldLines("narratorProfile", "Halvard"),
    );
    expect(after).toContain("Genre: action, romance");
    expect(after).toContain(
      "Genre-Lean: A chase with a love story underneath it.",
    );
    expect(after).toContain(
      "Genre-Convention: Every set piece costs somebody something.",
    );
    expect(after).toContain("Content-Rating: nsfw");
    expect(after).toContain("Narrator-Profile: Halvard");
  });

  it("keeps a line written by a newer build", () => {
    const after = rewriteMarkerLines(
      markerWith("Future-Field: written by a newer build"),
      ["contentRating"],
      markerFieldLines("contentRating", "sfw"),
    );
    expect(after).toContain("Future-Field: written by a newer build");
  });

  it("replaces only its own lines, including all four genre lines", () => {
    const stored = markerWith(
      "Genre: mystery",
      "Genre-Lean: old lean",
      "Genre-Convention: old convention",
      "Genre-Avoid: old avoid",
      "Content-Rating: nsfw",
    );
    const after = rewriteMarkerLines(
      stored,
      ["genre"],
      markerFieldLines("genre", {
        genres: ["drama"],
        guidance: { lean: "new" },
      }),
    );
    expect(after).toContain("Genre: drama");
    expect(after).toContain("Genre-Lean: new");
    for (const gone of ["old lean", "old convention", "old avoid", "mystery"]) {
      expect(after, gone).not.toContain(gone);
    }
    expect(after).toContain("Content-Rating: nsfw");
  });

  it("clearing a field removes its lines and touches nothing else", () => {
    const after = rewriteMarkerLines(
      markerWith("Narrator-Profile: Halvard", "Content-Rating: nsfw"),
      ["narratorProfile"],
      markerFieldLines("narratorProfile", undefined),
    );
    expect(after).not.toContain("Narrator-Profile");
    expect(after).toContain("Content-Rating: nsfw");
  });

  it("still upgrades the legacy kin line rather than preserving a duplicate", () => {
    const after = rewriteMarkerLines(
      markerWith("Kindroid-Kin: kin-old"),
      ["kindroidTarget"],
      markerFieldLines("kindroidTarget", { type: "ai", id: "kin-new" }),
    );
    expect(after).toContain("Kindroid-Target: ai:kin-new");
    expect(after).not.toContain("Kindroid-Kin:");
  });

  it("emits exactly one Schema line even when a hand edit moved it", () => {
    const moved = [
      "[Mnemosyne Story] Harbour",
      `Created: ${CREATED}`,
      "Content-Rating: nsfw",
      "Schema: 3",
    ].join("\n");
    const after = rewriteMarkerLines(moved, ["narratorProfile"], []);
    expect(after.match(/^Schema: /gm)).toHaveLength(1);
    expect(after).toContain("Schema: 7");
  });

  it("strips a carriage return rather than bricking the story", () => {
    // A partially-CRLF marker parses today, so a preserved "\r" would trip
    // the line-break guard and make every future write throw.
    const stored = markerWith("Content-Rating: nsfw\r");
    expect(() =>
      rewriteMarkerLines(
        stored,
        ["narratorProfile"],
        markerFieldLines("narratorProfile", "Halvard"),
      ),
    ).not.toThrow();
    expect(rewriteMarkerLines(stored, ["narratorProfile"], [])).toContain(
      "Content-Rating: nsfw",
    );
  });

  it("still refuses a newly written value containing a line break", () => {
    expect(() =>
      rewriteMarkerLines(
        markerWith(),
        ["narratorProfile"],
        ["Narrator-Profile: a\nGenre: drama"],
      ),
    ).toThrow(/cannot contain a line break/);
  });
});

describe("a write reads fresh, so a stale snapshot cannot clobber", () => {
  it("does not erase a field another writer set after our snapshot", async () => {
    const s = store();
    const stale: MnemoStory = await createStory(s.oc, "Harbour");

    // Another session declares a genre. Our `stale` predates it.
    await setGenre(s.oc, stale, { genres: ["mystery"] });

    // Now write an unrelated field FROM THE STALE SNAPSHOT.
    await setNarratorProfile(s.oc, stale, "Halvard");

    const fresh = await findStory(s.oc, PROJECT);
    expect(fresh?.genres, "the concurrent genre survived").toEqual(["mystery"]);
    expect(fresh?.narrator_profile).toBe("Halvard");
  });

  it("refuses to write when the marker has been deleted", async () => {
    const s = store();
    const story: MnemoStory = await createStory(s.oc, "Harbour");
    s.drop();
    const before = s.counts().writes;
    await expect(setContentRating(s.oc, story, "nsfw")).rejects.toThrow(
      /no longer exists/,
    );
    expect(s.counts().writes, "nothing was written").toBe(before);
  });

  it("refuses to overwrite a marker it can no longer parse", async () => {
    const s = store();
    const story: MnemoStory = await createStory(s.oc, "Harbour");
    s.set("this is not a story marker at all");
    const before = s.counts().writes;
    await expect(setContentRating(s.oc, story, "nsfw")).rejects.toThrow(
      /no longer parses as a story marker/,
    );
    expect(s.counts().writes).toBe(before);
    expect(s.marker(), "the unreadable content is untouched").toBe(
      "this is not a story marker at all",
    );
  });

  it("returns what was persisted, not the caller's snapshot plus a change", async () => {
    const s = store();
    let story: MnemoStory = await createStory(s.oc, "Harbour");
    story = await setGenre(s.oc, story, { genres: ["mystery"] });
    story = await setNarratorProfile(s.oc, story, "Halvard");
    expect(
      story.genres,
      "the returned object carries the merged state",
    ).toEqual(["mystery"]);
    expect(story.narrator_profile).toBe("Halvard");
  });
});

describe("mnemo_story_use writes the marker once", () => {
  function handler(oc: OcClient) {
    const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
    const server = {
      registerTool: (
        name: string,
        _config: unknown,
        fn: (args: unknown) => Promise<unknown>,
      ) => handlers.set(name, fn),
    } as unknown as Parameters<typeof registerStoryTools>[0];
    registerStoryTools(server, oc, async () => ({ stories: [], count: 0 }));
    return handlers.get("mnemo_story_use")!;
  }

  it("applies four fields in a single write", async () => {
    const s = store();
    await createStory(s.oc, "Harbour");
    const before = s.counts().writes;

    await handler(s.oc)({
      name_or_id: PROJECT,
      kindroid_kin: "kin-1",
      narrator_profile: "Halvard",
      content_rating: "nsfw",
      genres: ["mystery", "romance"],
    });

    expect(s.counts().writes - before, "one write, not four").toBe(1);
    const fresh = await findStory(s.oc, PROJECT);
    expect(fresh?.kindroid_target).toEqual({ type: "ai", id: "kin-1" });
    expect(fresh?.narrator_profile).toBe("Halvard");
    expect(fresh?.content_rating).toBe("nsfw");
    expect(fresh?.genres).toEqual(["mystery", "romance"]);
  });

  it("writes nothing at all when any field is invalid", async () => {
    const s = store();
    await createStory(s.oc, "Harbour");
    const before = s.counts().writes;
    await expect(
      handler(s.oc)({
        name_or_id: PROJECT,
        content_rating: "nsfw",
        genres: ["crime", "heist"],
      }),
    ).rejects.toThrow(/cannot appear with its parent or ancestor/);
    expect(s.counts().writes, "the rating did not land").toBe(before);
    expect(parseMarkerContent(s.marker())?.contentRating).toBeUndefined();
  });

  it("resolves the genre merge against the fresh read when search lags", async () => {
    // The handler's own findStory goes through memorySearch. Here that index
    // is stale and does not show the genres, while the marker itself has
    // them. Resolving guidance against the stale snapshot would throw
    // "genre_guidance needs genres"; resolving against the fresh read
    // succeeds and folds the guidance onto what is actually stored.
    const s = store();
    await createStory(s.oc, "Harbour");
    const story = (await findStory(s.oc, PROJECT))!;
    await setGenre(s.oc, story, { genres: ["horror"] });
    s.serveStaleSearch(
      ["[Mnemosyne Story] Harbour", `Created: ${CREATED}`, "Schema: 7"].join(
        "\n",
      ),
    );

    await handler(s.oc)({
      name_or_id: PROJECT,
      genre_guidance: { lean: "The house is the antagonist." },
    });

    const written = parseMarkerContent(s.marker());
    expect(written?.genre?.genres).toEqual(["horror"]);
    expect(written?.genre?.guidance?.lean).toBe("The house is the antagonist.");
  });

  it("merges guidance onto the FRESH genres, not the caller's snapshot", async () => {
    const s = store();
    await createStory(s.oc, "Harbour");
    // Set genres directly, so the handler's own findStory predates nothing --
    // then have the handler add guidance only. It must fold onto what is
    // stored, which requires resolving against the fresh read.
    const story = (await findStory(s.oc, PROJECT))!;
    await setGenre(s.oc, story, { genres: ["horror"] });

    await handler(s.oc)({
      name_or_id: PROJECT,
      genre_guidance: { lean: "The house is the antagonist." },
    });

    const fresh = await findStory(s.oc, PROJECT);
    expect(fresh?.genres).toEqual(["horror"]);
    expect(fresh?.genre_guidance?.lean).toBe("The house is the antagonist.");
  });
});

describe("updateStoryMarker with no changes", () => {
  it("returns the fresh story without writing", async () => {
    const s = store();
    const story: MnemoStory = await createStory(s.oc, "Harbour");
    const before = s.counts().writes;
    const result = await updateStoryMarker(s.oc, story, () => ({}));
    expect(s.counts().writes).toBe(before);
    expect(result.name).toBe("Harbour");
  });
});
