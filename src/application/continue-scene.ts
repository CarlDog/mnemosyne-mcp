// Shared use case: generate the next beat of the active story.
//
// This module owns the policy for continuation orchestration and remains
// transport-independent. MCP and HTTP callers are thin adapters that
// only provide transport-level input parsing and logging.

import type { OcClient } from "../oc-client.js";
import type { GeneratedBeat, LlmProvider, ModelUsage } from "../llm.js";
import {
  buildSystemPrompt,
  gatherContext,
  type Mode,
  type SceneContextStrategy,
  renderAdmittedBundle,
} from "../prompt.js";
import { saveEntity, retagValidation } from "../entities.js";
import { findStory, type KindroidTarget } from "../stories.js";
import { resolveKindroidTarget } from "../kindroid-provider.js";
import {
  classifyVerdict,
  validateContentWithUsage,
  type ValidationReport,
} from "../validator.js";
import { log } from "../log.js";
import { makeRunContext, type RunContext } from "../run-context.js";
import { assertNotAborted, RunOutcomeError } from "../run-outcome.js";
import { capabilityWarnings } from "../capabilities.js";
import {
  admissionModeFromEnv,
  estimateTokens,
  logCalibration,
  planContext,
  toManifest,
  type ContextPlanManifest,
} from "../context-plan.js";
import {
  DEFAULT_MAX_TOKENS,
  NUM_CTX_MARGIN_TOKENS,
  OllamaProvider,
} from "../llm.js";

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
  storyKindroidTargetPrefetched?: boolean;
  groupMaxTurns?: number;
  allowUser?: boolean;
  validate?: boolean;
  /** Surface-specific re-invoke wording for group-yield messaging,
   * e.g. "call mnemo_continue again" vs "call /stories/<id>/continue
   * again". */
  reinvokeHint: string;
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
  validation?: ValidationReport;
  validation_error?: string;
  /** Warn-don't-break: options the selected provider ignores or that sit
   * outside a known range (capabilityWarnings). Never fatal. */
  capability_warnings?: string[];
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
    generator?: ModelUsage;
    validator?: ModelUsage;
  };
  stages_ms: {
    gather_ms: number;
    generate_ms: number;
    save_ms: number;
    validate_ms: number;
  };
  group_ended?: GeneratedBeat["groupEnded"];
  group_turns?: number;
}

/**
 * The shared continue core: gather context -> resolve the Kindroid
 * target -> generate -> group-yield detection -> save-first scene
 * persist -> optional validation -> verdict retag -> response assembly.
 * Both MCP and HTTP route paths call this.
 */
export async function continueScene(
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
  storyId: string,
  opts: ContinueSceneOptions,
  run: RunContext = makeRunContext("mcp", { storyId }),
): Promise<ContinueSceneResult> {
  const mode = opts.mode ?? DEFAULT_MODE;

  // Phase-boundary abort checks (RUN_OUTCOMES_DESIGN, ratified): before
  // gather and before the generate dispatch -- NEVER after generation has
  // been dispatched, so a disconnected caller's beat still completes and
  // saves (the tokens are spent; the scene is recoverable afterwards).
  assertNotAborted(run, "context gathering");

  const gatherStart = Date.now();
  const context = await gatherContext(oc, storyId, opts.direction, {
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
  if (generator instanceof OllamaProvider) {
    const window = await generator.getEffectiveContextWindow(opts.model);
    if (typeof window === "number") inputBudget = window;
  }
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
    provider: generator.name,
    model: opts.model,
    inputBudget,
    outputReserve: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    estFixedTokens: estimateTokens(buildSystemPrompt(mode, emptyBundle).length),
    directionChars: opts.direction.length,
    marginTokens: NUM_CTX_MARGIN_TOKENS,
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
    if (admissionModeFromEnv() === "enforce") {
      throw new RunOutcomeError("rejected_before_dispatch", detail);
    }
    log.warn("continueScene", "context plan rejected (warn mode)", {
      run_id: run.runId,
      input_budget: inputBudget,
    });
  }

  // Plan-driven rendering: the prompt contains exactly the admitted set,
  // so the manifest can never describe a payload the model didn't see.
  const admittedIds = new Set(planResult.admitted.map((e) => e.memory_id));
  const renderedContext = renderAdmittedBundle(context, admittedIds);
  const systemPrompt = buildSystemPrompt(mode, renderedContext);

  // Only fetch the story marker (an extra OC round trip) when it could
  // actually matter: no explicit override, a story-bound target is
  // meaningless to any generator but Kindroid, and the caller didn't
  // already fetch it.
  let storyTarget = opts.storyKindroidTarget;
  if (
    !opts.storyKindroidTargetPrefetched &&
    opts.explicitKindroidTarget === undefined &&
    generator.name === "kindroid"
  ) {
    const story = await findStory(oc, storyId);
    storyTarget = story?.kindroid_target;
  }
  const kindroidTarget = resolveKindroidTarget(
    opts.explicitKindroidTarget,
    generator.name,
    storyTarget,
  );

  // Warn-don't-break (GENERATOR_CAPABILITIES_DESIGN, ratified): options
  // the provider ignores produce a response warning, never an error --
  // legacy callers keep working.
  const capability_warnings = capabilityWarnings(generator.name, {
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    model: opts.model,
  });

  assertNotAborted(run, "the generate dispatch");

  const generateStart = Date.now();
  const beat = await generator.generate({
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
  logCalibration(
    planResult.plan.est_fixed_tokens +
      planResult.plan.est_direction_tokens +
      planResult.admitted.reduce((sum, e) => sum + e.est_tokens, 0),
    beat.usage?.input_tokens,
  );
  const beatText = beat.text;
  const groupMeta = {
    ...(beat.groupEnded !== undefined && { group_ended: beat.groupEnded }),
    ...(beat.groupTurns !== undefined && { group_turns: beat.groupTurns }),
  };

  // A group can hand the floor back before anyone speaks (allow_user:
  // true only). Nothing was generated, so there is no beat to save --
  // saving an empty scene would poison both recall and the validator.
  // The direction itself HAS already been posted to the group by
  // advanceGroup, so say so: the caller must continue the scene, not
  // re-send, or the group sees it twice.
  if (beatText.trim() === "") {
    return {
      run_id: run.runId,
      ...(capability_warnings.length > 0 && { capability_warnings }),
      context_plan: contextPlan,
      yielded_to_user: true,
      beat_text: "",
      saved: false,
      message:
        "The group handed the floor straight back to you -- no AI " +
        "turns were generated, so nothing was saved. Your direction " +
        "was already posted to the group; do not re-send it. Take " +
        `the turn: ${opts.reinvokeHint} with what you say next.`,
      mode,
      stages_ms: {
        gather_ms: gatherMs,
        generate_ms: generateMs,
        save_ms: 0,
        validate_ms: 0,
      },
      ...groupMeta,
    };
  }

  // An incomplete beat -- the provider reports the output was cut off at
  // the token budget (finish reason "length") -- must not become canon by
  // auto-save: a scene that stops mid-sentence poisons recall and reads as
  // authored truth (docs/OLLAMA_ADOPTION_ASSESSMENT.md §1). The costly
  // text is still returned so nothing is lost; saving it is a deliberate
  // caller decision, not a default. No silent retry either: a second
  // generation is a different scene, not this one finished.
  if (beat.complete === false) {
    return {
      run_id: run.runId,
      ...(capability_warnings.length > 0 && { capability_warnings }),
      context_plan: contextPlan,
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
      mode,
      stages_ms: {
        gather_ms: gatherMs,
        generate_ms: generateMs,
        save_ms: 0,
        validate_ms: 0,
      },
      ...groupMeta,
    };
  }

  // Guard the save: the beat is an expensive LLM generation, and a
  // transient OC write failure must not discard it. On save error,
  // still return the beat text with a save_error field so the user
  // can retry the persist (e.g., via mnemo_save_entity) without
  // regenerating.
  const saveStart = Date.now();
  const beatName = `Scene ${new Date().toISOString()}`;
  let memoryId: string | undefined;
  let savedTags: string[] | undefined;
  let saveError: string | undefined;
  try {
    const saved = await saveEntity(oc, storyId, {
      type: "scene",
      name: beatName,
      body: beatText,
    });
    memoryId = saved.memory_id;
    savedTags = saved.tags;
  } catch (err) {
    saveError = (err as Error).message;
    log.warn("continueScene", "scene save failed", { msg: saveError });
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

  let validateMs = 0;
  let validation: ValidationReport | undefined;
  let validatorUsage: ModelUsage | undefined;
  let validationError: string | undefined;
  if (opts.validate) {
    const validateStart = Date.now();
    try {
      const outcome = await validateContentWithUsage(
        validator,
        context,
        beatText,
      );
      validation = outcome.report;
      validatorUsage = outcome.usage;
    } catch (err) {
      validationError = (err as Error).message;
      log.warn("continueScene", "validation pass failed", {
        msg: validationError,
      });
    } finally {
      validateMs = Date.now() - validateStart;
    }
  }

  // Tag the saved scene with its validation verdict (v0.1.3
  // validator-gated inclusion — see STATUS.md). Only when both the
  // save succeeded and a verdict was actually produced: no memoryId
  // means nothing to tag, no validation means no verdict to classify
  // (validate=false, or the validator pass itself failed). Best-effort
  // metadata — must never fail the call for an already-saved beat.
  if (
    memoryId !== undefined &&
    savedTags !== undefined &&
    validation !== undefined
  ) {
    try {
      await retagValidation(
        oc,
        memoryId,
        savedTags,
        classifyVerdict(validation),
      );
    } catch (err) {
      log.warn("continueScene", "validation retag failed", {
        msg: (err as Error).message,
      });
    }
  }

  return {
    run_id: run.runId,
    ...(capability_warnings.length > 0 && { capability_warnings }),
    context_plan: contextPlan,
    beat_name: beatName,
    beat_text: beatText,
    ...(memoryId !== undefined && { memory_id: memoryId }),
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
