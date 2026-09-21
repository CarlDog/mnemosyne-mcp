// Story management tools: mnemo_story_list, mnemo_story_use.
// See docs/ARCHITECTURE.md §2 and STATUS.md "v0 Contract" for the
// design rationale (marker-based stories, combined create+use).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import type { ListStoryCatalog } from "../application/list-stories.js";
import { toStorySummary } from "../application/catalog-policy.js";
import type { StorySummary } from "../application/model.js";
import {
  assertNarratorProfile,
  combineKindroidTarget,
  NARRATOR_PROFILE_PATTERN,
  NO_LINE_BREAK_MESSAGE,
  storyGenre,
} from "../story-marker.js";
import {
  createStory,
  findStory,
  updateStoryMarker,
  type MarkerChanges,
} from "../stories.js";
import {
  assertGenreDeclaration,
  genreGuidanceStrings,
  type GenreDeclaration,
  type GenreGuidance,
} from "../genre.js";
import type { ContentRating } from "../story-marker.js";
import {
  describeInjectionSignals,
  OVERRIDE_FLAGGED_CONTENT_PARAM,
  scanForInjectionSignals,
} from "../injection-scan.js";
import { getCurrentStoryId, setCurrentStoryId } from "../config.js";
import { asText, withLogging } from "./helpers.js";

// AnnotatedStory = StorySummary + "current" (which story the local
// active-story pointer points at) -- meaningful only here, since these
// tools are the ones reading that pointer. toStorySummary (application policy)
// is shared with the web API, which never annotates "current" (see its
// doc comment for why).
type AnnotatedStory = StorySummary & { current: boolean };

function toAnnotated(
  story: StorySummary,
  currentId: string | undefined,
): AnnotatedStory {
  return { ...story, current: story.id === currentId };
}

/**
 * Resolves the declaration to persist from the request and the story's
 * current state, or `undefined` for "clear it", or `null` for "no change".
 *
 * Guidance cannot exist without genres, so clearing `genres` clears the
 * whole declaration, while clearing `genre_guidance` leaves the genres in
 * place. Setting guidance alone is only legal when the story already has
 * genres (or the same call supplies them) -- otherwise there is nothing for
 * the guidance to be guidance FOR, and assertGenreDeclaration would be the
 * one to notice, too late and with a less useful message.
 */
export function resolveGenreChange(
  current: GenreDeclaration | undefined,
  requestedGenres: string[] | null | undefined,
  requestedGuidance: GenreGuidance | null | undefined,
): GenreDeclaration | undefined | null {
  if (requestedGenres === undefined && requestedGuidance === undefined) {
    return null;
  }
  if (requestedGenres === null) {
    // Clearing the genres clears the guidance with them, so supplying new
    // guidance in the same call is contradictory. Refuse it: the mirror
    // case (guidance with no genres) already refuses, and honouring half
    // of a contradictory request silently is worse than either.
    if (requestedGuidance !== undefined && requestedGuidance !== null) {
      throw new Error(
        "genres=null clears the whole declaration, so genre_guidance cannot be set in the same call. Clear first, then set.",
      );
    }
    return undefined;
  }
  const genres = requestedGenres ?? current?.genres;
  if (!genres) {
    // Clearing guidance on a story that has none is already true, so it
    // succeeds as a no-op. Only SETTING guidance needs genres to exist.
    if (requestedGuidance === null) return null;
    throw new Error(
      "genre_guidance needs genres: pass `genres` in the same call, or set them first.",
    );
  }
  const guidance =
    requestedGuidance === null
      ? undefined
      : (requestedGuidance ?? current?.guidance);
  const declaration: GenreDeclaration = {
    genres,
    ...(guidance && { guidance }),
  };
  assertGenreDeclaration(declaration);
  return declaration;
}

/**
 * Refuses a declaration whose guidance is instruction-shaped, unless the
 * caller explicitly overrides. Genre guidance is rendered verbatim into
 * every system prompt for this story, so it is a write surface with the
 * same exposure as an entity body -- this is the fourth tool to expose
 * OVERRIDE_FLAGGED_CONTENT_PARAM.
 *
 * Each string is scanned separately because each is rendered on its own
 * line. That is a LIMIT, not a defence: a phrase split across two
 * conventions is never seen whole by the scanner and will not be caught.
 * The practical payoff of such a split is weakened by the same
 * per-line rendering, which breaks the phrase apart again in the prompt,
 * but it is not eliminated. Do not read this as a guarantee.
 */
export function assertGuidanceUnflagged(
  declaration: GenreDeclaration,
  args: { [OVERRIDE_FLAGGED_CONTENT_PARAM]?: boolean },
): void {
  if (args[OVERRIDE_FLAGGED_CONTENT_PARAM]) return;
  if (!declaration.guidance) return;
  for (const text of genreGuidanceStrings(declaration.guidance)) {
    const signals = scanForInjectionSignals(text);
    if (signals.length > 0) {
      throw new Error(
        `genre_guidance looks instruction-shaped and was not written. ${describeInjectionSignals(signals)} ` +
          `Set ${OVERRIDE_FLAGGED_CONTENT_PARAM}=true to write it anyway.`,
      );
    }
  }
}

/**
 * Declaring an explicit-content genre says nothing to content routing: the
 * two are separate by decision (docs/GENRE_DECLARATION_DESIGN.md, and the
 * routing gate is content_rating checked at dispatchGenerate). That
 * separation is right, but it leaves a gap nothing owned: declaring
 * `erotica` is the single strongest signal that a rating should exist, and
 * an undeclared rating never fires the gate at all. So this warns; it does
 * not refuse, and it does not set the rating on the caller's behalf.
 *
 * One term deliberately, not a heuristic: `erotica` is the only dictionary
 * entry whose definition is explicitly sexual content. If more terms ever
 * warrant it, the scalable form is a per-term flag in the dictionary, not a
 * longer list here.
 */
const CONTENT_SENSITIVE_GENRES = new Set(["erotica"]);

function contentRatingWarning(
  declaration: GenreDeclaration | undefined,
  rating: ContentRating | undefined,
): string | undefined {
  if (!declaration || rating !== undefined) return undefined;
  const flagged = declaration.genres.filter((term) =>
    CONTENT_SENSITIVE_GENRES.has(term),
  );
  if (flagged.length === 0) return undefined;
  return (
    `This story declares ${flagged.join(", ")} but has no content_rating. ` +
    "Content routing only refuses a mismatch for a story whose rating is " +
    "declared, so generation will not be gated. Set content_rating=nsfw if " +
    "that is what you mean."
  );
}

export function registerStoryTools(
  server: McpServer,
  oc: OcClient,
  listStoryCatalog: ListStoryCatalog,
): void {
  server.registerTool(
    "mnemo_story_list",
    {
      title: "List Mnemosyne Stories",
      description:
        "List all Mnemosyne stories. A story is an OpenChronicle project containing the Mnemosyne story marker. Other OC projects (codebase memory, etc.) are filtered out.",
      inputSchema: {},
    },
    withLogging("mnemo_story_list", async () => {
      const [catalog, currentId] = await Promise.all([
        listStoryCatalog(),
        getCurrentStoryId(),
      ]);
      const annotated = catalog.stories.map((s) => toAnnotated(s, currentId));
      return asText({ stories: annotated, count: annotated.length });
    }),
  );

  server.registerTool(
    "mnemo_story_use",
    {
      title: "Set Active Story",
      description:
        "Set the active story by name or OC project UUID. With create_if_missing=true, creates a new story (OC project + marker) if none matches. Persists the active story id to local config so it survives restarts.",
      inputSchema: {
        name_or_id: z
          .string()
          .min(1)
          .regex(/^[^\r\n]*$/, NO_LINE_BREAK_MESSAGE)
          .describe("Story name or OC project UUID"),
        create_if_missing: z
          .boolean()
          .optional()
          .describe(
            "If true and no existing story matches, create a new one. Default false.",
          ),
        kindroid_kin: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Bind this story to a specific Kindroid AI (a raw ai_id or a kindroid-mcp registered name) for single-AI generation, used by mnemo_continue when GENERATOR_PROVIDER=kindroid and no per-call override is given. Mutually exclusive with kindroid_group_id. Pass null to clear a previously-set binding (falls back to the server-wide default). Omit to leave any existing binding unchanged.",
          ),
        kindroid_group_id: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Bind this story to a specific Kindroid group chat (a raw group_id or a kindroid-mcp registered name) instead of a single AI -- mnemo_continue then drives the group's turn loop and returns each AI's reply as part of the beat. Mutually exclusive with kindroid_kin. Pass null to clear. Omit to leave unchanged.",
          ),
        narrator_profile: z
          .string()
          .regex(NARRATOR_PROFILE_PATTERN)
          .nullable()
          .optional()
          .describe(
            "Name the narrator persona this story is written with (1-64 chars of letters, digits, . _ -), e.g. the kin's persona label. A provenance label only: mnemo_continue echoes it and tags each saved scene narrator:<label> when the story's Kindroid binding is used. Pass null to clear. Omit to leave unchanged.",
          ),
        genres: z
          .array(z.string().min(1))
          .nullable()
          .optional()
          .describe(
            "Declare this story's genre as an ordered list of 1-3 dictionary terms, broadest true term FIRST; a term may never appear beside its own parent or ancestor. The frame (first term) wins when conventions conflict. Rendered into the system prompt for direct providers and as a terms-only line for companion providers. Pass null to clear the whole declaration (guidance included). Omit to leave unchanged.",
          ),
        genre_guidance: z
          .object({
            lean: z.string().min(1),
            conventions: z.array(z.string().min(1)).optional(),
            avoid: z.array(z.string().min(1)).optional(),
          })
          .nullable()
          .optional()
          .describe(
            "This story's own take on its genres: a required one-line `lean` (<=200 chars) plus optional `conventions` and `avoid` lists (<=8 items of <=160 chars each, <=1500 chars of guidance in total, because it travels on the story marker and into every prompt). Needs `genres` to be set, in this call or already. Never sent to companion providers. Pass null to clear the guidance but keep the genres. Omit to leave unchanged.",
          ),
        [OVERRIDE_FLAGGED_CONTENT_PARAM]: z
          .boolean()
          .optional()
          .describe(
            "Genre guidance matching instruction-shaped phrasing (a prompt-injection signal) is refused by default -- nothing is written, and the error quotes the matched excerpt. Set true to write it anyway.",
          ),
        content_rating: z
          .enum(["sfw", "nsfw"])
          .nullable()
          .optional()
          .describe(
            "Declare this story's content-generation requirement. Checked against the configured generator's declared content capability at generation time -- an nsfw-rated story on an sfw-only provider refuses before spending an LLM call. Unset means no declared requirement (never blocking on its own, only a warning field on the response) -- there is no deadline that turns unset into an error later. Pass null to clear a previously-set rating. Omit to leave unchanged.",
          ),
      },
    },
    withLogging(
      "mnemo_story_use",
      async (args: {
        name_or_id: string;
        create_if_missing?: boolean;
        kindroid_kin?: string | null;
        kindroid_group_id?: string | null;
        narrator_profile?: string | null;
        content_rating?: "sfw" | "nsfw" | null;
        genres?: string[] | null;
        genre_guidance?: GenreGuidance | null;
        [OVERRIDE_FLAGGED_CONTENT_PARAM]?: boolean;
      }) => {
        const { name_or_id, create_if_missing } = args;
        const profileChangeRequested = args.narrator_profile !== undefined;
        const requestedProfile = args.narrator_profile ?? undefined;
        const ratingChangeRequested = args.content_rating !== undefined;
        const requestedRating = args.content_rating ?? undefined;

        // Throws on a genuine kindroid_kin + kindroid_group_id conflict.
        const requestedTarget = combineKindroidTarget(
          args.kindroid_kin,
          args.kindroid_group_id,
        );
        const targetChangeRequested =
          args.kindroid_kin !== undefined ||
          args.kindroid_group_id !== undefined;

        let story = await findStory(oc, name_or_id);
        if (!story) {
          if (!create_if_missing) {
            return asText(
              {
                error: "story_not_found",
                message: `No story matches "${name_or_id}". Pass create_if_missing=true to create one.`,
              },
              { isError: true },
            );
          }
          // A brand-new story has no current declaration to merge onto.
          const declaration = resolveGenreChange(
            undefined,
            args.genres,
            args.genre_guidance,
          );
          if (declaration) assertGuidanceUnflagged(declaration, args);
          story = await createStory(
            oc,
            name_or_id,
            requestedTarget,
            requestedProfile,
            requestedRating,
            declaration ?? undefined,
          );
        } else if (
          targetChangeRequested ||
          profileChangeRequested ||
          ratingChangeRequested ||
          args.genres !== undefined ||
          args.genre_guidance !== undefined
        ) {
          if (requestedProfile !== undefined) {
            assertNarratorProfile(requestedProfile);
          }
          // ONE marker write for every requested field. Previously this was
          // four sequential writes: six OC round trips, four independent
          // chances for another session to interleave, and a transport
          // failure partway through leaving some fields written and others
          // not. It is now two round trips and one window.
          //
          // Every validation runs inside the closure, which executes before
          // the write, so an invalid value rejects the whole call with
          // nothing written -- including content_rating, a routing gate that
          // an earlier arrangement could leave flipped behind a single error.
          story = await updateStoryMarker(oc, story, (fresh) => {
            const changes: MarkerChanges = {};
            if (targetChangeRequested) {
              changes.kindroidTarget = { value: requestedTarget };
            }
            if (profileChangeRequested) {
              changes.narratorProfile = { value: requestedProfile };
            }
            if (ratingChangeRequested) {
              changes.contentRating = { value: requestedRating };
            }
            // Resolved against the FRESH story, not the caller's snapshot:
            // the genre merge folds requested fields onto current ones, so
            // basing it on a stale read would silently drop guidance another
            // session had just added.
            const declaration = resolveGenreChange(
              storyGenre(fresh),
              args.genres,
              args.genre_guidance,
            );
            if (declaration !== null) {
              if (declaration) assertGuidanceUnflagged(declaration, args);
              changes.genre = { value: declaration };
            }
            return changes;
          });
        }
        await setCurrentStoryId(story.id);
        const ratingWarning = contentRatingWarning(
          storyGenre(story),
          story.content_rating,
        );
        return asText({
          ...toStorySummary(story),
          current: true,
          ...(ratingWarning && { content_rating_warning: ratingWarning }),
        });
      },
    ),
  );
}
