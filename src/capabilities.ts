// Generator capability descriptors
// (docs/GENERATOR_CAPABILITIES_DESIGN.md, ratified 2026-08-28).
// Invariants live in a static per-provider table; the resolver is keyed
// off the provider INSTANCE (two Ollama instances -- generator and
// validator -- differ in model and window cap) and is ASYNC because
// Ollama's context window comes from the daemon's /api/show. Values come
// from the code as it exists, not aspiration: model-dependent fields are
// "unknown", and every consumer must treat unknown as neither supported
// nor unsupported. Deliberately NOT a plugin surface -- seven built-in
// providers, one file. There is no `cancellation` field (no provider
// accepts caller cancellation of a dispatched request; RUN_OUTCOMES_DESIGN
// owns that vocabulary) and no lifecycle fields (warmup/checkReady are
// already optional LlmProvider hooks -- a table copy would be a second
// source of truth).

import {
  OllamaProvider,
  supportsStructuredOutput,
  MIN_TEMPERATURE,
  MAX_TEMPERATURE,
  MIN_GENERATION_TOKENS,
  MAX_GENERATION_TOKENS,
  type LlmProvider,
} from "./llm.js";

export type RangeCapability =
  | { supported: true; min: number; max: number; passthrough_only: boolean }
  | { supported: false }
  | "unknown";

export interface GeneratorCapabilities {
  provider: string;
  per_call_model_override: boolean;
  temperature: RangeCapability;
  max_tokens: RangeCapability;
  /** The EFFECTIVE enforceable input window (for Ollama:
   * min(trained context, operator cap) from the live daemon). Cloud
   * providers are all-"unknown" by ratified decision -- a local
   * per-model table drifts. */
  context_window: number | "unknown";
  system_prompt_channel: "native" | "none";
  usage_reporting: "reported" | "none";
  /** Derived from supportsStructuredOutput(provider) -- never tabled. */
  structured_output: boolean;
  external_generation_side_effect: "none" | "conversation_mutation";
  supports_noncommitting_variants: boolean;
  kindroid_targeting?: { targets: ["ai", "group"]; group_turns: boolean };
}

// Static invariants per provider name. Instance-dependent fields
// (context_window, structured_output) are filled by the resolver.
type StaticCapabilities = Omit<
  GeneratorCapabilities,
  "context_window" | "structured_output"
>;

const DIRECT_CLOUD_UNKNOWN_SAMPLING: Pick<
  StaticCapabilities,
  "temperature" | "max_tokens"
> = {
  // Model-dependent: current-gen Anthropic/OpenAI models 400 on the
  // fields' mere presence, older ones accept them -- and the code
  // deliberately keeps no model list (the pass-through posture).
  temperature: "unknown",
  max_tokens: "unknown",
};

const COMPANION_BASE: Omit<StaticCapabilities, "provider"> = {
  per_call_model_override: false,
  temperature: { supported: false },
  max_tokens: { supported: false },
  system_prompt_channel: "none", // keyphrase-gated companion message
  usage_reporting: "none",
  external_generation_side_effect: "conversation_mutation",
  supports_noncommitting_variants: false,
};

const STATIC_TABLE: Record<string, StaticCapabilities> = {
  ollama: {
    provider: "ollama",
    per_call_model_override: true,
    temperature: {
      supported: true,
      min: MIN_TEMPERATURE,
      max: MAX_TEMPERATURE,
      passthrough_only: false, // a default (0.8) applies when unset
    },
    max_tokens: {
      supported: true,
      min: MIN_GENERATION_TOKENS,
      max: MAX_GENERATION_TOKENS,
      passthrough_only: false, // default 2048 applies when unset
    },
    system_prompt_channel: "native",
    usage_reporting: "reported",
    external_generation_side_effect: "none",
    supports_noncommitting_variants: true,
  },
  anthropic: {
    provider: "anthropic",
    per_call_model_override: true,
    ...DIRECT_CLOUD_UNKNOWN_SAMPLING,
    system_prompt_channel: "native",
    usage_reporting: "reported",
    external_generation_side_effect: "none",
    supports_noncommitting_variants: true,
  },
  openai: {
    provider: "openai",
    per_call_model_override: true,
    ...DIRECT_CLOUD_UNKNOWN_SAMPLING,
    system_prompt_channel: "native",
    usage_reporting: "reported",
    external_generation_side_effect: "none",
    supports_noncommitting_variants: true,
  },
  atlascloud: {
    provider: "atlascloud",
    per_call_model_override: true,
    ...DIRECT_CLOUD_UNKNOWN_SAMPLING,
    system_prompt_channel: "native",
    usage_reporting: "reported",
    external_generation_side_effect: "none",
    supports_noncommitting_variants: true,
  },
  gemini: {
    provider: "gemini",
    per_call_model_override: true,
    // Pass-through only: sent only when the caller set them (2.5 thinking
    // tokens eat a hard default cap), within the shared surface bounds.
    temperature: {
      supported: true,
      min: MIN_TEMPERATURE,
      max: MAX_TEMPERATURE,
      passthrough_only: true,
    },
    max_tokens: {
      supported: true,
      min: MIN_GENERATION_TOKENS,
      max: MAX_GENERATION_TOKENS,
      passthrough_only: true,
    },
    system_prompt_channel: "native",
    usage_reporting: "reported",
    external_generation_side_effect: "none",
    supports_noncommitting_variants: true,
  },
  kindroid: {
    provider: "kindroid",
    ...COMPANION_BASE,
    kindroid_targeting: { targets: ["ai", "group"], group_turns: true },
  },
  botify: {
    provider: "botify",
    ...COMPANION_BASE,
  },
};

/**
 * Warn-don't-break (ratified decision #1): warnings for options the
 * static table marks unsupported for this provider, or outside a KNOWN
 * range. `unknown` capabilities produce NO warning -- unknown is not
 * unsupported; an unsupported model rejects the field with the
 * provider's own message, which is the designed outcome. Pure over the
 * static table, so surfaces can call it per-request without a daemon
 * round trip.
 */
export function capabilityWarnings(
  providerName: string,
  opts: { temperature?: number; maxTokens?: number; model?: string },
): string[] {
  const caps = STATIC_TABLE[providerName];
  if (!caps) return [];
  const warnings: string[] = [];
  const check = (
    label: "temperature" | "max_tokens",
    value: number | undefined,
    cap: RangeCapability,
  ) => {
    if (value === undefined || cap === "unknown") return;
    if (!cap.supported) {
      warnings.push(
        `${label} is ignored by the ${providerName} provider (no equivalent concept); the value was not applied`,
      );
    } else if (value < cap.min || value > cap.max) {
      warnings.push(
        `${label} ${value} is outside ${providerName}'s known range ${cap.min}-${cap.max}; the provider may reject or clamp it`,
      );
    }
  };
  check("temperature", opts.temperature, caps.temperature);
  check("max_tokens", opts.maxTokens, caps.max_tokens);
  if (opts.model !== undefined && !caps.per_call_model_override) {
    warnings.push(
      `model is ignored by the ${providerName} provider -- use kindroid_kin/kindroid_group_id for a Kindroid target override`,
    );
  }
  return warnings;
}

/**
 * Resolve the capabilities of a provider INSTANCE (async: Ollama's
 * effective window needs the daemon). Unknown provider names -- which
 * cannot occur with the seven built-ins -- resolve conservatively to a
 * companion-shaped descriptor rather than throwing, so a future provider
 * added without a table row degrades safely instead of crashing the
 * projection route.
 */
export async function resolveCapabilities(
  provider: LlmProvider,
  model?: string,
): Promise<GeneratorCapabilities> {
  const staticPart = STATIC_TABLE[provider.name] ?? {
    ...COMPANION_BASE,
    provider: provider.name,
  };
  const context_window =
    provider instanceof OllamaProvider
      ? await provider.getEffectiveContextWindow(model)
      : "unknown";
  return {
    ...staticPart,
    context_window,
    structured_output: supportsStructuredOutput(provider),
  };
}
