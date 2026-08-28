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
} from "./kindroid-provider.js";
import { BotifyClient } from "./botify-client.js";
import { BotifyProvider } from "./botify-provider.js";
import { AnthropicProvider } from "./anthropic-provider.js";
import { GeminiProvider } from "./gemini-provider.js";
import { OpenAICompatProvider } from "./openai-compat-provider.js";
import { registerTools } from "./tools/index.js";
import {} from "./prompt.js";
import { MNEMOSYNE_VERSION } from "./version.js";
import { INSTRUCTIONS } from "./instructions.js";
// Importing this validates the environment and exits on a bad value; it must
// come before anything that depends on a valid config.
import {
  MNEMO_USER_NAME,
  OC_URL,
  OLLAMA_KEEP_ALIVE_CLEAN,
  OLLAMA_URL,
  SCENE_CONTEXT_FALLBACK_STRATEGY,
  SCENE_CONTEXT_STRATEGY,
  generatorConfig,
  ocUrl,
  ollamaGeneratorModel,
  ollamaNumCtx,
  ollamaValidatorModel,
} from "./generator-config.js";

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

  // Bind failures arrive as an 'error' event, not a throw, and land AFTER every
  // startup check and oc.connect() have already passed. With no listener Node
  // rethrows as an unhandled 'error' event -- a raw EADDRINUSE/EADDRNOTAVAIL
  // stack. Under `restart: unless-stopped` that is a crash-loop whose cause is
  // only visible by reading a stack trace out of container logs.
  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    log.error("server", "failed to bind HTTP listener", {
      bind: `${httpConfig.bindHost}:${httpConfig.port}`,
      code: err.code ?? "unknown",
      error: err.message,
    });
    // Exit non-zero immediately. Two alternatives were tried and rejected:
    // awaiting dispose() before exiting still aborts libuv on Windows
    // ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)") because
    // warmup fires an Ollama fetch at module load whenever MCP_PORT is set;
    // and setting only process.exitCode hangs the process indefinitely (the
    // loop never drains). A prompt non-zero exit after a legible error beats
    // both a hang and a silent stack trace. The libuv assertion may still
    // print AFTER the message above -- noise, not the diagnosis.
    // The real fix is to start warmup only after a successful bind; that
    // means moving a module-level block and is queued separately.
    process.exit(1);
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info("server", "shutting down", { signal });
    await mcp.dispose();
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
