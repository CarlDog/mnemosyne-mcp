// Story marker logic. A Mnemosyne "story" is an OC project containing a
// pinned marker memory of the form:
//   [Mnemosyne Story] <name>
//   Created: <iso-datetime>
//   Schema: 7
//   Kindroid-Target: ai:<id>        (optional; or "group:<id>")
//   Narrator-Profile: <label>       (optional; schema 4, 2026-09-03)
//   Content-Rating: sfw|nsfw        (optional; schema 6, 2026-09-08 --
//                                    docs/CONTENT_ROUTING_DESIGN.md)
//   Epoch-Date: <iso-datetime>      (optional; schema 5, 2026-09-07 --
//                                    position tracking's on/off switch)
//   Epoch-Location: <memory_id>
//   Epoch-Spot: <free text>         (optional)
//   Elapsed-Hours: <integer>
//   Current-Location: <memory_id>
//   Current-Spot: <free text>       (optional)
// with tags ["mnemosyne", "story-marker"]. Schema-1 markers (no kin line at
// all), schema-2 markers (legacy "Kindroid-Kin: <id>" line, always an AI
// target), schema-3 markers (no narrator line), schema-4 markers (no
// position block), and schema-5 markers (no content-rating line) all still
// parse fine -- unknown lines are ignored and known ones are found by
// prefix. Every write path bumps the Schema line to the current constant
// regardless of whether position tracking or content rating is used, so a
// schema-6 marker with no Content-Rating/Epoch-* lines must parse
// identically in meaning to a schema-5 marker -- see
// docs/POSITION_TRACKING_DESIGN.md's "Refinements added at implementation
// time" §1 (the precedent this follows). A schema-7 marker with no Genre-*
// lines parses identically in meaning to a schema-6 marker on the same
// rule.
//
// The genre lines (schema 7, 2026-09-19, docs/GENRE_DECLARATION_DESIGN.md)
// are written after Content-Rating and before the Epoch-* block, and are
// validated on READ, so a hand-edited marker can never carry an arbitrary
// term or an oversized guidance string into a prompt:
//   Genre: <term>, <term>           (1-3 dictionary terms, broadest first)
//   Genre-Lean: <one line>
//   Genre-Convention: <one line>    (repeated, one line per item)
//   Genre-Avoid: <one line>         (repeated, one line per item)
//
// A value containing a newline is REFUSED at write time: see
// buildMarkerContent's guard for why a line-based format cannot tolerate
// one.
//
// The narrator profile is a LABEL naming which narrator kin persona a story
// is written with (docs/KINDROID_NARRATOR_DESIGN.md S2): it rides the
// marker so provenance survives, is echoed by mnemo_continue, and tags each
// saved scene as `narrator:<label>`. It is not a copy of the persona.
//
// Content-Rating (docs/CONTENT_ROUTING_DESIGN.md, ratified 2026-09-08) is
// the story's declared content-generation requirement, checked against
// each configured provider's declared contentCapability at the one real
// generate() call site (dispatchGenerate() in continue-scene.ts). Unset
// means "no declared requirement," not "sfw" -- it never blocks generation
// on its own, only surfaces a warning field. There is deliberately no
// migration deadline that turns unset into an error later.
//
// Position tracking (docs/POSITION_TRACKING_DESIGN.md, ratified 2026-09-07)
// is opt-in per story, exactly like the Kindroid target and narrator
// profile: no Epoch-* lines means tracking hasn't started. The block is
// atomic -- Epoch-Date and Epoch-Location are required together, enforced
// in the *parser* (parsePositionState below), not only at write time, since
// a hand-edited marker could otherwise violate it. Location memory_ids are
// stored, never names -- a location's display name is always resolved
// fresh via getEntityByMemoryId, so a later rename can't leave a stale
// cached copy in the marker. Elapsed-Hours is the one field that changes
// as the story advances; current_story_datetime (epoch_date + elapsed
// hours) is always DERIVED at read time, never stored -- see
// currentStoryDatetime() in ./position.ts, which holds the merge/
// arithmetic/validate-then-apply logic built on top of this file's marker
// parsing (PositionState, parsePositionState stay here as the storage
// format; position.ts is downstream of it).

import { type OcMemory } from "./oc-client.js";
import { log } from "./log.js";
import {
  parseGenresValue,
  parseGuidanceValues,
  type GenreDeclaration,
  type GenreGuidance,
} from "./genre.js";
import {
  assertNarratorProfile,
  NARRATOR_PROFILE_PATTERN,
  narratorTag,
} from "./application/narrator-policy.js";

// Re-exported so the tools and tests that reach the marker through this
// module get the label policy from the same place.
export { assertNarratorProfile, NARRATOR_PROFILE_PATTERN, narratorTag };

export const STORY_MARKER_TAGS = ["mnemosyne", "story-marker"];
const STORY_MARKER_SCHEMA = 7;

const KINDROID_TARGET_PREFIX = "Kindroid-Target: ";
// Schema 2, read-only compat: a bare kin line always meant an AI target.
const LEGACY_KINDROID_KIN_PREFIX = "Kindroid-Kin: ";
const NARRATOR_PROFILE_PREFIX = "Narrator-Profile: ";
const CONTENT_RATING_PREFIX = "Content-Rating: ";
const GENRE_PREFIX = "Genre: ";
const GENRE_LEAN_PREFIX = "Genre-Lean: ";
// Repeated lines, one item each, rather than one delimited line: a
// guidance string is free prose and may contain any separator we could
// pick, so a delimited form would silently corrupt on round trip.
const GENRE_CONVENTION_PREFIX = "Genre-Convention: ";
const GENRE_AVOID_PREFIX = "Genre-Avoid: ";
const EPOCH_DATE_PREFIX = "Epoch-Date: ";
const EPOCH_LOCATION_PREFIX = "Epoch-Location: ";
const EPOCH_SPOT_PREFIX = "Epoch-Spot: ";
const ELAPSED_HOURS_PREFIX = "Elapsed-Hours: ";
const CURRENT_LOCATION_PREFIX = "Current-Location: ";
const CURRENT_SPOT_PREFIX = "Current-Spot: ";

/** Why every marker-bound free-text parameter rejects line breaks.
 * Exported so each input boundary cites the same rule rather than
 * inventing its own wording. */
export const NO_LINE_BREAK_MESSAGE =
  "Cannot contain a line break: this value is stored on the story marker, a line-based format where a newline would forge additional fields.";

export type KindroidTargetType = "ai" | "group";

/** A story's declared content-generation requirement
 * (docs/CONTENT_ROUTING_DESIGN.md, ratified 2026-09-08). Checked against a
 * provider's declared contentCapability at generation time; unset means "no
 * declared requirement," not "sfw". */
export type ContentRating = "sfw" | "nsfw";
export const VALID_CONTENT_RATINGS: readonly ContentRating[] = ["sfw", "nsfw"];

export interface KindroidTarget {
  type: KindroidTargetType;
  /** ai_id/group_id, or a kindroid-mcp registered name (resolved server-side). */
  id: string;
}

/**
 * A story's in-story clock/place, if position tracking has been started
 * (docs/POSITION_TRACKING_DESIGN.md). Location fields are memory_ids, never
 * names -- resolve a display name via getEntityByMemoryId at read time.
 * elapsedHours is the one field that advances; the current datetime is
 * always derived (see currentStoryDatetime()), never stored.
 */
export interface PositionState {
  epochDate: string; // iso-datetime, normalized to Date#toISOString() form
  epochLocationId: string;
  epochSpot?: string;
  elapsedHours: number; // integer
  currentLocationId: string;
  currentSpot?: string;
}

export interface MnemoStory {
  id: string; // OC project id
  name: string;
  created_at: string;
  marker_memory_id: string; // OC memory id, needed to update the marker in place
  /** This story's dedicated Kindroid target (a single AI or a group chat),
   * if bound. See setKindroidTarget(). */
  kindroid_target?: KindroidTarget;
  /** The narrator persona label this story is written with, if set. See
   * setNarratorProfile(). */
  narrator_profile?: string;
  /** This story's declared content-generation requirement, if set. See
   * setContentRating(). */
  content_rating?: ContentRating;
  /** This story's in-story clock/place, if position tracking has been
   * started. See setPosition(). */
  position?: PositionState;
  /** This story's declared genre, if set. Ordered, broadest term
   * first. See setGenre() and docs/GENRE_DECLARATION_DESIGN.md. */
  genres?: string[];
  /** This story's own genre guidance, if set. Never present without
   * `genres`. */
  genre_guidance?: GenreGuidance;
}

/** Exported for the pure marker tests; production callers go through
 * createStory / setKindroidTarget / setNarratorProfile. */
export function buildMarkerContent(
  name: string,
  createdAt: string,
  kindroidTarget?: KindroidTarget,
  narratorProfile?: string,
  position?: PositionState,
  contentRating?: ContentRating,
  // One object rather than two more positionals: this builder is called
  // from five sites and already takes six arguments, and genres and their
  // guidance must move together anyway.
  genre?: GenreDeclaration,
): string {
  const lines = [
    `[Mnemosyne Story] ${name}`,
    `Created: ${createdAt}`,
    `${SCHEMA_PREFIX}${STORY_MARKER_SCHEMA}`,
  ];
  if (kindroidTarget) {
    lines.push(
      `${KINDROID_TARGET_PREFIX}${kindroidTarget.type}:${kindroidTarget.id}`,
    );
  }
  if (narratorProfile) {
    lines.push(`${NARRATOR_PROFILE_PREFIX}${narratorProfile}`);
  }
  if (contentRating) {
    lines.push(`${CONTENT_RATING_PREFIX}${contentRating}`);
  }
  if (genre) {
    lines.push(`${GENRE_PREFIX}${genre.genres.join(", ")}`);
    if (genre.guidance) {
      lines.push(`${GENRE_LEAN_PREFIX}${genre.guidance.lean}`);
      for (const item of genre.guidance.conventions ?? []) {
        lines.push(`${GENRE_CONVENTION_PREFIX}${item}`);
      }
      for (const item of genre.guidance.avoid ?? []) {
        lines.push(`${GENRE_AVOID_PREFIX}${item}`);
      }
    }
  }
  if (position) {
    lines.push(`${EPOCH_DATE_PREFIX}${position.epochDate}`);
    lines.push(`${EPOCH_LOCATION_PREFIX}${position.epochLocationId}`);
    if (position.epochSpot) {
      lines.push(`${EPOCH_SPOT_PREFIX}${position.epochSpot}`);
    }
    lines.push(`${ELAPSED_HOURS_PREFIX}${position.elapsedHours}`);
    lines.push(`${CURRENT_LOCATION_PREFIX}${position.currentLocationId}`);
    if (position.currentSpot) {
      lines.push(`${CURRENT_SPOT_PREFIX}${position.currentSpot}`);
    }
  }
  return assertMarkerLinesSafe(lines).join("\n");
}

/**
 * The marker is a LINE-BASED format: the parser re-splits the whole stored
 * string on "\n" with no memory of which line came from which field. So a
 * value containing a newline does not merely look odd, it forges additional
 * marker fields, and the parser reads them as real. An adversarial review
 * reproduced this end to end: a position `spot` carrying
 * "pier\nGenre: drama\nGenre-Lean: <payload>" produced a story whose parsed
 * genre declaration had passed neither the write-side validation nor the
 * injection scan, and whose forged guidance rendered verbatim into every
 * system prompt for that story.
 *
 * Guarding at the one place every marker line is assembled closes it for
 * every field at once, including fields added later, which is the point.
 * Callers that carry free text guard their own input too, so the error names
 * the parameter instead of the marker line.
 */
function assertMarkerLinesSafe(lines: string[]): string[] {
  for (const line of lines) {
    if (/[\r\n]/.test(line)) {
      const field = line.split(/[:\r\n]/, 1)[0];
      throw new Error(
        `${field}: a story marker value cannot contain a line break -- the marker is a line-based format and a newline would forge additional fields.`,
      );
    }
  }
  return lines;
}

const SCHEMA_PREFIX = "Schema: ";

/** Every prefix this build writes, grouped by the field that owns it. A
 * rewrite replaces exactly the groups it names and leaves everything else
 * alone. The legacy kin prefix belongs to the target group so an upgrade
 * still drops it rather than preserving a duplicate binding. */
const OWNED_PREFIXES = {
  kindroidTarget: [KINDROID_TARGET_PREFIX, LEGACY_KINDROID_KIN_PREFIX],
  narratorProfile: [NARRATOR_PROFILE_PREFIX],
  contentRating: [CONTENT_RATING_PREFIX],
  genre: [
    GENRE_PREFIX,
    GENRE_LEAN_PREFIX,
    GENRE_CONVENTION_PREFIX,
    GENRE_AVOID_PREFIX,
  ],
  position: [
    EPOCH_DATE_PREFIX,
    EPOCH_LOCATION_PREFIX,
    EPOCH_SPOT_PREFIX,
    ELAPSED_HOURS_PREFIX,
    CURRENT_LOCATION_PREFIX,
    CURRENT_SPOT_PREFIX,
  ],
} as const;

export type MarkerField = keyof typeof OWNED_PREFIXES;

/** The lines one field contributes to a marker. */
export function markerFieldLines(
  field: MarkerField,
  value:
    | KindroidTarget
    | string
    | ContentRating
    | GenreDeclaration
    | PositionState
    | undefined,
): string[] {
  if (value === undefined) return [];
  if (field === "kindroidTarget") {
    const target = value as KindroidTarget;
    return [`${KINDROID_TARGET_PREFIX}${target.type}:${target.id}`];
  }
  if (field === "narratorProfile") {
    return [`${NARRATOR_PROFILE_PREFIX}${value as string}`];
  }
  if (field === "contentRating") {
    return [`${CONTENT_RATING_PREFIX}${value as ContentRating}`];
  }
  if (field === "genre") return genreLines(value as GenreDeclaration);
  return positionLines(value as PositionState);
}

function genreLines(genre: GenreDeclaration): string[] {
  const lines = [`${GENRE_PREFIX}${genre.genres.join(", ")}`];
  if (genre.guidance) {
    lines.push(`${GENRE_LEAN_PREFIX}${genre.guidance.lean}`);
    for (const item of genre.guidance.conventions ?? []) {
      lines.push(`${GENRE_CONVENTION_PREFIX}${item}`);
    }
    for (const item of genre.guidance.avoid ?? []) {
      lines.push(`${GENRE_AVOID_PREFIX}${item}`);
    }
  }
  return lines;
}

function positionLines(position: PositionState): string[] {
  const lines = [
    `${EPOCH_DATE_PREFIX}${position.epochDate}`,
    `${EPOCH_LOCATION_PREFIX}${position.epochLocationId}`,
  ];
  if (position.epochSpot) {
    lines.push(`${EPOCH_SPOT_PREFIX}${position.epochSpot}`);
  }
  lines.push(`${ELAPSED_HOURS_PREFIX}${position.elapsedHours}`);
  lines.push(`${CURRENT_LOCATION_PREFIX}${position.currentLocationId}`);
  if (position.currentSpot) {
    lines.push(`${CURRENT_SPOT_PREFIX}${position.currentSpot}`);
  }
  return lines;
}

/**
 * Rewrites a marker by LINE SURGERY rather than by rebuilding it from parsed
 * fields. That difference is the whole point of this function.
 *
 * Rebuilding re-emits only what THIS build can parse, so any stored value
 * this build rejects disappears on the next unrelated write. Reproduced
 * before this existed: a story declaring a genre term that a later dictionary
 * revision removed lost its genres AND all of its guidance the next time
 * anyone set a narrator profile -- one binary, one session, no race. The same
 * shape applies to a future content rating, a future Kindroid target type,
 * and any field a newer build adds.
 *
 * Surgery instead: drop only the lines the caller owns, keep every other line
 * exactly as stored. A value we cannot parse is a value we do not touch. This
 * also means a concurrent write to a DIFFERENT field survives ours, without
 * needing to reason about the race at all.
 *
 * A trailing carriage return is stripped from surviving lines: a partially
 * CRLF marker parses today (only the first two lines are matched strictly),
 * so a preserved "\r" would trip the line guard above and make the story
 * permanently unwritable.
 */
export function rewriteMarkerLines(
  content: string,
  owned: readonly MarkerField[],
  replacement: readonly string[],
): string {
  const ownedPrefixes = owned.flatMap((field) => [...OWNED_PREFIXES[field]]);
  const lines = content.split("\n").map((line) => line.replace(/\r$/, ""));
  const preserved = lines
    .slice(2)
    .filter((line) => line.trim().length > 0)
    // Excluded BY PREFIX, not by line index: a hand-edited marker whose
    // Schema line moved would otherwise be preserved and re-emitted beside
    // the fresh one, forever.
    .filter((line) => !line.startsWith(SCHEMA_PREFIX))
    .filter((line) => !ownedPrefixes.some((prefix) => line.startsWith(prefix)));
  return assertMarkerLinesSafe([
    ...lines.slice(0, 2),
    `${SCHEMA_PREFIX}${STORY_MARKER_SCHEMA}`,
    ...replacement,
    ...preserved,
  ]).join("\n");
}

/** Reassembles the marker-shaped declaration from a story's two flat
 * fields. Every write site goes through this, so no site can carry the
 * genres and drop the guidance (or the reverse). */
export function storyGenre(story: MnemoStory): GenreDeclaration | undefined {
  if (!story.genres) return undefined;
  return {
    genres: story.genres,
    ...(story.genre_guidance && { guidance: story.genre_guidance }),
  };
}

function parseKindroidTargetValue(value: string): KindroidTarget | undefined {
  const sep = value.indexOf(":");
  if (sep === -1) return undefined;
  const type = value.slice(0, sep);
  const id = value.slice(sep + 1).trim();
  if (id && (type === "ai" || type === "group")) return { type, id };
  return undefined;
}

export interface ParsedMarker {
  name: string;
  created: string;
  kindroidTarget?: KindroidTarget;
  narratorProfile?: string;
  contentRating?: ContentRating;
  position?: PositionState;
  genre?: GenreDeclaration;
}

function parseMarker(memory: OcMemory): ParsedMarker | null {
  return parseMarkerContent(memory.content);
}

function lineValue(lines: string[], prefix: string): string | undefined {
  const line = lines.find((l) => l.startsWith(prefix));
  const value = line?.slice(prefix.length).trim();
  return value || undefined;
}

/**
 * Parses the optional position block (Epoch-Date, Epoch-Location,
 * Epoch-Spot, Elapsed-Hours, Current-Location, Current-Spot). The atomic
 * invariant lives HERE, not only at write time (setPosition): Epoch-Date
 * and Epoch-Location are required together, so a marker missing either one
 * -- a hand-edit is the only way that can happen, since every write path
 * goes through setPosition -- parses as "position tracking not started"
 * (undefined), never a half-initialized object or a thrown error. An
 * unparseable Epoch-Date is treated the same way: not started, rather than
 * trusting a malformed date into current_story_datetime's arithmetic.
 */
function parsePositionState(lines: string[]): PositionState | undefined {
  const epochDate = lineValue(lines, EPOCH_DATE_PREFIX);
  const epochLocationId = lineValue(lines, EPOCH_LOCATION_PREFIX);
  if (!epochDate || !epochLocationId) return undefined;
  if (Number.isNaN(Date.parse(epochDate))) return undefined;

  const epochSpot = lineValue(lines, EPOCH_SPOT_PREFIX);
  const elapsedRaw = lineValue(lines, ELAPSED_HOURS_PREFIX);
  const elapsedHours =
    elapsedRaw !== undefined && /^-?\d+$/.test(elapsedRaw)
      ? parseInt(elapsedRaw, 10)
      : 0;
  // Current-Location defaults to the epoch location -- the state a fresh
  // setPosition() bootstrap always writes explicitly, so a missing value
  // here can only be a hand-edit; "hasn't moved yet" is the safe reading.
  const currentLocationId =
    lineValue(lines, CURRENT_LOCATION_PREFIX) ?? epochLocationId;
  const currentSpot = lineValue(lines, CURRENT_SPOT_PREFIX);

  return {
    epochDate,
    epochLocationId,
    ...(epochSpot && { epochSpot }),
    elapsedHours,
    currentLocationId,
    ...(currentSpot && { currentSpot }),
  };
}

/** Exported for the pure marker tests. */
/**
 * Reads the genre lines, or undefined when they do not validate. Validation
 * lives HERE, on the read path, not only at write time: a hand-edited marker
 * must never carry an arbitrary term or an oversized guidance string into a
 * prompt, and must never make the story unresolvable. An unusable value is
 * dropped and the story simply reads as undeclared, exactly as a malformed
 * narrator profile or content rating already does. Guidance is dropped
 * independently of genres, so a bad convention line cannot silently
 * un-declare a story's genre.
 */
function parseGenreDeclaration(lines: string[]): GenreDeclaration | undefined {
  // The reason text is ours and short (a term name or a length), never the
  // guidance prose, so this stays inside the no-content-by-default rule.
  const ignored = (field: string) => (reason: string) =>
    log.warn("story-marker", `ignoring ${field} on a story marker`, {
      reason,
    });
  const genres = parseGenresValue(
    lineValue(lines, GENRE_PREFIX),
    ignored("genre"),
  );
  if (!genres) return undefined;
  const collect = (prefix: string): string[] =>
    lines
      .filter((line) => line.startsWith(prefix))
      .map((line) => line.slice(prefix.length).trim())
      .filter((item) => item.length > 0);
  const guidance = parseGuidanceValues(
    lineValue(lines, GENRE_LEAN_PREFIX),
    collect(GENRE_CONVENTION_PREFIX),
    collect(GENRE_AVOID_PREFIX),
    ignored("genre guidance"),
  );
  return { genres, ...(guidance && { guidance }) };
}

export function parseMarkerContent(content: string): ParsedMarker | null {
  const lines = content.split("\n");
  const nameMatch = lines[0]?.match(/^\[Mnemosyne Story\] (.+)$/);
  const createdMatch = lines[1]?.match(/^Created: (\S+)$/);
  if (!nameMatch?.[1] || !createdMatch?.[1]) return null;

  const targetLine = lines.find((line) =>
    line.startsWith(KINDROID_TARGET_PREFIX),
  );
  let kindroidTarget = targetLine
    ? parseKindroidTargetValue(targetLine.slice(KINDROID_TARGET_PREFIX.length))
    : undefined;

  if (!kindroidTarget) {
    const legacyLine = lines.find((line) =>
      line.startsWith(LEGACY_KINDROID_KIN_PREFIX),
    );
    const legacyId = legacyLine
      ?.slice(LEGACY_KINDROID_KIN_PREFIX.length)
      .trim();
    if (legacyId) kindroidTarget = { type: "ai", id: legacyId };
  }

  const narratorLine = lines.find((line) =>
    line.startsWith(NARRATOR_PROFILE_PREFIX),
  );
  const narratorRaw = narratorLine
    ?.slice(NARRATOR_PROFILE_PREFIX.length)
    .trim();
  // A malformed label in a hand-edited marker is ignored rather than fatal:
  // the story must still resolve.
  const narratorProfile =
    narratorRaw && NARRATOR_PROFILE_PATTERN.test(narratorRaw)
      ? narratorRaw
      : undefined;

  // A malformed value in a hand-edited marker is ignored rather than fatal,
  // matching the narrator-profile pattern above.
  const ratingRaw = lineValue(lines, CONTENT_RATING_PREFIX);
  const contentRating = VALID_CONTENT_RATINGS.find((r) => r === ratingRaw);

  const position = parsePositionState(lines);
  const genre = parseGenreDeclaration(lines);

  return {
    name: nameMatch[1],
    created: createdMatch[1],
    ...(kindroidTarget && { kindroidTarget }),
    ...(narratorProfile && { narratorProfile }),
    ...(contentRating && { contentRating }),
    ...(position && { position }),
    ...(genre && { genre }),
  };
}

export function markerToStory(marker: OcMemory): MnemoStory | null {
  const parsed = parseMarker(marker);
  if (!parsed) return null;
  return {
    id: marker.project_id,
    name: parsed.name,
    created_at: parsed.created,
    marker_memory_id: marker.id,
    ...(parsed.kindroidTarget && { kindroid_target: parsed.kindroidTarget }),
    ...(parsed.narratorProfile && {
      narrator_profile: parsed.narratorProfile,
    }),
    ...(parsed.contentRating && { content_rating: parsed.contentRating }),
    ...(parsed.position && { position: parsed.position }),
    ...(parsed.genre && {
      genres: parsed.genre.genres,
      ...(parsed.genre.guidance && {
        genre_guidance: parsed.genre.guidance,
      }),
    }),
  };
}

/**
 * Validates and combines mutually-exclusive kin/group_id call params into a
 * single KindroidTarget. Throws when both are truthy -- a target is either
 * one AI or one group chat, never both. Shared by mnemo_story_use (a
 * persistent binding, where the caller separately tracks the null-vs-
 * undefined "clear vs leave unchanged" distinction) and mnemo_continue (a
 * one-shot per-call override, where there's no such distinction).
 */
export function combineKindroidTarget(
  kin: string | null | undefined,
  groupId: string | null | undefined,
): KindroidTarget | undefined {
  if (kin && groupId) {
    throw new Error(
      "Pass at most one of kindroid_kin / kindroid_group_id -- a target is either a single AI or a group, not both.",
    );
  }
  if (kin) return { type: "ai", id: kin };
  if (groupId) return { type: "group", id: groupId };
  return undefined;
}
