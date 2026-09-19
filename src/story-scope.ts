// The one assertion that a story scope is actually present.
//
// OpenChronicle treats an ABSENT project scope as "every project":
// memory_search with no project_id searches the whole database and
// memory_list with no project_id enumerates it. Neither errors, and neither
// says so in the result -- an unscoped query looks exactly like a scoped one
// that happened to match a lot.
//
// Two things let an absent scope reach OC while the call site still reads as
// scoped. A `storyId: string` parameter is a compile-time claim only, so an
// undefined arriving from a mistyped or untyped field flows straight through
// (this project does not set exactOptionalPropertyTypes, so `projectId:
// undefined` type-checks too). And a `{ project_id: undefined }` argument is
// dropped entirely by JSON.stringify on the wire, so the field does not
// arrive as null for OC to reject -- it simply is not there.
//
// The failure that follows is silent and shaped like success. Reproduced live
// 2026-09-19: a call of the form
//
//   saveEntity(oc, story.project_id, { type: "rule", name: "Content Framing", body })
//
// passed undefined, because MnemoStory's OC project id field is `id`, not
// `project_id`. The unscoped dedupe search matched a `[Rule] Content Framing`
// belonging to an unrelated story, saveEntity took its overwrite branch, and
// memory_update replaced that other story's memory in place. It returned
// created:false and a memory id and nothing complained; it was caught only
// because the caller happened to read the record back. That is the
// read-modify-write that corrupts rather than errors which the fleet
// mcp-server-authoring rule names.
//
// So the scope is asserted twice: at each story-scoped entry point in
// entities.ts, before its first OC call, and again at the OcClient wire
// methods that widen when it is missing. The one deliberate cross-project
// read (listStories, which must see every story's marker) declares itself
// with an explicit allProjects flag instead of by omitting a field, so every
// exception to the rule is greppable rather than inferred from an absence.

function describeScopeValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  return typeof value;
}

/**
 * Throw unless `value` is a non-empty, non-whitespace story (OC project) id.
 * Call it before the first OpenChronicle call of any story-scoped operation.
 *
 * `param` names the offending parameter, qualified by its function
 * ("saveEntity storyId"), so a throw from deep in a call chain says which
 * caller supplied the bad value. `alsoAllowed` appends the escape hatch for
 * the one surface that has one (memorySearch's allProjects).
 */
export function assertStoryScope(
  value: unknown,
  param: string,
  alsoAllowed?: string,
): void {
  if (typeof value === "string" && value.trim() !== "") return;
  throw new Error(
    `${param} must be a non-empty story id (an OpenChronicle project id); ` +
      `received ${describeScopeValue(value)}. OpenChronicle treats a missing ` +
      "project scope as EVERY project, so an unscoped call can read, " +
      "overwrite, or delete another story's memories. " +
      (alsoAllowed ? `${alsoAllowed} ` : "") +
      "No OpenChronicle call was made.",
  );
}
