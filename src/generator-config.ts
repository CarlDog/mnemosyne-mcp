// Startup configuration: every environment variable this server reads, the
// validation that rejects a bad one, and the GeneratorConfig the provider
// construction in index.ts consumes.
//
// Lifted out of index.ts, which had grown to 774 lines by doing env parsing,
// provider construction, warmup, the instructions blob, and transport wiring
// in one file. This module is the first half: it decides WHAT to build.
// index.ts builds it.
//
// Importing this module validates the environment as a side effect and exits
// non-zero on a bad value -- exactly as it did at index.ts's top level, and
// for the same reason: a misconfigured server should fail at startup, not on
// the first tool call. index.ts imports it before anything else.
//
// The exports are individual bindings rather than one config object so that
// no call site in index.ts had to change when this moved.

import { log } from "./log.js";
import { DEFAULT_KEEP_ALIVE } from "./llm.js";
import {
  MAX_GROUP_MAX_TURNS,
  MIN_GROUP_MAX_TURNS,
} from "./kindroid-provider.js";
import { DEFAULT_USER_NAME } from "./companion-message.js";
import type { KindroidTarget } from "./stories.js";
import {
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  SCENE_CONTEXT_STRATEGIES,
} from "./prompt.js";

export const OC_URL = process.env.OC_URL;
if (!OC_URL) {
  log.error("startup", "OC_URL environment variable is required");
  process.exit(1);
}

// Unset means "ollama" -- the only backend v0 shipped with, so this is a
// zero-behavior-change default for every existing deployment.
export const GENERATOR_PROVIDERS = [
  "ollama",
  "kindroid",
  "botify",
  "anthropic",
  "openai",
  "gemini",
  "atlascloud",
] as const;
type GeneratorProviderName = (typeof GENERATOR_PROVIDERS)[number];

// Enum-valued env var parsing, shared by GENERATOR_PROVIDER and the two
// scene-context strategy vars. `|| undefined` (not `??`): an MCP host
// injects "" for a blank config field, which must read as unset rather
// than fail validation and crash-loop the container. Validates against
// the allowed list BEFORE the value is trusted with the enum type. The
// caller passes the raw process.env.<NAME> value so the env-schema drift
// test still sees a literal reference per var.
function parseEnvEnum<T extends string>(
  name: string,
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const cleaned = raw?.trim().toLowerCase() || undefined;
  if (cleaned === undefined) return fallback;
  if (!(allowed as readonly string[]).includes(cleaned)) {
    log.error("startup", `${name} must be one of: ${allowed.join(", ")}`, {
      value: raw,
    });
    process.exit(1);
  }
  return cleaned as T;
}

export const GENERATOR_PROVIDER = parseEnvEnum(
  "GENERATOR_PROVIDER",
  process.env.GENERATOR_PROVIDER,
  GENERATOR_PROVIDERS,
  "ollama" as GeneratorProviderName,
);

export const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
export const OLLAMA_KEEP_ALIVE =
  process.env.OLLAMA_KEEP_ALIVE || DEFAULT_KEEP_ALIVE;

// Operator display name for the companion-chat providers' outgoing-message
// provenance header (e.g. "[Mnemosyne -- automated scene direction, not
// Carl typing]") -- see companion-message.ts. Read unconditionally (cheap,
// and only the kindroid/botify branches below actually consume it) so
// every generator path shares one source of truth. `||` not `??`: an MCP
// host injects "" for a blank config field, which must read as unset.
export const MNEMO_USER_NAME = process.env.MNEMO_USER_NAME || DEFAULT_USER_NAME;

// Cap on the auto-sized per-request context window (see llm.ts's
// computeNumCtx — requests size num_ctx to their actual prompt, bounded
// by this). Optional; empty/unset uses the built-in default.
export const OLLAMA_NUM_CTX = process.env.OLLAMA_NUM_CTX;
export let ollamaNumCtx: number | undefined;
if (OLLAMA_NUM_CTX) {
  ollamaNumCtx = Number(OLLAMA_NUM_CTX);
  if (!Number.isInteger(ollamaNumCtx) || ollamaNumCtx <= 0) {
    log.error("startup", "OLLAMA_NUM_CTX must be a positive integer", {
      value: OLLAMA_NUM_CTX,
    });
    process.exit(1);
  }
}

export const OLLAMA_KEEP_ALIVE_CLEAN = OLLAMA_KEEP_ALIVE.trim();
if (!OLLAMA_KEEP_ALIVE_CLEAN) {
  log.error("startup", "OLLAMA_KEEP_ALIVE is invalid", {
    value: OLLAMA_KEEP_ALIVE,
    hint: "set OLLAMA_KEEP_ALIVE to a non-empty Ollama keep_alive value, or unset to use the default 30m",
  });
  process.exit(1);
}

export const SCENE_CONTEXT_STRATEGY = parseEnvEnum(
  "MNEMO_SCENE_CONTEXT_STRATEGY",
  process.env.MNEMO_SCENE_CONTEXT_STRATEGY,
  SCENE_CONTEXT_STRATEGIES,
  DEFAULT_SCENE_CONTEXT_STRATEGY,
);

export const SCENE_CONTEXT_FALLBACK_STRATEGY = parseEnvEnum(
  "MNEMO_SCENE_CONTEXT_FALLBACK_STRATEGY",
  process.env.MNEMO_SCENE_CONTEXT_FALLBACK_STRATEGY,
  SCENE_CONTEXT_STRATEGIES,
  SCENE_CONTEXT_STRATEGY,
);

export let ocUrl: URL;
try {
  ocUrl = new URL(OC_URL);
} catch (err) {
  log.error("startup", "OC_URL is not a valid URL", {
    value: OC_URL,
    msg: (err as Error).message,
  });
  process.exit(1);
}

// OLLAMA_URL is used unconditionally -- by the Ollama generator path when
// GENERATOR_PROVIDER=ollama, and always by the validator regardless of
// GENERATOR_PROVIDER -- so validate it at startup rather than gating this
// check behind the ollama/kindroid branch below.
try {
  new URL(OLLAMA_URL);
} catch (err) {
  log.error("startup", "OLLAMA_URL is not a valid URL", {
    value: OLLAMA_URL,
    msg: (err as Error).message,
  });
  process.exit(1);
}

// Generator-provider config: every zero-I/O check (env presence, URL format,
// KIN/GROUP mutual exclusivity) runs here, before the oc.connect() network
// call below -- so a deployment misconfigured on both OC and Kindroid learns
// about both problems at once, rather than only the OC one on this run and
// the Kindroid one on the next. The validated values are carried forward in
// this discriminated union (and ollamaValidatorModel below) so the
// object-construction block after oc.connect() -- `new KindroidClient(...)`,
// `new OllamaProvider(...)`, `new KindroidProvider(...)`, none of which have
// any validation purpose of their own -- can use them without re-deriving or
// re-validating anything. oc.connect() itself stays exactly where it was:
// OC connectivity really is required by every provider.
type CloudProviderName = "anthropic" | "openai" | "gemini" | "atlascloud";

export type GeneratorConfig =
  | {
      provider: "kindroid";
      url: URL;
      rawUrl: string;
      defaultTarget: KindroidTarget;
      groupMaxTurns?: number;
      timeoutMs?: number;
    }
  | { provider: "botify"; url: URL; rawUrl: string; chatId: string }
  | {
      provider: CloudProviderName;
      apiKey: string;
      model: string;
      /** Only meaningful for the OpenAI-compatible pair (openai /
       * atlascloud); anthropic and gemini have fixed hosts. */
      baseUrl: string;
    }
  | { provider: "ollama"; model: string };

export let generatorConfig: GeneratorConfig;
export let ollamaValidatorModel: string;
export let ollamaGeneratorModel: string | undefined;

// The validator pass always runs on Ollama regardless of the generator (a
// companion-chat model can't do structured JSON, and keeping the validator
// local means every cloud generator still validates for free) -- so every
// non-ollama generator needs OLLAMA_VALIDATOR_MODEL set explicitly: there
// is no OLLAMA_GENERATOR_MODEL to fall back to.
function requireValidatorModel(provider: string): string {
  const validatorModel = process.env.OLLAMA_VALIDATOR_MODEL;
  if (!validatorModel) {
    log.error(
      "startup",
      `OLLAMA_VALIDATOR_MODEL environment variable is required when GENERATOR_PROVIDER=${provider} ` +
        "(there is no OLLAMA_GENERATOR_MODEL to fall back to -- the validator always runs on Ollama)",
    );
    process.exit(1);
  }
  return validatorModel;
}

if (GENERATOR_PROVIDER === "kindroid") {
  const KINDROID_MCP_URL = process.env.KINDROID_MCP_URL;
  if (!KINDROID_MCP_URL) {
    log.error(
      "startup",
      "KINDROID_MCP_URL environment variable is required when GENERATOR_PROVIDER=kindroid",
    );
    process.exit(1);
  }
  const KINDROID_STORYTELLING_KIN = process.env.KINDROID_STORYTELLING_KIN;
  const KINDROID_STORYTELLING_GROUP = process.env.KINDROID_STORYTELLING_GROUP;
  if (KINDROID_STORYTELLING_KIN && KINDROID_STORYTELLING_GROUP) {
    log.error(
      "startup",
      "set at most one of KINDROID_STORYTELLING_KIN / KINDROID_STORYTELLING_GROUP -- the default target is either a single AI or a group, not both",
    );
    process.exit(1);
  }
  if (!KINDROID_STORYTELLING_KIN && !KINDROID_STORYTELLING_GROUP) {
    log.error(
      "startup",
      "KINDROID_STORYTELLING_KIN or KINDROID_STORYTELLING_GROUP is required when GENERATOR_PROVIDER=kindroid",
    );
    process.exit(1);
  }
  const defaultTarget: KindroidTarget = KINDROID_STORYTELLING_KIN
    ? { type: "ai", id: KINDROID_STORYTELLING_KIN }
    : { type: "group", id: KINDROID_STORYTELLING_GROUP! };

  // Server-wide default AI turns per group beat. `||` not `??`: an MCP host
  // injects "" for a blank config field, which must read as unset.
  const rawGroupMaxTurns = process.env.KINDROID_GROUP_MAX_TURNS || undefined;
  let groupMaxTurns: number | undefined;
  if (rawGroupMaxTurns !== undefined) {
    groupMaxTurns = Number(rawGroupMaxTurns);
    if (
      !Number.isInteger(groupMaxTurns) ||
      groupMaxTurns < MIN_GROUP_MAX_TURNS ||
      groupMaxTurns > MAX_GROUP_MAX_TURNS
    ) {
      log.error(
        "startup",
        `KINDROID_GROUP_MAX_TURNS must be an integer between ${MIN_GROUP_MAX_TURNS} and ${MAX_GROUP_MAX_TURNS}`,
        { value: rawGroupMaxTurns },
      );
      process.exit(1);
    }
  }
  ollamaValidatorModel = requireValidatorModel("kindroid");

  // Per-request timeout for kindroid-mcp calls. `||` not `??`, per the rest
  // of this file: an MCP host injects "" for a blank field, which must read
  // as unset.
  const rawTimeout = process.env.KINDROID_MCP_TIMEOUT_MS || undefined;
  let kindroidTimeoutMs: number | undefined;
  if (rawTimeout !== undefined) {
    kindroidTimeoutMs = Number(rawTimeout);
    if (!Number.isInteger(kindroidTimeoutMs) || kindroidTimeoutMs < 1000) {
      log.error(
        "startup",
        "KINDROID_MCP_TIMEOUT_MS must be an integer >= 1000 (milliseconds)",
        { value: rawTimeout },
      );
      process.exit(1);
    }
  }

  let kindroidUrl: URL;
  try {
    kindroidUrl = new URL(KINDROID_MCP_URL);
  } catch (err) {
    log.error("startup", "KINDROID_MCP_URL is not a valid URL", {
      value: KINDROID_MCP_URL,
      msg: (err as Error).message,
    });
    process.exit(1);
  }

  generatorConfig = {
    provider: "kindroid",
    url: kindroidUrl,
    rawUrl: KINDROID_MCP_URL,
    defaultTarget,
    groupMaxTurns,
    timeoutMs: kindroidTimeoutMs,
  };
} else if (GENERATOR_PROVIDER === "botify") {
  const BOTIFY_MCP_URL = process.env.BOTIFY_MCP_URL;
  if (!BOTIFY_MCP_URL) {
    log.error(
      "startup",
      "BOTIFY_MCP_URL environment variable is required when GENERATOR_PROVIDER=botify",
    );
    process.exit(1);
  }
  const BOTIFY_STORYTELLING_CHAT = process.env.BOTIFY_STORYTELLING_CHAT;
  if (!BOTIFY_STORYTELLING_CHAT) {
    log.error(
      "startup",
      "BOTIFY_STORYTELLING_CHAT environment variable is required when GENERATOR_PROVIDER=botify " +
        "(a Botify chat UUID -- an existing chat thread with the storytelling bot, from botify-mcp's list_chats)",
    );
    process.exit(1);
  }
  ollamaValidatorModel = requireValidatorModel("botify");

  let botifyUrl: URL;
  try {
    botifyUrl = new URL(BOTIFY_MCP_URL);
  } catch (err) {
    log.error("startup", "BOTIFY_MCP_URL is not a valid URL", {
      value: BOTIFY_MCP_URL,
      msg: (err as Error).message,
    });
    process.exit(1);
  }

  generatorConfig = {
    provider: "botify",
    url: botifyUrl,
    rawUrl: BOTIFY_MCP_URL,
    chatId: BOTIFY_STORYTELLING_CHAT,
  };
} else if (GENERATOR_PROVIDER !== "ollama") {
  // The four direct-API cloud providers share one validation shape: an
  // API key + an explicit model (no baked-in model default -- model names
  // age fast, and requiring the choice matches OLLAMA_GENERATOR_MODEL's
  // posture), plus a base URL for the OpenAI-compatible pair. Each env
  // var is read literally (not via a lookup table) so the .env.example
  // schema-drift test can see every reference.
  ollamaValidatorModel = requireValidatorModel(GENERATOR_PROVIDER);

  let apiKey: string | undefined;
  let model: string | undefined;
  let baseUrl = "";
  let keyVar = "";
  let modelVar = "";
  switch (GENERATOR_PROVIDER) {
    case "anthropic":
      apiKey = process.env.ANTHROPIC_API_KEY;
      model = process.env.ANTHROPIC_MODEL;
      keyVar = "ANTHROPIC_API_KEY";
      modelVar = "ANTHROPIC_MODEL";
      break;
    case "openai":
      apiKey = process.env.OPENAI_API_KEY;
      model = process.env.OPENAI_MODEL;
      baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
      keyVar = "OPENAI_API_KEY";
      modelVar = "OPENAI_MODEL";
      break;
    case "gemini":
      apiKey = process.env.GEMINI_API_KEY;
      model = process.env.GEMINI_MODEL;
      keyVar = "GEMINI_API_KEY";
      modelVar = "GEMINI_MODEL";
      break;
    case "atlascloud":
      apiKey = process.env.ATLASCLOUD_API_KEY;
      model = process.env.ATLASCLOUD_MODEL;
      baseUrl =
        process.env.ATLASCLOUD_BASE_URL || "https://api.atlascloud.ai/v1";
      keyVar = "ATLASCLOUD_API_KEY";
      modelVar = "ATLASCLOUD_MODEL";
      break;
  }
  if (!apiKey) {
    log.error(
      "startup",
      `${keyVar} environment variable is required when GENERATOR_PROVIDER=${GENERATOR_PROVIDER}`,
    );
    process.exit(1);
  }
  if (!model) {
    log.error(
      "startup",
      `${modelVar} environment variable is required when GENERATOR_PROVIDER=${GENERATOR_PROVIDER} ` +
        "(no baked-in default -- model names age fast; pick one explicitly)",
    );
    process.exit(1);
  }
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch (err) {
      log.error("startup", "provider base URL is not a valid URL", {
        provider: GENERATOR_PROVIDER,
        value: baseUrl,
        msg: (err as Error).message,
      });
      process.exit(1);
    }
  }

  generatorConfig = {
    provider: GENERATOR_PROVIDER,
    apiKey,
    model,
    baseUrl,
  };
} else {
  const OLLAMA_GENERATOR_MODEL = process.env.OLLAMA_GENERATOR_MODEL;
  if (!OLLAMA_GENERATOR_MODEL) {
    log.error(
      "startup",
      "OLLAMA_GENERATOR_MODEL environment variable is required",
    );
    process.exit(1);
  }
  ollamaValidatorModel =
    process.env.OLLAMA_VALIDATOR_MODEL || OLLAMA_GENERATOR_MODEL;

  ollamaGeneratorModel = OLLAMA_GENERATOR_MODEL;
  generatorConfig = { provider: "ollama", model: OLLAMA_GENERATOR_MODEL };
}

// The validator is architecturally local ("local and free" -- ARCHITECTURE
// §3). Current Ollama transparently executes a `:cloud` model through the
// same localhost API, which would silently ship retrieved canon (including
// mature/private material) to Ollama's cloud and make the "free" validation
// pass billable (docs/OLLAMA_ADOPTION_ASSESSMENT.md §2). The cheap tag check
// runs here at startup; the authoritative /api/show remote_model/remote_host
// preflight and final-response route check live in OllamaProvider
// (requireLocal), because a local-looking alias can still point at a remote
// host.
if (/:cloud$/i.test(ollamaValidatorModel)) {
  log.error(
    "startup",
    `OLLAMA_VALIDATOR_MODEL "${ollamaValidatorModel}" is an Ollama Cloud tag -- ` +
      "the validator must stay local (it receives the story's full canon and " +
      "is documented as free). Use a locally installed model tag.",
  );
  process.exit(1);
}
