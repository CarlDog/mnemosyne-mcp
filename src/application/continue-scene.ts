// Shared use case: generate the next beat of the active story.
//
// This module owns the policy for continuation orchestration and remains
// transport-independent. MCP and HTTP callers are thin adapters that
// only provide transport-level input parsing and logging.

import type {
  ContentRating,
  KindroidTarget,
  Mode,
  PositionContext,
  SceneContextStrategy,
  ValidationReport,
} from "./model.js";
import { narratorTag } from "./narrator-policy.js";
import { makeRunContext, type RunContext } from "../run-context.js";
import { assertNotAborted, RunOutcomeError } from "../run-outcome.js";
import {
  estimateTokens,
  planContext,
  toManifest,
  type ContextPlanManifest,
} from "../context-plan.js";
import type {
  ContinuationBeat,
  ContinuationPort,
  ContinuationUsage,
  ContinuePositionUpdate,
} from "./ports/continuation.js";
import { classifyVerdict } from "./validation-policy.js";

export const DEFAULT_MODE: Mode = "director";

export interface ContinueSceneOptions {
  direction: string;
  mode?: Mode;
  sceneStrategy: SceneContextStrategy;
  sceneFallbackStrategy?: SceneContextStrategy;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  /** Already-combined per-call Kindroid override. Combining (and its
   * kin+group conflict throw) stays at the driver, where each caller
   * maps the error its own way (tool: bubbled message; route: 400). */
  explicitKindroidTarget?: KindroidTarget;
  /** The story's own bound Kindroid target, when the caller already
   * fetched it for its own 404 check. */
  storyKindroidTarget?: KindroidTarget;
  /** The story's narrator label, when the caller prefetched the marker. */
  storyNarratorProfile?: string;
  storyKindroidTargetPrefetched?: boolean;
  groupMaxTurns?: number;
  allowUser?: boolean;
  validate?: boolean;
  /** Surface-specific re-invoke wording for group-yield messaging,
   * e.g. "call mnemo_continue again" vs "call /stories/<id>/continue
   * again". */
  reinvokeHint: string;
  /** Position tracking convenience params (docs/POSITION_TRACKING_DESIGN.md
   * slice 4), applied before context gathering. advance and setDate are
   * mutually exclusive; moveTo is independent (the location axis). None of
   * these can bootstrap tracking -- calling any of them against a story
   * with no position tracking on is a pre-dispatch refusal naming
   * mnemo_position_set. */
  advance?: ContinuePositionUpdate["advance"];
  setDate?: string;
  moveTo?: ContinuePositionUpdate["moveTo"];
}

export interface ContinueSceneResult {
  /** Correlates this run with server logs (RUN_OUTCOMES_DESIGN). */
  run_id: string;
  yielded_to_user?: true;
  message?: string;
  saved?: false;
  /** Set when the generator reported the beat was cut off at the token
   * budget (finish reason "length"). The text is returned but NOT saved
   * as canon and NOT validated -- see the message for how to proceed. */
  incomplete?: true;
  finish_reason?: string;
  beat_name?: string;
  beat_text: string;
  memory_id?: string;
  /** The narrator persona label the story names (S2), when the story's
   * binding was consulted for this beat; the saved scene carries the same
   * label as a `narrator:<label>` tag. */
  narrator_profile?: string;
  save_error?: string;
  /** Set when a DISPATCHED OC save failed: the canonical write outcome is
   * unprovable from here (the transport may have failed after OC
   * committed). The beat text is preserved above; deciding whether to
   * re-persist (mnemo_save_entity) after checking the story is the
   * caller's call. Absent when the failure is provably pre-dispatch
   * (rate-limit rejection), which stays plainly retryable. */
  canon_write_outcome?: "unknown";
  mode: Mode;
  context_summary?: {
    rules: number;
    style: number;
    characters: number;
    locations: number;
    scenes: number;
    lore: number;
    worldbuilding: number;
  };
  /** The story's position after this call (docs/POSITION_TRACKING_DESIGN.md),
   * echoed whenever the story has tracking on -- regardless of whether THIS
   * call touched it, since gatherContext already resolves it at zero extra
   * cost. Absent when the story never opted in. */
  position?: PositionContext;
  validation?: ValidationReport;
  validation_error?: string;
  /** Warn-don't-break: options the selected provider ignores or that sit
   * outside a known range (capabilityWarnings). Never fatal. */
  capability_warnings?: string[];
  /** False when the story has no declared content_rating
   * (docs/CONTENT_ROUTING_DESIGN.md, ratified 2026-09-08) -- never blocks
   * on its own, just visible. Omitted (not `true`) when declared, since
   * there's nothing noteworthy to report once the gate has an opinion. */
  content_rating_declared?: false;
  /** The context admission manifest (CONTEXT_PLAN_DESIGN): verdict,
   * budget, section sizes, dropped-entry ids + reasons -- never bodies.
   * companion_selection lists the memory ids a companion provider's
   * keyphrase gate actually folded in (reported by the beat, so the
   * planner never re-implements the matching). */
  context_plan?: ContextPlanManifest & { companion_selection?: string[] };
  /** Provider-reported usage, generator and validator kept SEPARATE
   * (different models/prompts/cache semantics; a presentation layer can
   * sum). Absent when neither call reported any. */
  usage?: {
    generator?: ContinuationUsage;
    validator?: ContinuationUsage;
  };
  stages_ms: {
    gather_ms: number;
    generate_ms: number;
    save_ms: number;
    validate_ms: number;
  };
  group_ended?: ContinuationBeat["groupEnded"];
  group_turns?: number;
}

/**
 * The shared continue core: gather context -> resolve the Kindroid
 * target -> generate -> group-yield detection -> save-first scene
 * persist -> optional validation -> verdict retag -> response assembly.
 * Both MCP and HTTP route paths call this.
 *
 * The body below is a readable top-to-bottom sequence of named phase
 * functions (defined after this one, in call order) -- split out 2026-09-08
 * (phase-end audit) for skimmability. No behavior change from the split;
 * every phase function's inputs/outputs, and the try/catch + abort-check
 * placements between them, are exactly what continueScene did inline
 * before. See git history for the pre-split version if a diff is ever
 * needed.
 */
export async function continueScene(
  port: ContinuationPort,
  storyId: string,
  opts: ContinueSceneOptions,
  run: RunContext = makeRunContext("mcp", { storyId }),
): Promise<ContinueSceneResult> {
  const mode = opts.mode ?? DEFAULT_MODE;

  // Checked BEFORE the position write below, not just before context
  // gathering: a run that's already aborted (or disconnected) when this
  // call begins must not silently apply advance/set_date/move_to at all.
  assertNotAborted(run, "the position update");

  // Position update (docs/POSITION_TRACKING_DESIGN.md refinement 4),
  // applied BEFORE context gathering so the beat is generated already
  // knowing the new date/place. A successful update is NOT rolled back if
  // generation subsequently fails -- the operator's explicit directive is a
  // fact about the story regardless of whether a beat describing it gets
  // written (mirrors mnemo_session_break's break-then-save precedent: the
  // first mutation stands even if a later step fails). The atomic
  // invariant enforced inside mergePositionUpdate (position.ts, via
  // applyPosition) doubles as the not-yet-initialized refusal these
  // convenience params need for free: none of advance/setDate/moveTo can
  // supply epoch_date/epoch_location, so calling any of them against an
  // untracked story throws "hasn't started... use mnemo_position_set"
  // before anything is dispatched.
  const positionApplied = await applyPositionIfRequested(port, storyId, opts);

  // Everything below, through the generate dispatch, is still nominally
  // "pre-dispatch" -- but if the position write above just landed,
  // rejected_before_dispatch's stock retry_safe:true is now a lie: the
  // identical call re-run would re-apply advance/set_date/move_to a
  // second time. Catch and relabel rather than change each individual
  // throw site (context gathering's own abort check, context-admission
  // rejection, the generate-dispatch abort check), so a future phase
  // boundary added in this span inherits the same honesty for free.
  //
  // Reviewed 2026-09-08 whether this should move into the phase boundary
  // itself (a named wrapper, or a guard returned from
  // applyPositionIfRequested) -- rejected: neither alternative actually
  // prevents a future phase inserted between applyPositionIfRequested and
  // dispatchGenerate from skipping the relabel, since both still require
  // the same call-site discipline this comment does. Kept as a lexical
  // try/catch around exactly one call. If a new phase function ever goes
  // in this span, it must sit inside this try/catch (or get its own
  // relabel) -- and tests/continue-scene-phases.test.ts must grow a case
  // for it.
  let gathered: GatherAndPlanResult;
  try {
    gathered = await gatherAndPlan(port, storyId, opts, mode, run);
  } catch (err) {
    if (positionApplied && err instanceof RunOutcomeError) {
      throw new RunOutcomeError(err.outcome, positionAppliedNote(err.message), {
        retrySafe: false,
      });
    }
    throw err;
  }
  const {
    context,
    contextPlan,
    renderedContext,
    systemPrompt,
    kindroidTarget,
    narratorProfile,
    capability_warnings,
    gatherMs,
    planResult,
  } = gathered;

  const { beat, generateMs } = await dispatchGenerate(
    port,
    opts,
    context.content_rating,
    positionApplied,
    systemPrompt,
    renderedContext,
    kindroidTarget,
    planResult,
    contextPlan,
  );
  const beatText = beat.text;
  const groupMeta = {
    ...(beat.groupEnded !== undefined && { group_ended: beat.groupEnded }),
    ...(beat.groupTurns !== undefined && { group_turns: beat.groupTurns }),
  };
  const common: CommonResponseFields = {
    runId: run.runId,
    capability_warnings,
    contentRatingDeclared: context.content_rating !== undefined,
    contextPlan,
    position: context.position,
    mode,
    gatherMs,
    generateMs,
    groupMeta,
  };

  // A group can hand the floor back before anyone speaks (allow_user:
  // true only). Nothing was generated, so there is no beat to save --
  // saving an empty scene would poison both recall and the validator.
  // The direction itself HAS already been posted to the group by
  // advanceGroup, so say so: the caller must continue the scene, not
  // re-send, or the group sees it twice.
  if (beatText.trim() === "") {
    return buildGroupYieldResponse(common, opts.reinvokeHint);
  }

  // An incomplete beat -- the provider reports the output was cut off at
  // the token budget (finish reason "length") -- must not become canon by
  // auto-save: a scene that stops mid-sentence poisons recall and reads as
  // authored truth (docs/OLLAMA_ADOPTION_ASSESSMENT.md §1). The costly
  // text is still returned so nothing is lost; saving it is a deliberate
  // caller decision, not a default. No silent retry either: a second
  // generation is a different scene, not this one finished.
  if (beat.complete === false) {
    return buildIncompleteResponse(common, beatText, beat);
  }

  // Guard the save: the beat is an expensive LLM generation, and a
  // transient OC write failure must not discard it. On save error,
  // still return the beat text with a save_error field so the user
  // can retry the persist (e.g., via mnemo_save_entity) without
  // regenerating.
  const {
    beatName,
    memoryId,
    savedTags,
    saveError,
    canonWriteUnknown,
    saveMs,
  } = await saveBeat(port, storyId, beatText, narratorProfile);

  const { validation, validatorUsage, validationError, validateMs } =
    await validateBeat(port, context, beatText, opts.validate);

  // Tag the saved scene with its validation verdict (v0.1.3
  // validator-gated inclusion — see STATUS.md). Only when both the
  // save succeeded and a verdict was actually produced: no memoryId
  // means nothing to tag, no validation means no verdict to classify
  // (validate=false, or the validator pass itself failed). Best-effort
  // metadata — must never fail the call for an already-saved beat.
  await retagIfValidated(port, memoryId, savedTags, validation);

  return {
    run_id: run.runId,
    ...(capability_warnings.length > 0 && { capability_warnings }),
    ...(context.content_rating === undefined && {
      content_rating_declared: false,
    }),
    context_plan: contextPlan,
    ...(context.position && { position: context.position }),
    beat_name: beatName,
    beat_text: beatText,
    ...(memoryId !== undefined && { memory_id: memoryId }),
    ...(narratorProfile !== undefined && {
      narrator_profile: narratorProfile,
    }),
    ...(saveError !== undefined && { save_error: saveError }),
    ...(canonWriteUnknown && { canon_write_outcome: "unknown" as const }),
    mode,
    context_summary: {
      rules: context.rules.length,
      style: context.style.length,
      characters: context.characters.length,
      locations: context.locations.length,
      scenes: context.scenes.length,
      lore: context.lore.length,
      worldbuilding: context.worldbuilding.length,
    },
    ...(validation !== undefined && { validation }),
    ...(validationError !== undefined && {
      validation_error: validationError,
    }),
    ...((beat.usage !== undefined || validatorUsage !== undefined) && {
      usage: {
        ...(beat.usage !== undefined && { generator: beat.usage }),
        ...(validatorUsage !== undefined && { validator: validatorUsage }),
      },
    }),
    stages_ms: {
      gather_ms: gatherMs,
      generate_ms: generateMs,
      save_ms: saveMs,
      validate_ms: validateMs,
    },
    ...groupMeta,
  };
}

// --- Phase functions, in the order continueScene() calls them -------------

/** Position update phase. Returns whether a position write actually landed
 * (false when the caller passed none of advance/setDate/moveTo -- the
 * common case). Throws RunOutcomeError on failure; continueScene's own
 * abort check for this phase runs before calling this, not inside it. */
async function applyPositionIfRequested(
  port: ContinuationPort,
  storyId: string,
  opts: ContinueSceneOptions,
): Promise<boolean> {
  if (!opts.advance && opts.setDate === undefined && !opts.moveTo) {
    return false;
  }
  try {
    await port.applyPosition(storyId, {
      advance: opts.advance,
      setDate: opts.setDate,
      moveTo: opts.moveTo,
    });
    return true;
  } catch (err) {
    // Accepted residual (docs/POSITION_TRACKING_DESIGN.md refinement 5):
    // this catch cannot distinguish "the write never reached OC" from
    // "OC committed it but the response was lost" -- a transport error
    // here always reports rejected_before_dispatch/retry_safe:true even
    // in the second, rarer case. Every other single-write OC path in
    // this codebase carries the same ambiguity; resolving it needs error
    // typing this repo doesn't have yet, so it's documented rather than
    // silently claimed fixed.
    throw new RunOutcomeError(
      "rejected_before_dispatch",
      (err as Error).message,
    );
  }
}

interface GatherAndPlanResult {
  context: Awaited<ReturnType<ContinuationPort["gatherContext"]>>;
  contextPlan: ContextPlanManifest & { companion_selection?: string[] };
  renderedContext: ReturnType<ContinuationPort["renderAdmittedContext"]>;
  systemPrompt: string;
  kindroidTarget: KindroidTarget | undefined;
  narratorProfile: string | undefined;
  capability_warnings: string[];
  gatherMs: number;
  planResult: ReturnType<typeof planContext>;
}

/** Gather context, run context admission, render the admitted set into a
 * system prompt, resolve the effective Kindroid target/narrator profile,
 * and collect capability warnings. Throws RunOutcomeError on an enforced
 * context-admission rejection; continueScene's positionApplied relabeling
 * wraps the call to this function, not any logic inside it. */
async function gatherAndPlan(
  port: ContinuationPort,
  storyId: string,
  opts: ContinueSceneOptions,
  mode: Mode,
  run: RunContext,
): Promise<GatherAndPlanResult> {
  // Phase-boundary abort checks (RUN_OUTCOMES_DESIGN, ratified): before
  // gather and before the generate dispatch -- NEVER after generation has
  // been dispatched, so a disconnected caller's beat still completes and
  // saves (the tokens are spent; the scene is recoverable afterwards).
  assertNotAborted(run, "context gathering");

  const gatherStart = Date.now();
  const context = await port.gatherContext(storyId, opts.direction, {
    sceneStrategy: opts.sceneStrategy,
    sceneFallbackStrategy: opts.sceneFallbackStrategy,
    signal: run.signal,
  });
  const gatherMs = Date.now() - gatherStart;

  // Context admission (CONTEXT_PLAN_DESIGN, ratified). The budget is the
  // Ollama effective window when the generator can supply one (cached
  // /api/show); cloud windows are all-unknown by ratified decision, so
  // those plans instrument without dropping.
  let inputBudget: number | undefined;
  const window = await port.effectiveContextWindow(opts.model);
  if (typeof window === "number") inputBudget = window;
  const emptyBundle = {
    rules: [],
    style: [],
    characters: [],
    locations: [],
    scenes: [],
    lore: [],
    worldbuilding: [],
  };
  const planResult = planContext(context.entries ?? [], {
    provider: port.generatorName,
    model: opts.model,
    inputBudget,
    outputReserve: opts.maxTokens ?? port.defaultMaxTokens,
    estFixedTokens: estimateTokens(
      port.buildSystemPrompt(mode, emptyBundle).length,
    ),
    directionChars: opts.direction.length,
    marginTokens: port.contextMarginTokens,
  });
  const contextPlan: ContextPlanManifest & { companion_selection?: string[] } =
    toManifest(planResult.plan, planResult.entries);
  if (planResult.plan.verdict === "rejected") {
    const detail =
      "protected rules/style plus the direction alone exceed the " +
      `effective context window (${inputBudget} tokens, model-aware). ` +
      "Nothing droppable would make this fit -- trim rules/style, raise " +
      "OLLAMA_NUM_CTX (within the model's trained context), or use a " +
      "larger-context model.";
    if (port.admissionMode === "enforce") {
      throw new RunOutcomeError("rejected_before_dispatch", detail);
    }
    port.warn("continueScene", "context plan rejected (warn mode)", {
      run_id: run.runId,
      input_budget: inputBudget,
    });
  }

  // Plan-driven rendering: the prompt contains exactly the admitted set,
  // so the manifest can never describe a payload the model didn't see.
  const admittedIds = new Set(planResult.admitted.map((e) => e.memory_id));
  const renderedContext = port.renderAdmittedContext(context, admittedIds);
  const systemPrompt = port.buildSystemPrompt(mode, renderedContext);

  // Only fetch the story marker (an extra OC round trip) when it could
  // actually matter: no explicit override, a story-bound target is
  // meaningless to any generator but Kindroid, and the caller didn't
  // already fetch it.
  let storyTarget = opts.storyKindroidTarget;
  let narratorProfile = opts.storyNarratorProfile;
  if (
    !opts.storyKindroidTargetPrefetched &&
    opts.explicitKindroidTarget === undefined &&
    port.generatorName === "kindroid"
  ) {
    const binding = await port.storyBinding(storyId);
    storyTarget = binding.kindroidTarget;
    narratorProfile = binding.narratorProfile;
  }
  const kindroidTarget =
    opts.explicitKindroidTarget ??
    (port.generatorName === "kindroid" ? storyTarget : undefined);

  // Warn-don't-break (GENERATOR_CAPABILITIES_DESIGN, ratified): options
  // the provider ignores produce a response warning, never an error --
  // legacy callers keep working.
  const capability_warnings = port.capabilityWarnings({
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    model: opts.model,
  });

  assertNotAborted(run, "the generate dispatch");

  return {
    context,
    contextPlan,
    renderedContext,
    systemPrompt,
    kindroidTarget,
    narratorProfile,
    capability_warnings,
    gatherMs,
    planResult,
  };
}

/** Wraps a pre-dispatch failure's message/retry-safety when a position
 * write already landed this call (docs/POSITION_TRACKING_DESIGN.md
 * refinement 5) -- shared by continueScene's gatherAndPlan catch and
 * dispatchGenerate's content-routing gate below, the two throw sites in
 * the position-write's "still nominally pre-dispatch" span. Extracted
 * rather than duplicated per the 2026-09-08 decision to keep this a plain
 * try/catch (+ its own relabel) instead of restructuring the phase
 * boundary -- see continueScene's comment above the try/catch. */
function positionAppliedNote(message: string): string {
  return (
    `${message} -- NOTE: this call's advance/set_date/move_to already ` +
    "applied to the story's position before this failure and was NOT " +
    "rolled back (mirrors mnemo_session_break's break-then-save " +
    "precedent). Retrying this exact call will apply the position " +
    "change again -- check mnemo_position_get before deciding whether " +
    "to retry."
  );
}

interface DispatchGenerateResult {
  beat: ContinuationBeat;
  generateMs: number;
}

/** The content-routing gate (docs/CONTENT_ROUTING_DESIGN.md, ratified
 * 2026-09-08), then dispatch generation and record estimator calibration.
 * Mutates contextPlan.companion_selection in place when the beat reports
 * one (same as the pre-split inline code -- the manifest object is shared
 * with the caller, not copied).
 *
 * The gate sits here, before port.generate() is invoked, rather than
 * earlier in continueScene -- it needs context.content_rating, which
 * gatherAndPlan resolves at zero extra cost (piggybacking on the same
 * story-marker fetch position already needed), so checking any earlier
 * would mean a dedicated OC round trip on every single call. */
async function dispatchGenerate(
  port: ContinuationPort,
  opts: ContinueSceneOptions,
  contentRating: ContentRating | undefined,
  positionApplied: boolean,
  systemPrompt: string,
  renderedContext: ReturnType<ContinuationPort["renderAdmittedContext"]>,
  kindroidTarget: KindroidTarget | undefined,
  planResult: ReturnType<typeof planContext>,
  contextPlan: ContextPlanManifest & { companion_selection?: string[] },
): Promise<DispatchGenerateResult> {
  if (contentRating === "nsfw" && port.contentCapability === "sfw") {
    const detail =
      "This story requires an nsfw content rating, but the configured " +
      `generator (${port.generatorName}) is only sfw-capable. Either ` +
      "deploy with an nsfw-capable provider, or set this story's content " +
      'rating explicitly via mnemo_story_use if "nsfw" was set in error.';
    throw new RunOutcomeError(
      "rejected_before_dispatch",
      positionApplied ? positionAppliedNote(detail) : detail,
      positionApplied ? { retrySafe: false } : undefined,
    );
  }
  const generateStart = Date.now();
  const beat = await port.generate({
    systemPrompt,
    userMessage: opts.direction,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    model: opts.model,
    context: renderedContext,
    kindroidTarget,
    groupMaxTurns: opts.groupMaxTurns,
    allowUser: opts.allowUser,
  });
  const generateMs = Date.now() - generateStart;
  if (beat.context_selection !== undefined) {
    contextPlan.companion_selection = beat.context_selection;
  }
  // Estimator calibration (stage 1): logged, never substituted.
  port.calibration(
    planResult.plan.est_fixed_tokens +
      planResult.plan.est_direction_tokens +
      planResult.admitted.reduce((sum, e) => sum + e.est_tokens, 0),
    beat.usage?.input_tokens,
  );
  return { beat, generateMs };
}

/** Fields common to both early-return responses (group-yield, incomplete)
 * and shared with the final success response -- bundled once at the call
 * site so the two response builders below take one param instead of eight
 * positional ones. */
interface CommonResponseFields {
  runId: string;
  capability_warnings: string[];
  /** True when the story declared a content rating -- see
   * ContinueSceneResult.content_rating_declared for the response shape
   * this drives (surfaced only when false). */
  contentRatingDeclared: boolean;
  contextPlan: ContextPlanManifest & { companion_selection?: string[] };
  position: PositionContext | undefined;
  mode: Mode;
  gatherMs: number;
  generateMs: number;
  groupMeta: Pick<ContinueSceneResult, "group_ended" | "group_turns">;
}

/** A group handed the floor back before anyone spoke (allow_user: true
 * only) -- nothing was generated, so there is no beat to save. */
function buildGroupYieldResponse(
  common: CommonResponseFields,
  reinvokeHint: string,
): ContinueSceneResult {
  return {
    run_id: common.runId,
    ...(common.capability_warnings.length > 0 && {
      capability_warnings: common.capability_warnings,
    }),
    ...(!common.contentRatingDeclared && { content_rating_declared: false }),
    context_plan: common.contextPlan,
    ...(common.position && { position: common.position }),
    yielded_to_user: true,
    beat_text: "",
    saved: false,
    message:
      "The group handed the floor straight back to you -- no AI " +
      "turns were generated, so nothing was saved. Your direction " +
      "was already posted to the group; do not re-send it. Take " +
      `the turn: ${reinvokeHint} with what you say next.`,
    mode: common.mode,
    stages_ms: {
      gather_ms: common.gatherMs,
      generate_ms: common.generateMs,
      save_ms: 0,
      validate_ms: 0,
    },
    ...common.groupMeta,
  };
}

/** The provider reported the beat was cut off at the token budget --
 * returned but deliberately not saved or validated. */
function buildIncompleteResponse(
  common: CommonResponseFields,
  beatText: string,
  beat: ContinuationBeat,
): ContinueSceneResult {
  return {
    run_id: common.runId,
    ...(common.capability_warnings.length > 0 && {
      capability_warnings: common.capability_warnings,
    }),
    ...(!common.contentRatingDeclared && { content_rating_declared: false }),
    context_plan: common.contextPlan,
    ...(common.position && { position: common.position }),
    incomplete: true,
    saved: false,
    beat_text: beatText,
    ...(beat.finishReason !== undefined && {
      finish_reason: beat.finishReason,
    }),
    ...(beat.usage !== undefined && { usage: { generator: beat.usage } }),
    message:
      "The generator hit its output-token budget before finishing the " +
      "beat (finish reason 'length'). The text below was NOT saved as a " +
      "scene and NOT validated. Either raise max_tokens and regenerate, " +
      "or -- after reviewing it -- save the partial deliberately via " +
      "mnemo_save_entity (type 'scene').",
    mode: common.mode,
    stages_ms: {
      gather_ms: common.gatherMs,
      generate_ms: common.generateMs,
      save_ms: 0,
      validate_ms: 0,
    },
    ...common.groupMeta,
  };
}

interface SaveBeatResult {
  beatName: string;
  memoryId: string | undefined;
  savedTags: string[] | undefined;
  saveError: string | undefined;
  canonWriteUnknown: boolean;
  saveMs: number;
}

/** Persist the beat as a scene. A save failure is captured, not thrown --
 * the expensive generation must not be discarded on a transient OC write
 * failure; the caller gets save_error and can retry the persist. */
async function saveBeat(
  port: ContinuationPort,
  storyId: string,
  beatText: string,
  narratorProfile: string | undefined,
): Promise<SaveBeatResult> {
  const saveStart = Date.now();
  const beatName = `Scene ${port.nowIso()}`;
  let memoryId: string | undefined;
  let savedTags: string[] | undefined;
  let saveError: string | undefined;
  try {
    const saved = await port.saveScene(
      storyId,
      beatName,
      beatText,
      narratorProfile ? [narratorTag(narratorProfile)] : undefined,
    );
    memoryId = saved.memory_id;
    savedTags = saved.tags;
  } catch (err) {
    saveError = (err as Error).message;
    port.warn("continueScene", "scene save failed", { msg: saveError });
  }
  // A dispatched-save failure leaves the canonical write outcome UNKNOWN
  // (RUN_OUTCOMES_DESIGN, ratified): the transport may have failed after
  // OC committed. Success-shaped -- the beat text is preserved and the
  // caller decides. The one provably-pre-dispatch failure is OC's
  // rate-limit rejection (its middleware rejects before handler
  // dispatch), which stays a plainly retryable save_error.
  const canonWriteUnknown =
    saveError !== undefined && !/rate limit/i.test(saveError);
  const saveMs = Date.now() - saveStart;
  return {
    beatName,
    memoryId,
    savedTags,
    saveError,
    canonWriteUnknown,
    saveMs,
  };
}

interface ValidateBeatResult {
  validation: ValidationReport | undefined;
  validatorUsage: ContinuationUsage | undefined;
  validationError: string | undefined;
  validateMs: number;
}

/** Optional validation pass. Returns all-undefined/zero-ms when the caller
 * didn't ask for validation -- same shape either way, so the caller never
 * branches on whether this ran. */
async function validateBeat(
  port: ContinuationPort,
  context: Awaited<ReturnType<ContinuationPort["gatherContext"]>>,
  beatText: string,
  shouldValidate: boolean | undefined,
): Promise<ValidateBeatResult> {
  if (!shouldValidate) {
    return {
      validation: undefined,
      validatorUsage: undefined,
      validationError: undefined,
      validateMs: 0,
    };
  }
  const validateStart = Date.now();
  let validation: ValidationReport | undefined;
  let validatorUsage: ContinuationUsage | undefined;
  let validationError: string | undefined;
  try {
    const outcome = await port.validate(context, beatText);
    validation = outcome.report;
    validatorUsage = outcome.usage;
  } catch (err) {
    validationError = (err as Error).message;
    port.warn("continueScene", "validation pass failed", {
      msg: validationError,
    });
  }
  const validateMs = Date.now() - validateStart;
  return { validation, validatorUsage, validationError, validateMs };
}

/** Tag the saved scene with its validation verdict (v0.1.3 validator-gated
 * inclusion — see STATUS.md). Only when both the save succeeded and a
 * verdict was actually produced: no memoryId means nothing to tag, no
 * validation means no verdict to classify (validate=false, or the
 * validator pass itself failed). Best-effort metadata — must never fail
 * the call for an already-saved beat. */
async function retagIfValidated(
  port: ContinuationPort,
  memoryId: string | undefined,
  savedTags: string[] | undefined,
  validation: ValidationReport | undefined,
): Promise<void> {
  if (
    memoryId === undefined ||
    savedTags === undefined ||
    validation === undefined
  ) {
    return;
  }
  try {
    await port.retagValidation(
      memoryId,
      savedTags,
      classifyVerdict(validation),
    );
  } catch (err) {
    port.warn("continueScene", "validation retag failed", {
      msg: (err as Error).message,
    });
  }
}

export type ContinueScene = (
  storyId: string,
  options: ContinueSceneOptions,
  run?: RunContext,
) => Promise<ContinueSceneResult>;

export function createContinueScene(port: ContinuationPort): ContinueScene {
  return (storyId, options, run) => continueScene(port, storyId, options, run);
}
