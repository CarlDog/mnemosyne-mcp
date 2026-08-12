#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log } from "./log.js";
import { OcClient } from "./oc-client.js";
import { OllamaProvider, type LlmProvider } from "./llm.js";
import { KindroidClient } from "./kindroid-client.js";
import { KindroidProvider } from "./kindroid-provider.js";
import type { KindroidTarget } from "./stories.js";
import { registerTools } from "./tools/index.js";

const OC_URL = process.env.OC_URL;
if (!OC_URL) {
  log.error("startup", "OC_URL environment variable is required");
  process.exit(1);
}

// Unset means "ollama" -- the only backend v0 shipped with, so this is a
// zero-behavior-change default for every existing deployment.
const GENERATOR_PROVIDER =
  (process.env.GENERATOR_PROVIDER?.trim().toLowerCase() || "ollama") as
    "ollama" | "kindroid";
if (GENERATOR_PROVIDER !== "ollama" && GENERATOR_PROVIDER !== "kindroid") {
  log.error("startup", "GENERATOR_PROVIDER must be 'ollama' or 'kindroid'", {
    value: process.env.GENERATOR_PROVIDER,
  });
  process.exit(1);
}

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

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
// back to OLLAMA_GENERATOR_MODEL as before; when the generator is Kindroid,
// there is no generator model to fall back to, so OLLAMA_VALIDATOR_MODEL
// becomes required instead.
let generator: LlmProvider;
let ollamaValidatorModel: string;

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
  const validatorModel = process.env.OLLAMA_VALIDATOR_MODEL;
  if (!validatorModel) {
    log.error(
      "startup",
      "OLLAMA_VALIDATOR_MODEL environment variable is required when GENERATOR_PROVIDER=kindroid " +
        "(there is no OLLAMA_GENERATOR_MODEL to fall back to -- the validator always runs on Ollama)",
    );
    process.exit(1);
  }
  ollamaValidatorModel = validatorModel;

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

  const kindroidClient = new KindroidClient(
    kindroidUrl,
    process.env.KINDROID_MCP_AUTH_TOKEN,
  );
  generator = new KindroidProvider(kindroidClient, { defaultTarget });
  log.info("startup", "kindroid generator configured", {
    url: KINDROID_MCP_URL,
    target_type: defaultTarget.type,
    target_id: defaultTarget.id,
    auth: process.env.KINDROID_MCP_AUTH_TOKEN ? "bearer" : "none",
  });
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

  generator = new OllamaProvider({
    url: OLLAMA_URL,
    defaultModel: OLLAMA_GENERATOR_MODEL,
  });
  log.info("startup", "ollama generator configured", {
    url: OLLAMA_URL,
    generator_model: OLLAMA_GENERATOR_MODEL,
  });
}

const validator = new OllamaProvider({
  url: OLLAMA_URL,
  defaultModel: ollamaValidatorModel,
});
log.info("startup", "ollama validator configured", {
  url: OLLAMA_URL,
  validator_model: ollamaValidatorModel,
});

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
- mnemo_save_entity(type, name, content, pinned?, extra_tags?) — write a
  character/location/rule/style/scene/lore/worldbuilding entry to the
  active story. Overwrites by (type, name).
- mnemo_recall(query?, type?, limit?) — semantic recall over the active
  story's entities.
- mnemo_continue(direction, mode?, max_tokens?, temperature?, model?,
  kindroid_kin?, kindroid_group_id?, validate?) — pull context from OC,
  generate the next beat via the generator LLM, auto-save the result as a
  scene entity. Mode defaults to 'director'. model overrides the Ollama
  model tag; kindroid_kin/kindroid_group_id override the Kindroid target
  for this call only. With validate=true, runs an LLM second pass and
  attaches a verdict (issues + summary) to the response.
- mnemo_validate(content) — standalone validation pass over arbitrary
  content (hand-written prose, previously-saved beats being re-audited).
  Same ValidationReport shape as mnemo_continue's validate=true mode.`;

const server = new McpServer(
  { name: "mnemosyne-mcp", version: "0.1.2" },
  { instructions: INSTRUCTIONS },
);

registerTools(server, oc, generator, validator);

await server.connect(new StdioServerTransport());
log.info("server", "mnemosyne-mcp ready", { transport: "stdio" });
