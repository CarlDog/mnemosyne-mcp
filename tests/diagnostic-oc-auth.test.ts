// Run the actual diagnostic entrypoints against the real OC client/transport
// and a fake fetch. Context/provider modules are synthetic: even the group
// diagnostic's binding step cannot reach private data or mutate a live story.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TOKEN = "synthetic-diagnostic.oc+/token==";
const REMOTE_PROSE = "untrusted-diagnostic-upstream-prose";
const SCRIPTS = [
  "dump-prompt",
  "dump-validation",
  "dump-kindroid-group-message",
] as const;
let fixture: string;

beforeAll(async () => {
  // Kept under the repository so its installed dependencies resolve normally.
  // Only public source files and synthetic values enter this isolated tree.
  await mkdir(join(ROOT, "tmp"), { recursive: true });
  fixture = await mkdtemp(join(ROOT, "tmp", "diagnostic-auth-"));
  await mkdir(join(fixture, "scripts"));
  await mkdir(join(fixture, "dist"));
  await writeFile(
    join(fixture, "package.json"),
    JSON.stringify({ type: "module", version: "0.0.0-test" }),
  );
  await writeFile(join(fixture, "content.txt"), "Synthetic diagnostic content");
  for (const name of [...SCRIPTS, "dist-preflight"]) {
    await writeFile(
      join(fixture, "scripts", `${name}.mjs`),
      await readFile(join(ROOT, "scripts", `${name}.mjs`)),
    );
  }
  // Compile the real client dependency graph without relying on a stale dist/
  // or on a prior build. Test doubles replace only unrelated diagnostic work.
  for (const name of [
    "oc-client",
    "oc-transport",
    "log",
    "service-url",
    "version",
    "mcp-result",
    "mcp-discovery",
    "run-outcome",
    "story-scope",
  ]) {
    const source = await readFile(join(ROOT, "src", `${name}.ts`), "utf8");
    await writeFile(
      join(fixture, "dist", `${name}.js`),
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
        },
      }).outputText,
    );
  }
  const modules: Record<string, string> = {
    prompt: `
      export const DEFAULT_SCENE_CONTEXT_STRATEGY = "recency-first";
      export const SCENE_CONTEXT_STRATEGIES = ["recency-first", "query-ranked"];
      export async function gatherContext() {
        return {rules:[],style:[],characters:[],locations:[],scenes:[],lore:[],worldbuilding:[]};
      }
      export function buildSystemPrompt() { return "Synthetic system prompt"; }
    `,
    stories: `
      export async function findStory() { return {name:"Synthetic story"}; }
      export async function setKindroidTarget(oc, story, target) {
        return {...story,kindroid_target:target};
      }
    `,
    "kindroid-provider": `export function buildKindroidMessage() { return "Synthetic group message"; }`,
    llm: `export class OllamaProvider {}`,
    validator: `export async function validateContent() { return {valid:true}; }`,
  };
  for (const [name, source] of Object.entries(modules)) {
    await writeFile(join(fixture, "dist", `${name}.js`), source);
  }
  await writeFile(
    join(fixture, "fake-fetch.mjs"),
    `
    import assert from "node:assert/strict";
    const requiredTools = ["project_create","project_delete","memory_save","memory_search",
      "memory_list","memory_get","memory_update","memory_pin","memory_delete"];
    let initialized = false;
    let listed = false;
    globalThis.fetch = async (input, init) => {
      // Never delegate to real fetch, including for unexpected endpoints.
      assert.equal(new URL(input).hostname, "oc.example.invalid");
      const expected = process.env.OC_MCP_AUTH_TOKEN?.trim();
      assert.equal(new Headers(init?.headers).get("Authorization"), expected ? "Bearer " + expected : null);
      assert.equal(init?.redirect, expected ? "error" : undefined);
      if (process.env.TEST_OC_FAILURE === "true") {
        return new Response(${JSON.stringify(REMOTE_PROSE)} + " " + expected + " " + encodeURIComponent(expected), {status:401});
      }
      if (init?.method === "GET" || init?.method === "DELETE") return new Response(null,{status:405});
      const rpc = JSON.parse(init.body);
      if (rpc.method === "notifications/initialized") return new Response(null,{status:202});
      let result;
      if (rpc.method === "initialize") {
        initialized = true;
        result = {protocolVersion:rpc.params.protocolVersion,capabilities:{tools:{}},
          serverInfo:{name:"synthetic-openchronicle",version:"0.0.0"}};
      } else {
        assert.equal(rpc.method, "tools/list");
        listed = true;
        result = {tools:requiredTools.map(name => ({name,inputSchema:{type:"object"}}))};
      }
      return Response.json({jsonrpc:"2.0",id:rpc.id,result});
    };
    process.on("exit", code => {
      if (code === 0) {
        assert.ok(initialized && listed, "real client must initialize and discover over fake fetch");
        console.error("synthetic OC handshake verified");
      }
    });
    `,
  );
});

afterAll(async () => {
  if (fixture) await rm(fixture, { recursive: true, force: true });
});

function runDiagnostic(
  script: (typeof SCRIPTS)[number],
  token?: string,
  opts: { url?: string; failure?: boolean } = {},
) {
  // Explicit OS allowlist: no inherited OC/provider secrets or runtime config.
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  env.OC_URL = opts.url ?? "https://oc.example.invalid/mcp";
  env.OLLAMA_VALIDATOR_MODEL = "synthetic-validator";
  if (token !== undefined) env.OC_MCP_AUTH_TOKEN = token;
  if (opts.failure) env.TEST_OC_FAILURE = "true";
  const args =
    script === "dump-validation"
      ? ["synthetic-project", join(fixture, "content.txt")]
      : script === "dump-kindroid-group-message"
        ? ["synthetic-project", "synthetic-group", "Synthetic direction"]
        : ["synthetic-project", "Synthetic direction"];
  return spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(join(fixture, "fake-fetch.mjs")).href,
      join(fixture, "scripts", `${script}.mjs`),
      ...args,
    ],
    { cwd: fixture, env, encoding: "utf8", timeout: 15_000 },
  );
}

function expectNoCredential(output: string): void {
  expect(output).not.toContain(TOKEN);
  expect(output).not.toContain(encodeURIComponent(TOKEN));
  expect(output).not.toContain(REMOTE_PROSE);
}

describe.each(SCRIPTS)("%s optional OC bearer", (script) => {
  it("forwards the configured token through the real transport without printing it", () => {
    const result = runDiagnostic(script, `  ${TOKEN}  `);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("synthetic OC handshake verified");
    expectNoCredential(result.stdout + result.stderr);
  });

  it.each([undefined, "", " \t "])(
    "preserves unauthenticated diagnostics for absent or blank token (%j)",
    (token) => {
      const result = runDiagnostic(script, token);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("synthetic OC handshake verified");
      expectNoCredential(result.stdout + result.stderr);
    },
  );

  it("does not leak a malformed token from constructor failure", () => {
    const result = runDiagnostic(script, `Bearer ${TOKEN}`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "OC_MCP_AUTH_TOKEN must be a valid bearer token",
    );
    expectNoCredential(result.stdout + result.stderr);
  });

  it("does not echo a token-bearing malformed URL", () => {
    const result = runDiagnostic(script, TOKEN, { url: `invalid ${TOKEN}` });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("OC_URL is not a valid URL");
    expectNoCredential(result.stdout + result.stderr);
  });

  it("does not echo a token-bearing endpoint or reflected auth failure", () => {
    const result = runDiagnostic(script, TOKEN, {
      url: `https://oc.example.invalid/${encodeURIComponent(TOKEN)}/mcp`,
      failure: true,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("OpenChronicle request failed (HTTP 401)");
    expectNoCredential(result.stdout + result.stderr);
  });

  it("retains endpoint context for unauthenticated connection failures", () => {
    const result = runDiagnostic(script, undefined, { failure: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "could not reach OpenChronicle at https://oc.example.invalid/mcp",
    );
  });

  it("retains the unauthenticated malformed-URL diagnostic", () => {
    const result = runDiagnostic(script, undefined, {
      url: "invalid synthetic endpoint",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "OC_URL is not a valid URL: invalid synthetic endpoint",
    );
  });
});
