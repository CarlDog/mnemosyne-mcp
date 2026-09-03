// KINDROID_NARRATOR_DESIGN S3: the session-break use case against a port
// stub. Pins the refusals (all before any mutation), the fixed order (break,
// then save), the tags on the saved greeting, and the recovery message when
// only the save fails.

import { describe, it, expect, vi } from "vitest";
import {
  sessionBreak,
  SESSION_BREAK_TAG,
} from "../src/application/session-break.js";
import type { SessionPort } from "../src/application/ports/session.js";
import type { StoryBinding } from "../src/application/ports/continuation.js";
import { RunOutcomeError } from "../src/run-outcome.js";

const STORY_ID = "11111111-2222-4333-8444-555555555555";
const NOW = "2026-09-03T00:00:00.000Z";

function stubPort(
  binding: StoryBinding,
  generatorName = "kindroid",
): { port: SessionPort; calls: string[] } {
  const calls: string[] = [];
  const port: SessionPort = {
    generatorName,
    storyBinding: vi.fn(async () => binding),
    chatBreak: vi.fn(async () => {
      calls.push("chatBreak");
    }),
    saveScene: vi.fn(async () => {
      calls.push("saveScene");
      return { memory_id: "scene-1", tags: [] };
    }),
    nowIso: () => NOW,
    warn: vi.fn(),
  };
  return { port, calls };
}

const OPTS = {
  greeting: "*Snow ticked against the window.*",
  reinvokeHint: "again",
};

async function rejection(p: Promise<unknown>): Promise<RunOutcomeError> {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(RunOutcomeError);
  expect((err as RunOutcomeError).outcome).toBe("rejected_before_dispatch");
  return err as RunOutcomeError;
}

describe("sessionBreak refusals happen before any mutation", () => {
  it("refuses a non-Kindroid generator", async () => {
    const { port } = stubPort(
      { kindroidTarget: { type: "ai", id: "k" } },
      "ollama",
    );
    await rejection(sessionBreak(port, STORY_ID, OPTS));
    expect(port.chatBreak).not.toHaveBeenCalled();
    expect(port.saveScene).not.toHaveBeenCalled();
  });

  it("refuses an empty greeting", async () => {
    const { port } = stubPort({ kindroidTarget: { type: "ai", id: "k" } });
    await rejection(sessionBreak(port, STORY_ID, { ...OPTS, greeting: "   " }));
    expect(port.chatBreak).not.toHaveBeenCalled();
  });

  it("refuses a story with no target and no override, and says how to bind one", async () => {
    const { port } = stubPort({});
    const err = await rejection(sessionBreak(port, STORY_ID, OPTS));
    expect(err.message).toMatch(/mnemo_story_use\(kindroid_kin/);
    expect(port.chatBreak).not.toHaveBeenCalled();
  });

  it("refuses a group-bound story", async () => {
    const { port } = stubPort({ kindroidTarget: { type: "group", id: "g" } });
    const err = await rejection(sessionBreak(port, STORY_ID, OPTS));
    expect(err.message).toMatch(/group/);
    expect(port.chatBreak).not.toHaveBeenCalled();
  });
});

describe("sessionBreak happy path", () => {
  it("breaks first, then saves the greeting as a tagged scene, and reports both", async () => {
    const { port, calls } = stubPort({
      kindroidTarget: { type: "ai", id: "kin-1" },
      narratorProfile: "storyteller-v1",
    });
    const result = await sessionBreak(port, STORY_ID, OPTS);
    expect(calls).toEqual(["chatBreak", "saveScene"]);
    expect(port.chatBreak).toHaveBeenCalledWith(
      { type: "ai", id: "kin-1" },
      OPTS.greeting,
    );
    expect(port.saveScene).toHaveBeenCalledWith(
      STORY_ID,
      `Session break ${NOW}`,
      OPTS.greeting,
      [SESSION_BREAK_TAG, "narrator:storyteller-v1"],
    );
    expect(result.target).toEqual({ type: "ai", id: "kin-1" });
    expect(result.greeting_scene.memory_id).toBe("scene-1");
    expect(result.narrator_profile).toBe("storyteller-v1");
    expect(result.message).toMatch(/do not re-send the greeting/);
  });

  it("lets an explicit kin win over the story's binding", async () => {
    const { port } = stubPort({ kindroidTarget: { type: "group", id: "g" } });
    const result = await sessionBreak(port, STORY_ID, {
      ...OPTS,
      explicitKin: "other-kin",
    });
    expect(result.target).toEqual({ type: "ai", id: "other-kin" });
    expect(port.chatBreak).toHaveBeenCalledWith(
      { type: "ai", id: "other-kin" },
      OPTS.greeting,
    );
  });

  it("does not save when the break itself fails", async () => {
    const { port } = stubPort({ kindroidTarget: { type: "ai", id: "kin-1" } });
    (port.chatBreak as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("kindroid_chat_break timed out"),
    );
    await expect(sessionBreak(port, STORY_ID, OPTS)).rejects.toThrow(
      /timed out/,
    );
    expect(port.saveScene).not.toHaveBeenCalled();
  });

  it("reports a failed save as recoverable, since the break already applied", async () => {
    const { port } = stubPort({ kindroidTarget: { type: "ai", id: "kin-1" } });
    (port.saveScene as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("OC unavailable"),
    );
    const result = await sessionBreak(port, STORY_ID, OPTS);
    expect(result.greeting_scene.save_error).toBe("OC unavailable");
    expect(result.greeting_scene.memory_id).toBeUndefined();
    expect(result.message).toMatch(/mnemo_save_entity/);
    expect(port.warn).toHaveBeenCalled();
  });
});
