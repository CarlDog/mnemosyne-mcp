// Narrator-profile policy (docs/KINDROID_NARRATOR_DESIGN.md S2, ratified
// 2026-09-03): the label a story names its narrator persona with. It lives in
// the application layer because the continuation use case tags scenes with it
// and the story marker (an outbound concern in stories.ts) carries it; both
// must agree on one shape, and neither may reach into the other for it.

/** A narrator label is a short token: it lands in a marker line, a scene tag,
 * and a response field, none of which want whitespace or punctuation. */
export const NARRATOR_PROFILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function assertNarratorProfile(label: string): void {
  if (!NARRATOR_PROFILE_PATTERN.test(label)) {
    throw new Error(
      `narrator_profile must be 1-64 characters of letters, digits, . _ - ` +
        `starting with a letter or digit (got: ${JSON.stringify(label)}).`,
    );
  }
}

/** The tag a saved scene carries when its story names a narrator. */
export function narratorTag(label: string): string {
  return `narrator:${label}`;
}
