// mnemo_position_get / mnemo_position_set: a story's in-story clock/place
// (docs/POSITION_TRACKING_DESIGN.md, ratified 2026-09-07). Thin marker-level
// tools -- no application-layer use case, matching registerStoryTools'
// shape -- since the real logic (merge semantics, elapsed-hours arithmetic,
// the atomic invariant) already lives in position.ts, pure and unit-tested.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import { getEntityByMemoryId } from "../entities.js";
import { findStory, resolveStoryId, type PositionState } from "../stories.js";
import { applyPositionUpdate, currentStoryDatetime } from "../position.js";
import { asText, withLogging } from "./helpers.js";

async function requireStory(oc: OcClient, storyId: string) {
  const story = await findStory(oc, storyId);
  if (!story) {
    throw new Error(
      `Story ${storyId} could not be found -- it may have been deleted.`,
    );
  }
  return story;
}

interface LocationSummary {
  memory_id: string;
  name: string;
  spot?: string;
}

async function resolveLocationSummary(
  oc: OcClient,
  storyId: string,
  memoryId: string,
  spot: string | undefined,
): Promise<LocationSummary> {
  const entity = await getEntityByMemoryId(oc, storyId, memoryId);
  return {
    memory_id: memoryId,
    // Resolved fresh on every read (never cached in the marker), so a
    // rename shows up immediately; a deleted location degrades gracefully
    // rather than crashing the whole report.
    name: entity?.name ?? "(unknown -- this location entity no longer exists)",
    ...(spot && { spot }),
  };
}

async function toPositionReport(
  oc: OcClient,
  storyId: string,
  position: PositionState,
) {
  const [epoch_location, current_location] = await Promise.all([
    resolveLocationSummary(
      oc,
      storyId,
      position.epochLocationId,
      position.epochSpot,
    ),
    resolveLocationSummary(
      oc,
      storyId,
      position.currentLocationId,
      position.currentSpot,
    ),
  ]);
  return {
    epoch_date: position.epochDate,
    epoch_location,
    elapsed_hours: position.elapsedHours,
    current_story_datetime: currentStoryDatetime(position),
    current_location,
  };
}

const ADVANCE_SCHEMA = z
  .object({
    hours: z.number().optional(),
    days: z.number().optional(),
    weeks: z.number().optional(),
  })
  .describe(
    "Additive time advance, e.g. { days: 3 } for 'three days later'. Combines with any of hours/days/weeks given in the same object.",
  );

interface PositionSetArgs {
  epoch_date?: string;
  epoch_location?: string;
  epoch_spot?: string;
  advance?: { hours?: number; days?: number; weeks?: number };
  set_elapsed_hours?: number;
  set_date?: string;
  current_location?: string;
  current_spot?: string;
  story?: string;
}

export function registerPositionTool(server: McpServer, oc: OcClient): void {
  server.registerTool(
    "mnemo_position_get",
    {
      title: "Get Story Position",
      description:
        "Read a story's current in-story clock/place (docs/POSITION_TRACKING_DESIGN.md). Throws a clear error if position tracking hasn't been started for this story yet -- use mnemo_position_set to start it.",
      inputSchema: {
        story: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Story name or OC project UUID to operate on instead of the active story (this call only).",
          ),
      },
    },
    withLogging("mnemo_position_get", async (args: { story?: string }) => {
      const storyId = await resolveStoryId(oc, args.story);
      const story = await requireStory(oc, storyId);
      if (!story.position) {
        throw new Error(
          "Position tracking isn't started for this story yet. Use " +
            "mnemo_position_set with epoch_date and epoch_location to start it.",
        );
      }
      return asText(await toPositionReport(oc, storyId, story.position));
    }),
  );

  server.registerTool(
    "mnemo_position_set",
    {
      title: "Set Story Position",
      description:
        "Start or update a story's in-story clock/place (docs/POSITION_TRACKING_DESIGN.md). The FIRST call on a story must supply epoch_date and epoch_location together -- that's what starts tracking. Every later call may touch any subset; untouched fields keep their stored value. At most one of advance / set_elapsed_hours / set_date may be given per call.",
      inputSchema: {
        epoch_date: z
          .string()
          .min(1)
          .optional()
          .describe(
            "ISO 8601 datetime (or any Date-parseable string) for the story's reference point in time. Required together with epoch_location on the first call for a story; correctable at any time afterward -- current_story_datetime reflows automatically by the same delta.",
          ),
        epoch_location: z
          .string()
          .min(1)
          .optional()
          .describe(
            "memory_id of a type:location entity marking the story's reference point in place. Required together with epoch_date on the first call for a story.",
          ),
        epoch_spot: z
          .string()
          .optional()
          .describe(
            'Free-text sub-location within epoch_location (e.g. "the porch"). Pass "" to clear.',
          ),
        advance: ADVANCE_SCHEMA.optional(),
        set_elapsed_hours: z
          .number()
          .optional()
          .describe(
            "Absolute jump to this many elapsed hours since the epoch.",
          ),
        set_date: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Jump to this ISO 8601 datetime; elapsed_hours is computed as the delta from epoch_date. Refused if it would predate the epoch.",
          ),
        current_location: z
          .string()
          .min(1)
          .optional()
          .describe(
            "memory_id of a type:location entity -- moves the story's current place without touching elapsed time.",
          ),
        current_spot: z
          .string()
          .optional()
          .describe(
            'Free-text sub-location within current_location. Pass "" to clear.',
          ),
        story: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Story name or OC project UUID to operate on instead of the active story (this call only).",
          ),
      },
    },
    withLogging("mnemo_position_set", async (args: PositionSetArgs) => {
      const storyId = await resolveStoryId(oc, args.story);
      // applyPositionUpdate does its own findStory (mutual-exclusivity
      // check, location-type validation, the atomic-invariant write-time
      // enforcement via mergePositionUpdate) -- shared with mnemo_continue's
      // advance/set_date/move_to convenience params, so both surfaces can't
      // drift.
      const updated = await applyPositionUpdate(oc, storyId, {
        epochDate: args.epoch_date,
        epochLocation: args.epoch_location,
        epochSpot: args.epoch_spot,
        advance: args.advance,
        setElapsedHours: args.set_elapsed_hours,
        setDate: args.set_date,
        currentLocation: args.current_location,
        currentSpot: args.current_spot,
      });

      return asText(await toPositionReport(oc, storyId, updated.position!));
    }),
  );
}
