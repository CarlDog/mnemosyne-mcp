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
import { createStoryValidationAdapter } from "./adapters/story-validation.js";
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
  ollamaTimeoutMs,
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
    process.env.BOTIFY_MCP_TIMEOUT_MS
      ? Number(process.env.BOTIFY_MCP_TIMEOUT_MS)
      : undefined,
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
    timeoutMs: ollamaTimeoutMs,
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
  timeoutMs: ollamaTimeoutMs,
  // The validator is architecturally local ("local and free"): its requests
  // carry the story's full canon, and Ollama can transparently proxy cloud
  // models through the same localhost API. requireLocal refuses :cloud
  // tags, preflights the exact model via /api/show, and re-checks the
  // final response's route fields (docs/OLLAMA_ADOPTION_ASSESSMENT.md §2).
  requireLocal: true,
});
const validateStory = createStoryValidationAdapter(oc, validator);
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

// Called only once the server is actually serving. Firing at module load
// meant a model preload was in flight while the HTTP listener was still
// trying to bind -- so a bind failure had to exit with that fetch open, and
// forcing the exit aborted libuv on Windows ("Assertion failed:
// !(handle->flags & UV_HANDLE_CLOSING)"). Preloading a model for a server
// that cannot start was wasted work regardless.
function startWarmup(): void {
  if (!warmupEnabled) return;
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
    validateStory,
    SCENE_CONTEXT_STRATEGY,
    SCENE_CONTEXT_FALLBACK_STRATEGY,
    // stdio is a local-operator channel; HTTP is not. Same tool surface, so
    // the path-bearing export/import variants are refused when serving HTTP.
    httpConfig.port === undefined,
  );
  return server;
}

if (httpConfig.port === undefined) {
  const server = makeServer();
  await server.connect(new StdioServerTransport());
  log.info("server", "mnemosyne-mcp ready", { transport: "stdio" });
  startWarmup();
  // Stdio shutdown owner (RUN_OUTCOMES_DESIGN slice 3): close OC's live
  // transport before exiting -- exiting on top of it is the libuv-abort
  // path the bind-failure fix documented.
  let stdioShuttingDown = false;
  const stdioShutdown = (signal: string): void => {
    if (stdioShuttingDown) return;
    stdioShuttingDown = true;
    log.info("server", "shutting down", { signal });
    void oc
      .close()
      .catch(() => {})
      .finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => stdioShutdown("SIGTERM"));
  process.on("SIGINT", () => stdioShutdown("SIGINT"));
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
      validateStory,
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
      allowed_hosts:
        httpConfig.allowedHosts?.join(",") ??
        "localhost,127.0.0.1,[::1],host.docker.internal (default)",
    });
    if (!httpConfig.authToken) {
      log.warn(
        "server",
        "MCP_AUTH_TOKEN is unset -- the HTTP endpoint accepts unauthenticated requests",
      );
    }
    if (!httpConfig.allowedHosts) {
      log.warn(
        "server",
        "MCP_ALLOWED_HOSTS is unset -- falling back to localhost,127.0.0.1,[::1],host.docker.internal, which rejects a real remote client",
      );
    }
    startWarmup();
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
    // Close the OC client before exiting. oc.connect() has already succeeded
    // by this point, so its transport is live; exiting on top of it is what
    // aborts libuv on Windows. (Warmup was the earlier suspect and is not the
    // cause -- deferring it past a successful bind did not change this.)
    void oc
      .close()
      .catch(() => {})
      .finally(() => process.exit(1));
  });

  // Single admission/shutdown owner (RUN_OUTCOMES_DESIGN slice 3, ratified
  // grace 30s / MNEMO_SHUTDOWN_GRACE_MS): gate new admission and start
  // listener close immediately; drain in-flight work for a bounded grace
  // period (httpServer.close() resolves when the last open connection
  // finishes); then close MCP sessions, then OC LAST -- the bind-failure
  // fix already proved exiting on top of a live OC transport aborts libuv.
  const SHUTDOWN_GRACE_MS = process.env.MNEMO_SHUTDOWN_GRACE_MS
    ? Number(process.env.MNEMO_SHUTDOWN_GRACE_MS)
    : 30_000;
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info("server", "shutting down", {
      signal,
      grace_ms: SHUTDOWN_GRACE_MS,
    });
    const listenerClosed = new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    const graceElapsed = new Promise<void>((resolve) => {
      const t = setTimeout(resolve, SHUTDOWN_GRACE_MS);
      t.unref();
    });
    await Promise.race([listenerClosed, graceElapsed]);
    await mcp.dispose().catch(() => {});
    await oc.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
