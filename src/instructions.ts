// The MCP `instructions` string handed to every McpServer instance -- what a
// host LLM reads to learn this server's surface before calling anything.
//
// Lifted out of index.ts: it is ~60 lines of prose with no dependencies, and
// it sat between the provider construction and the transport wiring, which is
// the shape that made that file hard to read.

export const INSTRUCTIONS = `MCP server for long-form storytelling on top of OpenChronicle (OC) memory.
Mnemosyne owns narrative logic; OC owns persistent memory. Each Mnemosyne
story is one OC project bearing a Mnemosyne story marker memory; other
OC projects are not visible through this MCP.

v0 surface:
- mnemo_story_list — list Mnemosyne stories
- mnemo_story_use(name_or_id, create_if_missing?, kindroid_kin?,
  kindroid_group_id?) — set active story. kindroid_kin/kindroid_group_id
  (mutually exclusive) optionally bind this story to a specific Kindroid
  AI or group chat (GENERATOR_PROVIDER=kindroid only); null clears.
- Every tool below that operates on "the active story" also accepts an
  optional story? (name or OC project UUID) that overrides the active
  story for that one call only, without touching the mnemo_story_use
  pointer — the same convention mnemo_export_story already used.
- mnemo_save_entity(type, name, content, pinned?, extra_tags?, story?) —
  write a character/location/rule/style/scene/lore/worldbuilding entry to
  the active story. Overwrites by (type, name).
- mnemo_recall(query?, type?, limit?, story?) — semantic recall over the
  active story's entities (ranked, capped).
- mnemo_list_entities(type?, include_body?, story?) — complete, unranked
  enumeration of every entity in the story (nothing capped or left out).
  Body omitted by default (include_body=true to get it); every entity
  carries created_at for caller-side sorting.
- mnemo_delete_entity(type, name, story?) — delete one entity from the
  active story by (type, name).
- mnemo_continue(direction, mode?, max_tokens?, temperature?, model?,
  kindroid_kin?, kindroid_group_id?, scene_context_strategy?,
  scene_context_fallback_strategy?, validate?, story?) — pull context
  from OC, generate the next beat via the generator LLM, auto-save the
  result as a scene entity. Mode defaults to 'director'. model overrides
  the generator's default model for this call (honored by every
  direct-LLM provider -- ollama, anthropic, openai, gemini, atlascloud;
  ignored by kindroid/botify); kindroid_kin/kindroid_group_id override
  the Kindroid target for this call only. With validate=true, runs an
  LLM second pass and attaches a verdict (issues + summary) to the
  response.
- mnemo_validate(content, story?) — standalone validation pass over
  arbitrary content (hand-written prose, previously-saved beats being
  re-audited). Same ValidationReport shape as mnemo_continue's
  validate=true mode. No scene-context params: validation contexts pull
  only rules/style/characters/locations (the validator never reads
  scenes), so a scene strategy has nothing to control here.
- mnemo_revalidate_scenes(story?) — re-run the validator over every
  scene in the active story and retag validation:clean/errors.
- mnemo_export_story(name_or_id?, out_path?) — serialize a story (every
  entity + its Kindroid binding, if any) to a versioned JSON document on
  disk. Defaults to the active story. Returns a manifest (path, per-type
  counts, skipped ids); the document itself lives in the file.
- mnemo_import_story(entities? | file_path?, dry_run?, on_conflict?,
  story?) — batch-write already-classified entities into the active
  story, or restore a mnemosyne export document. The caller classifies;
  this tool validates and writes. Conflicts abort the batch by default
  (on_conflict=error); dry_run previews the plan without writing.`;
