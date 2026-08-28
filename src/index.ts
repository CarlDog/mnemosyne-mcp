#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mountMcpHttp } from "./shared/http-transport.js";
import { loadHttpConfig, type HttpConfig } from "./http-config.js";
import { apiSecurity } from "./api-security.js";
import { createApiRouter } from "./api/index.js";
import { log } from "./log.js";
import { OcClient } from "./oc-client.js";
import { OllamaProvider, type LlmProvider } from "./llm.js";
import { DEFAULT_TIMEOUT_MS, KindroidClient } from "./kindroid-client.js";
import {
  DEFAULT_GROUP_MAX_TURNS,
  KindroidProvider,
  MAX_GROUP_MAX_TURNS,
  MIN_GROUP_MAX_TURNS,
} from "./kindroid-provider.js";
import { BotifyClient } from "./botify-client.js";
import { BotifyProvider } from "./botify-provider.js";
import { DEFAULT_USER_NAME } from "./companion-message.js";
import { AnthropicProvider } from "./anthropic-provider.js";
import { GeminiProvider } from "./gemini-provider.js";
import { OpenAICompatProvider } from "./openai-compat-provider.js";
import type { KindroidTarget } from "./stories.js";
import { registerTools } from "./tools/index.js";
import {
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  SCENE_CONTEXT_STRATEGIES,
} from "./prompt.js";
import { MNEMOSYNE_VERSION } from "./version.js";

const OC_URL = process.env.OC_URL;
if (!OC_URL) {
  log.error("startup", "OC_URL environment variable is required");
  process.exit(1);
}

// Unset means "ollama" -- the only backend v0 shipped with, so this is a
// zero-behavior-change default for every existing deployment.
const GENERATOR_PROVIDERS = [
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

const GENERATOR_PROVIDER = parseEnvEnum(
  "GENERATOR_PROVIDER",
  process.env.GENERATOR_PROVIDER,
  GENERATOR_PROVIDERS,
  "ollama" as GeneratorProviderName,
);

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "30m";

// Operator display name for the companion-chat providers' outgoing-message
// provenance header (e.g. "[Mnemosyne -- automated scene direction, not
// Carl typing]") -- see companion-message.ts. Read unconditionally (cheap,
// and only the kindroid/botify branches below actually consume it) so
// every generator path shares one source of truth. `||` not `??`: an MCP
// host injects "" for a blank config field, which must read as unset.
const MNEMO_USER_NAME = process.env.MNEMO_USER_NAME || DEFAULT_USER_NAME;

// Cap on the auto-sized per-request context window (see llm.ts's
// computeNumCtx — requests size num_ctx to their actual prompt, bounded
// by this). Optional; empty/unset uses the built-in default.
const OLLAMA_NUM_CTX = process.env.OLLAMA_NUM_CTX;
let ollamaNumCtx: number | undefined;
if (OLLAMA_NUM_CTX) {
  ollamaNumCtx = Number(OLLAMA_NUM_CTX);
  if (!Number.isInteger(ollamaNumCtx) || ollamaNumCtx <= 0) {
    log.error("startup", "OLLAMA_NUM_CTX must be a positive integer", {
      value: OLLAMA_NUM_CTX,
    });
    process.exit(1);
  }
}

const OLLAMA_KEEP_ALIVE_CLEAN = OLLAMA_KEEP_ALIVE.trim();
if (!OLLAMA_KEEP_ALIVE_CLEAN) {
  log.error("startup", "OLLAMA_KEEP_ALIVE is invalid", {
    value: OLLAMA_KEEP_ALIVE,
    hint: "set OLLAMA_KEEP_ALIVE to a non-empty Ollama keep_alive value, or unset to use the default 30m",
  });
  process.exit(1);
}

const SCENE_CONTEXT_STRATEGY = parseEnvEnum(
  "MNEMO_SCENE_CONTEXT_STRATEGY",
  process.env.MNEMO_SCENE_CONTEXT_STRATEGY,
  SCENE_CONTEXT_STRATEGIES,
  DEFAULT_SCENE_CONTEXT_STRATEGY,
);

const SCENE_CONTEXT_FALLBACK_STRATEGY = parseEnvEnum(
  "MNEMO_SCENE_CONTEXT_FALLBACK_STRATEGY",
  process.env.MNEMO_SCENE_CONTEXT_FALLBACK_STRATEGY,
  SCENE_CONTEXT_STRATEGIES,
  SCENE_CONTEXT_STRATEGY,
);

let ocUrl: URL;
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

type GeneratorConfig =
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

let generatorConfig: GeneratorConfig;
let ollamaValidatorModel: string;
let ollamaGeneratorModel: string | undefined;

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

let httpConfig: HttpConfig;
try {
  httpConfig = loadHttpConfig();
} catch (err) {
  log.error("startup", (err as Error).message);
  process.exit(1);
}

const oc = new OcClient(ocUrl);
try {
  await oc.connect();
} catch (err) {
  log.error("startup", "failed to connect to OpenChronicle", {
    url: OC_URL,
    msg: (err as Error).message,
  });
  process.exit(1);
}

// The validator pass always runs on Ollama regardless of GENERATOR_PROVIDER
// -- a companion-chat model is a poor fit for "return JSON matching this
// schema". When the generator is Ollama too, OLLAMA_VALIDATOR_MODEL falls
// back to OLLAMA_GENERATOR_MODEL as before; for any non-Ollama generator
// there is no Ollama generator model to fall back to, so
// OLLAMA_VALIDATOR_MODEL becomes required instead. (All already validated
// above, before the OC connect -- this is object construction only.)
let generator: LlmProvider;

if (generatorConfig.provider === "kindroid") {
  const kindroidClient = new KindroidClient(
    generatorConfig.url,
    process.env.KINDROID_MCP_AUTH_TOKEN,
    generatorConfig.timeoutMs,
  );
  generator = new KindroidProvider(kindroidClient, {
    defaultTarget: generatorConfig.defaultTarget,
    groupMaxTurns: generatorConfig.groupMaxTurns,
    userName: MNEMO_USER_NAME,
  });
  log.info("startup", "kindroid generator configured", {
    url: generatorConfig.rawUrl,
    target_type: generatorConfig.defaultTarget.type,
    target_id: generatorConfig.defaultTarget.id,
    group_max_turns: generatorConfig.groupMaxTurns ?? DEFAULT_GROUP_MAX_TURNS,
    timeout_ms: generatorConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    auth: process.env.KINDROID_MCP_AUTH_TOKEN ? "bearer" : "none",
    user_name: MNEMO_USER_NAME,
  });
} else if (generatorConfig.provider === "botify") {
  const botifyClient = new BotifyClient(
    generatorConfig.url,
    process.env.BOTIFY_MCP_AUTH_TOKEN,
  );
  generator = new BotifyProvider(botifyClient, {
    defaultChatId: generatorConfig.chatId,
    userName: MNEMO_USER_NAME,
  });
  log.info("startup", "botify generator configured", {
    url: generatorConfig.rawUrl,
    chat_id: generatorConfig.chatId,
    auth: process.env.BOTIFY_MCP_AUTH_TOKEN ? "bearer" : "none",
    user_name: MNEMO_USER_NAME,
  });
} else if (generatorConfig.provider === "anthropic") {
  generator = new AnthropicProvider({
    apiKey: generatorConfig.apiKey,
    defaultModel: generatorConfig.model,
  });
  log.info("startup", "anthropic generator configured", {
    generator_model: generatorConfig.model,
  });
} else if (generatorConfig.provider === "gemini") {
  generator = new GeminiProvider({
    apiKey: generatorConfig.apiKey,
    defaultModel: generatorConfig.model,
  });
  log.info("startup", "gemini generator configured", {
    generator_model: generatorConfig.model,
  });
} else if (
  generatorConfig.provider === "openai" ||
  generatorConfig.provider === "atlascloud"
) {
  generator = new OpenAICompatProvider({
    name: generatorConfig.provider,
    baseUrl: generatorConfig.baseUrl,
    apiKey: generatorConfig.apiKey,
    defaultModel: generatorConfig.model,
  });
  log.info("startup", `${generatorConfig.provider} generator configured`, {
    base_url: generatorConfig.baseUrl,
    generator_model: generatorConfig.model,
  });
} else {
  generator = new OllamaProvider({
    url: OLLAMA_URL,
    defaultModel: generatorConfig.model,
    maxContextWindow: ollamaNumCtx,
    keepAlive: OLLAMA_KEEP_ALIVE_CLEAN,
  });
  log.info("startup", "ollama generator configured", {
    url: OLLAMA_URL,
    generator_model: generatorConfig.model,
    keep_alive: OLLAMA_KEEP_ALIVE_CLEAN,
  });
}

const validator = new OllamaProvider({
  url: OLLAMA_URL,
  defaultModel: ollamaValidatorModel,
  maxContextWindow: ollamaNumCtx,
  keepAlive: OLLAMA_KEEP_ALIVE_CLEAN,
});
log.info("startup", "ollama validator configured", {
  url: OLLAMA_URL,
  validator_model: ollamaValidatorModel,
  keep_alive: OLLAMA_KEEP_ALIVE_CLEAN,
});

function warmupProvider(provider: LlmProvider, label: string): void {
  if (!provider.warmup) return;
  provider
    .warmup()
    .then(() => {
      log.info("startup", "provider warmup complete", { provider: label });
    })
    .catch((err) => {
      log.warn("startup", "provider warmup failed", {
        provider: label,
        msg: (err as Error).message,
      });
    });
}

// Warmup is HTTP-mode-only by default: an HTTP deployment is one
// long-lived server where preloading pays off, while stdio servers are
// spawned fresh per host session -- a Claude Desktop session that only
// browses entities would still pin generator+validator models in RAM for
// the whole keep_alive window. MNEMO_WARMUP=true opts a stdio deployment
// in ("" reads as unset, like every other env flag here).
const warmupRequested = (process.env.MNEMO_WARMUP ?? "").trim().toLowerCase();
const warmupEnabled =
  httpConfig.port !== undefined ||
  warmupRequested === "true" ||
  warmupRequested === "1";
if (warmupEnabled) {
  if (generatorConfig.provider === "ollama") {
    warmupProvider(generator, "ollama generator");
    if (
      ollamaGeneratorModel !== undefined &&
      ollamaGeneratorModel !== ollamaValidatorModel
    ) {
      warmupProvider(validator, "ollama validator");
    }
  } else {
    warmupProvider(validator, "ollama validator");
  }
}

const INSTRUCTIONS = `MCP server for long-form storytelling on top of OpenChronicle (OC) memory.
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

/** Builds a NEW McpServer with every tool registered. Must be a factory, not
 * a shared instance -- the HTTP transport needs a fresh server per session;
 * a shared one breaks after the first (works fine under stdio, so light
 * testing never catches it). oc/generator/validator stay startup singletons,
 * shared across every session -- only the McpServer + its tool
 * registrations are per-session. */
function makeServer(): McpServer {
  const server = new McpServer(
    { name: "mnemosyne-mcp", version: MNEMOSYNE_VERSION },
    { instructions: INSTRUCTIONS },
  );
  registerTools(
    server,
    oc,
    generator,
    validator,
    SCENE_CONTEXT_STRATEGY,
    SCENE_CONTEXT_FALLBACK_STRATEGY,
  );
  return server;
}

if (httpConfig.port === undefined) {
  const server = makeServer();
  await server.connect(new StdioServerTransport());
  log.info("server", "mnemosyne-mcp ready", { transport: "stdio" });
} else {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: MNEMOSYNE_VERSION });
  });

  const mcp = mountMcpHttp(app, "/mcp", {
    createServer: makeServer,
    authToken: httpConfig.authToken,
    allowedHosts: httpConfig.allowedHosts,
    sessionIdleMs: httpConfig.sessionIdleMs,
  });

  // Everything below this line is protected by the same Host/Origin
  // allowlist + bearer auth as /mcp -- /health and /mcp above both fully
  // end the request cycle on a match, so this never runs for either.
  app.use(apiSecurity(httpConfig));
  app.use(
    "/api",
    createApiRouter(oc, {
      generator,
      validator,
      sceneContextStrategy: SCENE_CONTEXT_STRATEGY,
      sceneContextFallbackStrategy: SCENE_CONTEXT_FALLBACK_STRATEGY,
    }),
  );

  // Static web UI (webui/, built separately -- see package.json's
  // build:webui script) plus a SPA-fallback route so a deep link survives
  // a hard refresh. import.meta.url is dist/index.js's own URL once
  // compiled, so "./webui" resolves to dist/webui, matching where
  // scripts/copy-webui-dist.mjs copies the built UI to. Under `npm run
  // dev` (tsx running src/index.ts directly) this resolves to a
  // nonexistent src/webui -- expected and harmless: the dev workflow
  // never hits this server for the UI at all, the browser talks to
  // Vite's own dev server, which proxies /api/* back here.
  const webuiDistDir = fileURLToPath(new URL("./webui", import.meta.url));
  const webuiAvailable = existsSync(join(webuiDistDir, "index.html"));
  if (webuiAvailable) {
    app.use(express.static(webuiDistDir));
  } else {
    log.warn("server", "webui build not found -- static UI disabled", {
      path: webuiDistDir,
    });
  }
  app.get(
    /^\/(?!api(?:\/|$)|mcp(?:\/|$)|health(?:\/|$)).*/,
    (_req, res, next) => {
      if (!webuiAvailable) {
        next();
        return;
      }
      res.sendFile(join(webuiDistDir, "index.html"));
    },
  );

  const httpServer = app.listen(httpConfig.port, httpConfig.bindHost, () => {
    log.info("server", "mnemosyne-mcp ready", {
      transport: "http",
      bind: `${httpConfig.bindHost}:${httpConfig.port}`,
      auth: httpConfig.authToken ? "bearer" : "none",
      allowed_hosts: httpConfig.allowedHosts?.join(",") ?? "any",
    });
    if (!httpConfig.authToken) {
      log.warn(
        "server",
        "MCP_AUTH_TOKEN is unset -- the HTTP endpoint accepts unauthenticated requests",
      );
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info("server", "shutting down", { signal });
    await mcp.dispose();
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
