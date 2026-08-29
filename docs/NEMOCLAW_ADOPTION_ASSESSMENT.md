# NemoClaw Adoption Assessment

**Status:** Completed comparative research, recorded 2026-08-28;
recommendations are unratified. This document does not schedule work, change
locked architecture, or reopen deferred scope. [STATUS.md](../STATUS.md)
remains the source of current priority. A proposal that changes a locked
decision in [ARCHITECTURE.md](ARCHITECTURE.md) still requires its own design
review.

**Upstream snapshot:**
[`NVIDIA/NemoClaw@b7261ff`](https://github.com/NVIDIA/NemoClaw/tree/b7261ff7cc73c76a15deb3e95291c24b1624534e),
package version `0.1.0`, Apache-2.0 license. The clean local audit copy is at
`D:\GitHub\NemoClaw` and contains 6,008 tracked files at this snapshot. Links
to NemoClaw source below are pinned to that commit so the assessment remains
reproducible as upstream changes.

**Mnemosyne snapshot:** `cfd9d7f4597d862314c78466f344f8118040016e`.
The Mnemosyne worktree already contained unrelated documentation and research
changes when this review began; they were preserved. No NemoClaw code has been
copied into Mnemosyne. Relative Mnemosyne source links below refer to that
snapshot, not HEAD — later refactors (notably the 2026-08-28 `src/index.ts`
split) have moved some cited code.

**Method:** Static source, documentation, test, dependency, license, security,
inference, lifecycle, and integration review. NemoClaw was not installed or
run, so this document makes no live compatibility claim. Inspected upstream
tests are evidence of intended behavior, not tests run by Mnemosyne.

## Decision summary

Treat NemoClaw as a **pattern library** and, conditionally, as a separately
deployed MCP host. Do not make it a Mnemosyne dependency, fork base, or runtime
substrate.

NemoClaw protects an agent that can execute tools and code. Its host CLI,
OpenShell gateway, sandbox, inference routing, network policies, credentials,
snapshots, and lifecycle machinery form one control plane
([upstream overview](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/README.md#nvidia-nemoclaw-reference-stack-for-sandboxed-ai-agents-in-openshell)).
Mnemosyne is a focused, trusted Node service: it gathers story context from
OpenChronicle, calls one configured generator, optionally validates, and saves
story data. It does not execute model-generated code. That mismatch rules out
most of NemoClaw while leaving a few service-boundary contracts worth adopting.

| Track | Recommendation | Rank if ratified | Novelty in Mnemosyne |
|---|---|---:|---|
| HTTP filesystem authority | Restrict path-bearing import/export capabilities by transport | P0 before non-loopback or agent-host use | New concrete gap |
| External MCP contracts | Runtime-validate sibling-service results and discover required tool names with strict bounds | P1 | New concrete gap |
| Dependency readiness | Keep process liveness cheap; add protected, semantic, timestamped readiness | P1 | New concrete gap |
| Endpoint and telemetry safety | Centralize service-URL validation, redirect policy, bounded error handling, and final-sink redaction | P2 | URL/redirect refinement is new; prose-log privacy corroborates existing work |
| Optional host | Run a bounded NemoClaw compatibility spike after the HTTP authority boundary is closed | Conditional | New integration option; no core architecture change |
| Provider capabilities and content routing | Use a small immutable capability descriptor at the generation chokepoint | Existing initiative | NemoClaw corroborates static provider metadata generally; Mnemosyne's content and side-effect fields come from its existing designs |

In this document, **adopt** means independently implementing the smallest
useful contract in Mnemosyne's vocabulary. **Integrate** means running an
independently versioned NemoClaw/OpenShell deployment outside Mnemosyne.
Neither means copying an upstream subsystem.

## Assessment filters

Every recommendation had to pass these tests:

1. **A current consumer or demonstrated boundary exists.** A feature must
   answer a current code path, recorded incident, explicit design, or credible
   near-term integration.
2. **Ownership remains intact.** OpenChronicle remains canonical memory;
   Mnemosyne remains the story-operation layer; companion services continue to
   own their external conversations.
3. **Canon and authority safety beat convenience.** A generic agent feature
   cannot silently widen filesystem, credential, or story-writing authority.
4. **The first slice is bounded and testable.** A schema, policy object, or
   status projection is preferable to a new platform.
5. **Prior findings are named as corroboration.** The review does not inflate
   its value by presenting existing recommendations as discoveries.

## Architectural fit

NemoClaw's central trust boundary is an intentionally constrained execution
environment. The sandboxed agent is not trusted with raw managed provider or
MCP credentials or unrestricted egress; OpenShell retains those credentials
and applies policy when traffic leaves the sandbox. NemoClaw therefore needs
durable onboarding, repair, route verification, process ownership, and
snapshot semantics.

Mnemosyne's trust boundary is different:

- its own process is trusted application code;
- model output is treated as prose and data, never executed as shell or code;
- OpenChronicle owns live story memory;
- Kindroid and Botify own their external conversations;
- provider credentials are supplied to the trusted process through the
  environment;
- the HTTP and Web UI surfaces are alternate adapters over the same story
  operations, not an untrusted execution plane.

The useful transfer is therefore concentrated at existing boundaries:
filesystem path authority, external MCP response validation, dependency
capability discovery, readiness, endpoint handling, and safe diagnostics.
OpenShell, the sandbox orchestrator, and the general inference control plane do
not belong inside Mnemosyne.

## 1. Constrain filesystem authority by transport

### Why this is a real gap

Mnemosyne registers the same tool set in stdio mode and for every HTTP MCP
session through one `makeServer()` factory
([registration](../src/index.ts#L645-L683),
[tool inventory](../src/tools/index.ts#L18-L43)). Two tools expose paths:

- `mnemo_export_story(out_path)` resolves the caller's path, creates its parent
  directories, and overwrites the destination with story JSON
  ([export path](../src/export.ts#L187-L218));
- `mnemo_import_story(file_path)` resolves and reads the caller's path before
  parsing it as a Mnemosyne export
  ([import path](../src/import.ts#L415-L423)).

Those capabilities are appropriate for a trusted local stdio operator. In
HTTP mode, however, a client authorized to manipulate stories also receives
host-filesystem authority outside Mnemosyne's data directory. Export is an
arbitrary-location story-data overwrite primitive within the process account's
permissions. Import is not arbitrary-file-content exfiltration—the file must
parse as a valid export—but it can consume and import any valid export readable
by the service; combined with ordinary entity reads, that can expose the
imported story content. The default loopback bind limits exposure, so this is a
deployment gate rather than evidence of an active internet incident.

### Useful NemoClaw pattern

NemoClaw validates filesystem targets against trusted roots and treats lexical
containment and resolved filesystem identity as separate checks. Its reviewed
read-only repository tools reject absolute escapes and sibling-prefix paths
([root confinement](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/tools/advisors/repo-read-only-tools.mts#L141-L177)),
while its security documentation treats no-follow and trusted-root behavior as
part of the filesystem boundary
([filesystem controls](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/security/filesystem-controls.mdx)).

### Recommended Mnemosyne adaptation

Prefer the smallest policy:

1. In HTTP mode, reject explicit `out_path` and `file_path` before any
   filesystem operation.
2. Keep server-managed default exports under the story's data directory.
3. Keep inline `entities` import available over HTTP.
4. Preserve explicit paths for trusted stdio mode.
5. If browser file restore becomes a real need, accept a bounded upload/body
   and parse it directly rather than accepting a server-side path.

Build an allowed-root facility only if a demonstrated remote workflow needs
one. That facility would need canonical parent resolution, Windows
case-insensitive handling, UNC awareness, and symlink/junction/reparse-point
escape protection; transport-specific rejection is both smaller and safer.

### Acceptance proof

- HTTP `out_path` and `file_path` fail before `readFile`, `mkdir`, or
  `writeFile`.
- HTTP managed export and inline import continue to work.
- Stdio explicit temp-file import/export continue to work.
- An HTTP MCP integration test proves the policy is wired through the actual
  per-session server factory.
- If allowed roots are ever added, test `..`, absolute outside paths,
  sibling-prefix paths such as `root-evil`, drive-letter case, UNC paths,
  symlinked parents, junctions/reparse points, and nonexistent write targets.

## 2. Validate external MCP contracts and discover required tools

### Why this is a real gap

Mnemosyne's shared MCP result helper trusts compile-time generics at a runtime
network boundary:

```ts
return result.structuredContent as T;
return JSON.parse(extractText(result, toolName)) as T;
```

See [`extractStructuredOrParsed`](../src/mcp-result.ts#L56-L69). OpenChronicle,
Kindroid, and Botify then consume those values as typed results
([OC](../src/oc-client.ts#L131-L169),
[Kindroid](../src/kindroid-client.ts#L167-L179),
[Botify](../src/botify-client.ts#L98-L110)). Their connection methods perform
the MCP initialization handshake but do not verify that the required tool set
is advertised.

An upstream schema or tool-name change can therefore enter story logic before
failing, producing a misleading downstream error or, for sufficiently
plausible malformed data, affecting a canon write. This is a concrete external
trust-boundary gap, not a generic request for more abstractions.

### Useful NemoClaw pattern

NemoClaw performs a non-mutating, name-only MCP discovery lifecycle:
`initialize`, `notifications/initialized`, and paginated `tools/list`. It never
calls a discovered tool. It bounds total time, per-request time, cumulative
response bytes, page count, tool count, cursor length, and tool-name length
([operational contract](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/manage-sandboxes/manage-mcp-servers.mdx#L37-L83),
[limits and validation](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/tools/mcp-tool-discovery-runtime/tool-discovery-core.ts#L6-L13)).
Duplicate names, repeated cursors, oversized responses, and unbounded
pagination fail closed.

### Recommended Mnemosyne adaptation

- Define Zod schemas for every OC, Kindroid, and Botify result crossing into
  domain logic.
- Parse both `structuredContent` and text-fallback JSON through the same schema.
- Maintain a small explicit set of required tool names for each sibling
  service.
- Run bounded name discovery during startup or explicit diagnostics.
- Fail startup when mandatory OpenChronicle lacks its required contract.
- Surface the configured companion provider as unavailable when its contract
  is missing, while leaving unrelated story browsing usable where possible.
- Never send a companion message merely to probe readiness.

Do not fingerprint complete MCP input/output schemas initially. Minimum tool
names plus runtime result schemas close the demonstrated boundary without
inventing a compatibility registry.

### Acceptance proof

- Reject malformed `structuredContent`, malformed text JSON, incorrect wrapper
  shapes, missing fields, invalid enum values, and wrong field types.
- Reject missing required tools, duplicate tool names, repeated cursors,
  excessive pages/tools/bytes, and timeouts.
- Prove discovery performs zero `tools/call` mutations.
- Errors name the service and tool but contain no credential, narrative body,
  or raw upstream response body.

## 3. Separate liveness from semantic readiness

### Why this is a real gap

The current public health endpoint always returns
`{ "status": "ok", "version": ... }`
([health route](../src/index.ts#L672-L676)). It can report success after an OC
connection fails, when the configured generator is unavailable, or when the
validator model does not exist. Startup verifies the initial OC handshake, but
that does not prove continued availability or required-tool compatibility.

### Useful NemoClaw pattern

NemoClaw records timestamped observations, capabilities, findings, and bounded
evidence. Probe failures can remain unknown rather than becoming false success,
and readiness diagnostics use credential-free read-only environments
([readiness snapshot](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/src/lib/readiness/gateway.ts),
[production probe boundary](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/src/lib/readiness/gateway-production.ts),
[probe environment](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/src/lib/readiness/probe-env.ts)).
Its inference health checks also require semantically valid provider responses,
not merely an HTTP success status
([inference health](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/src/lib/inference/health.ts)).

### Recommended Mnemosyne adaptation

- Preserve `/health` as cheap process liveness.
- Add a protected `/api/status` and/or `mnemo_status` operation.
- Optionally expose a detail-free aggregate `/ready` for deployment probes.
- Report `openchronicle`, `generator`, and `validator` as `ready`,
  `unavailable`, `degraded`, or `not_probed`, with observation time and a safe
  reason.
- Use MCP required-tool discovery for OC and companion providers.
- Reuse the exact local-model preflight proposed in
  [OLLAMA_ADOPTION_ASSESSMENT.md](OLLAMA_ADOPTION_ASSESSMENT.md) rather than
  creating another Ollama design.
- Make paid cloud semantic probes explicit or short-TTL cached. A load balancer
  must never cause billable generation.
- Never mutate a companion chat to check status.

Detailed status stays behind the existing bearer and Host/Origin boundary.
Public readiness, if added, should expose only aggregate state.

### Acceptance proof

- A live process with disconnected OC remains live but is not ready.
- Timeout or intentionally skipped probe produces `not_probed`, never `ready`.
- Stale observations are labeled stale.
- Missing required tools or model tags produce actionable safe reasons.
- Repeated liveness/readiness polls perform no paid or mutating request.
- Responses and logs contain no tokens, story prose, URL userinfo/query,
  credential names paired with values, or raw upstream bodies.

## 4. Endpoint, redirect, error-body, and logging hygiene

### Current boundary

Mnemosyne validates configured service endpoints primarily by constructing
`new URL()`. Several startup and connection logs include raw endpoint values,
and the shared direct-provider HTTP helper uses `fetch`'s default redirect
behavior ([HTTP helper](../src/llm-http.ts#L23-L48)). Tool logging includes the
first 200 characters of string arguments at info and full arguments at debug
([tool logging](../src/tools/helpers.ts#L17-L64)). The prose-logging issue is
already documented in
[OPENCLAW_ADOPTION_ASSESSMENT.md](OPENCLAW_ADOPTION_ASSESSMENT.md); NemoClaw
does not create a duplicate roadmap item.

### Useful NemoClaw refinement

NemoClaw rejects endpoint userinfo, query strings, fragments, and unsafe
characters at its managed boundary
([custom endpoint security](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/inference/custom-endpoint-security.mdx#L28-L45)).
Its discovery transport manually rejects redirects and cumulatively bounds
response bodies
([bounded fetch](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/tools/mcp-tool-discovery-runtime/tool-discovery-core.ts#L247-L311)).
Provider validation caches only when endpoint, model, authentication identity,
tool need, and address identity still match
([validation cache](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/inference/understand-provider-validation.mdx#L81-L105)).

### Recommended Mnemosyne adaptation

1. Centralize an HTTP(S)-only service-URL parser.
2. Reject embedded credentials and fragments; normally reject query strings
   for service base URLs.
3. Log only a sanitized origin/host representation.
4. Reject redirects, or explicitly permit only a validated same-origin redirect,
   for credential-bearing requests.
5. Bound upstream error-body reads before logging or returning them.
6. Apply recursive sensitive-key and URL redaction at the final logging sink.

Do **not** adopt blanket private-address rejection. OC, Ollama, NAS models, and
sibling MCP services intentionally use loopback or RFC1918 endpoints. The full
SSRF/DNS-pinning machinery becomes appropriate only if untrusted callers can
introduce arbitrary URLs or Mnemosyne gains browser/tool execution.

## 5. Optional integration: NemoClaw as an MCP host

NemoClaw could be evaluated as another host for Mnemosyne's existing
Streamable HTTP MCP surface, potentially with a mature-capable host model. This
is a real integration possibility, not a reason to merge the projects.

NemoClaw's managed MCP contract imposes important constraints
([server registration](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/manage-sandboxes/add-mcp-server.mdx#L36-L110),
[method profile](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/manage-sandboxes/add-mcp-server.mdx#L149-L205)):

- Streamable HTTP only; stdio servers are unsupported.
- Private endpoints require HTTPS, a stable exact hostname/address set, a
  routed reverse proxy, and explicit trusted-private configuration.
- The bearer credential is retained at the OpenShell boundary rather than
  exposed in the sandbox.
- Requests are capped at 131,072 bytes.
- `tools/call` currently permits every tool advertised by the server;
  `strict_tool_names` validates syntax and is not an authorization allowlist.

Do not run this spike until the HTTP filesystem authority issue is closed.
Because per-tool authorization is absent, run it only against an isolated test
Mnemosyne deployment with a temporary `MNEMO_DATA_DIR` and an isolated,
disposable OpenChronicle instance or equivalently scoped OC authority that
cannot reach normal stories. Merely selecting a disposable story in the normal
deployment is insufficient because every advertised tool can select and mutate
other visible stories. Large inline imports may exceed the request cap.

A bounded compatibility spike should prove:

1. only the isolated disposable story namespace is visible;
2. initialization and paginated `tools/list`;
3. one read-only story operation;
4. one direct-provider continuation in a disposable story;
5. exact behavior for output rewriting, timeout, cancellation, and retry;
6. absence of the bearer value in sandbox state and logs;
7. explicit failure above the request-size cap.

Stop if the deployment offers no workflow better than Mnemosyne's native UI or
another existing MCP host. No core code should be added merely to advertise
compatibility.

## Corroboration, not new work

NemoClaw raises confidence in several already-recorded ideas but does not add
new backlog items for them:

| Existing Mnemosyne work | Existing authority |
|---|---|
| Per-story lanes, run IDs, cancellation, idempotency, and ambiguous external-mutation outcomes | [OPENCLAW_ADOPTION_ASSESSMENT.md](OPENCLAW_ADOPTION_ASSESSMENT.md) |
| Provider capability descriptors | [OPENCLAW_ADOPTION_ASSESSMENT.md](OPENCLAW_ADOPTION_ASSESSMENT.md) |
| Story/provider content capability and fail-closed generation gate | [CONTENT_ROUTING_DESIGN.md](CONTENT_ROUTING_DESIGN.md), unratified |
| Local validator proof, exact model preflight, structured verdicts, and context admission | [OLLAMA_ADOPTION_ASSESSMENT.md](OLLAMA_ADOPTION_ASSESSMENT.md) |
| Privacy-safe prose logging, atomic config writes, session capacity, and remote HTTP hardening | [OPENCLAW_ADOPTION_ASSESSMENT.md](OPENCLAW_ADOPTION_ASSESSMENT.md) |
| Provider usage/timing normalization and recoverable browser-run projection | [OPEN_WEBUI_ADOPTION_ASSESSMENT.md](OPEN_WEBUI_ADOPTION_ASSESSMENT.md) |

NemoClaw's provider-specific configuration and validation reinforce the value
of static capability metadata generally. They do not describe content ratings
or companion-conversation side effects; those fields remain grounded in
Mnemosyne's existing OpenClaw assessment and content-routing design. If that
proposal is ratified, the smallest descriptor should identify direct versus
companion execution, content capability, supported per-call controls,
system-prompt behavior, structured-output suitability, and whether generation
mutates an external conversation. It should be used at the single generation
chokepoint and by the UI. It does not justify a dynamic provider registry or
runtime router.

## Conditional findings with real triggers

### Container and deployment hardening

When Mnemosyne gains an actual Docker/non-loopback deployment design, adopt a
measured profile: non-root UID, read-only root, only the data directory
writable, tmpfs for temporary files, `no-new-privileges`, capability drop,
resource/PID/file-descriptor limits, runtime secret injection, and distinct
liveness/readiness checks. Do not copy NemoClaw's exact resource values or
claim best-effort Landlock as the boundary. Today there is no Dockerfile, so
building one merely to resemble NemoClaw would manufacture work.

## Explicit non-adoptions

| NemoClaw capability | Decision | Reason |
|---|---|---|
| OpenShell/NemoClaw runtime dependency | Reject | Mnemosyne is a trusted application service, not an untrusted code-executing agent |
| Internal agent sandbox | Reject | Model output is never executed; a sandbox would not protect the actual data boundary |
| Credential-substitution gateway | Reject | The trusted Mnemosyne process is the API client; there is no separate untrusted execution plane |
| General inference router or automatic failover | Reject | One configured generator is deliberate, and provider side effects differ |
| Onboarding/checkpoint state machine | Reject | Mnemosyne has no multi-step resource installer or managed sandbox lifecycle |
| Snapshots, restore orchestration, or second memory | Reject | OpenChronicle remains canonical; exports already provide portability |
| Agent skills, plugins, channels, scheduler, or multi-agent runtime | Reject | No demonstrated story-operation consumer exists |
| Process ownership of OC/Ollama | Reject | They are externally supervised dependencies; Mnemosyne should not start or stop them |
| Blanket egress/private-IP denial in application code | Reject | Private and loopback endpoints are first-class current deployments |
| NemoClaw model catalog and reviewed-runtime bundles | Reject | A narrow provider evidence ledger is sufficient; the packaging burden answers NemoClaw's different threat model |

## Low-cost repository hardening

NemoClaw also demonstrates supply-chain practices that fit Mnemosyne without
bringing in runtime architecture:

- pin GitHub Actions to full commit SHAs with version comments;
- declare `permissions: contents: read` at workflow scope;
- set checkout `persist-credentials: false`;
- use `npm ci` for the Web UI build because `webui/package-lock.json` exists.

These are worthwhile maintenance changes, but they are not storytelling
capabilities and are not scheduled by this assessment. NemoClaw's reviewed
tarball/runtime-bundle machinery is disproportionate to Mnemosyne.

## License and reuse boundary

NemoClaw is Apache-2.0
([package metadata](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/package.json),
[license](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/LICENSE));
Mnemosyne is MIT. Architectural ideas may be independently implemented.
Literal or substantial source copying requires preserving the Apache 2.0
license and retained copyright/license notices, noting modified files, and
preserving a `NOTICE` file if material copied later includes one. Because every
recommended contract is small, a Mnemosyne-native implementation is
preferable. No NemoClaw code has been incorporated. This is an engineering
boundary, not legal advice.

## Candidate sequence if separately ratified

This is dependency order, not a roadmap:

1. **Transport authority:** reject path-bearing import/export inputs in HTTP
   mode and prove it through the real MCP transport.
2. **External contracts:** runtime schemas plus bounded required-tool discovery.
3. **Status projection:** protected semantic readiness using those discoveries
   and provider-specific non-mutating probes.
4. **Endpoint hygiene:** URL, redirect, bounded-body, and final-sink redaction
   tightening.
5. **Conditional host spike:** test NemoClaw only after the first three slices.
6. **Conditional deployment profile:** only with an actual deployment design.

## Audit limitations and re-evaluation triggers

This was a static review. NemoClaw's dependencies and upstream test suites were
not installed or run, and no network/sandbox compatibility test was attempted.
The findings distinguish source-observed Mnemosyne gaps from actual incidents.
NemoClaw is a fast-moving `0.1.0` project, so future reviews should pin a commit
rather than cite `main`.

Revisit rejected capabilities only when one of these conditions becomes true:

- Mnemosyne accepts untrusted non-loopback clients;
- an actual NemoClaw/OpenShell host is selected;
- Docker or remote deployment receives an operator and threat model;
- Mnemosyne begins executing model-generated code or arbitrary tools;
- multi-replica operation creates a real coordination requirement;
- a separate untrusted execution plane creates a credential-isolation need;
- per-request multi-provider routing is ratified from demonstrated use.

## Source map

| Area | Pinned source | Use in this assessment |
|---|---|---|
| Platform shape | [README](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/README.md) | Establishes the sandboxed-agent/reference-stack boundary |
| Trusted computing boundary | [tcb-boundary.mdx](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/security/tcb-boundary.mdx) | Trusted host/control plane versus untrusted agent/runtime input |
| MCP registration | [add-mcp-server.mdx](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/manage-sandboxes/add-mcp-server.mdx) | HTTPS/private-host requirements, body limit, broad `tools/call` grant |
| MCP discovery | [manage-mcp-servers.mdx](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/manage-sandboxes/manage-mcp-servers.mdx) | Non-mutating name discovery and safe status |
| Discovery implementation | [tool-discovery-core.ts](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/tools/mcp-tool-discovery-runtime/tool-discovery-core.ts) | Pagination, duplicate, timeout, redirect, and body limits |
| Provider validation | [understand-provider-validation.mdx](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/inference/understand-provider-validation.mdx) | Exact semantic preflight and bounded cache identity |
| Endpoint security | [custom-endpoint-security.mdx](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/docs/inference/custom-endpoint-security.mdx) | URL-shape validation and trusted-private distinction |
| Readiness | [gateway.ts](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/src/lib/readiness/gateway.ts) | Timestamped observations, unknown state, bounded findings |
| Inference health | [health.ts](https://github.com/NVIDIA/NemoClaw/blob/b7261ff7cc73c76a15deb3e95291c24b1624534e/src/lib/inference/health.ts) | Semantic response validation and failure classification |

## Final assessment

NemoClaw does not reveal a missing general agent platform inside Mnemosyne, and
it does not supply a missing storytelling feature. Its value is boundary
engineering.

The defensible transfer is narrow:

- close the HTTP filesystem authority leak;
- validate external MCP responses and required tool names;
- report dependency readiness truthfully;
- refine endpoint and telemetry hygiene;
- optionally test NemoClaw as a separate host after those boundaries are safe.

Everything else remains existing work, conditional on a real trigger, or
explicitly rejected. That keeps the assessment useful without turning
NemoClaw's breadth into an invented Mnemosyne roadmap.
