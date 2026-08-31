import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useBlocker, useParams } from "react-router";
import { useApi } from "../hooks/useApi";
import {
  ApiError,
  continueStory,
  getCapabilities,
  getEntity,
  getStory,
  listEntities,
  type ContinueResponse,
} from "../api/client";
import {
  SCENE_CONTEXT_STRATEGIES,
  type EntitySummary,
  type Mode,
  type RangeCapability,
  type SceneContextStrategy,
  type ValidationReport,
} from "../api/types";
import Loading from "../components/Loading";
import ErrorBanner from "../components/ErrorBanner";
import BodyText from "../components/BodyText";
import ModeSwitcher, { MODE_COPY } from "../components/ModeSwitcher";
import WorkspacePane from "../components/WorkspacePane";
import WorkspaceShell from "../components/WorkspaceShell";
import { canonStatusLabel, contextEntityCount } from "../result-status";
import { buildContinueRequest } from "../continue-request";

type PaneId = "scenes" | "cast" | "assembly" | "media" | "watch";

const PANE_COPY: Record<
  PaneId,
  { short: string; title: string; eyebrow: string }
> = {
  scenes: { short: "S", title: "Scene index", eyebrow: "Manuscript" },
  cast: { short: "C", title: "Story cast", eyebrow: "Canon" },
  assembly: { short: "A", title: "Beat assembly", eyebrow: "Instrument" },
  media: { short: "M", title: "Scene media", eyebrow: "Sidecar" },
  watch: { short: "W", title: "Watch along", eyebrow: "Companion" },
};

function formatDate(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "Undated";
  return instant.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sortableDate(iso: string): number {
  const timestamp = new Date(iso).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sceneTitle(scene: EntitySummary): string {
  if (/^Scene \d{4}-\d{2}-\d{2}T/.test(scene.name)) {
    return formatDate(scene.created_at);
  }
  return scene.name;
}

function beatTitle(name: string | undefined): string {
  const match = name?.match(/^Scene (\d{4}-\d{2}-\d{2}T.+)$/);
  if (!match) return name ?? "The floor is open";
  const instant = new Date(match[1]);
  if (Number.isNaN(instant.getTime())) return "New beat";
  return `New beat · ${instant.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function resultAnnouncement(result: ContinueResponse): string {
  if (result.yielded_to_user) {
    return "The group handed the floor back to you. The submitted direction was cleared.";
  }
  if (result.incomplete) {
    return "The beat reached its token limit and was not saved. Your direction remains in the composer.";
  }
  return `${beatTitle(result.beat_name)} generated; ${canonStatusLabel(result)}.`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SceneDocument({
  storyId,
  memoryId,
}: {
  storyId: string;
  memoryId: string;
}) {
  const state = useApi(() => getEntity(storyId, memoryId), [storyId, memoryId]);

  if (state.status === "loading") {
    return <Loading label="Opening the selected scene…" />;
  }
  if (state.status === "error") return <ErrorBanner error={state.error} />;

  const scene = state.data.entity;
  const validationTag = scene.tags.find((tag) => tag.startsWith("validation:"));

  return (
    <article className="manuscript-leaf manuscript-leaf--saved">
      <header className="manuscript-leaf-header">
        <div>
          <span className="leaf-kicker">Saved scene</span>
          <h2>{sceneTitle(scene)}</h2>
        </div>
        <div className="leaf-meta">
          <span>{formatDate(scene.created_at)}</span>
          {validationTag && <span>{validationTag.replace(":", " · ")}</span>}
        </div>
      </header>
      <div className="manuscript-prose">
        <BodyText text={scene.body} />
      </div>
    </article>
  );
}

function ResultBeat({
  result,
  storyId,
}: {
  result: ContinueResponse;
  storyId: string;
}) {
  return (
    <article
      className="manuscript-leaf manuscript-leaf--generated"
      id={`run-${result.run_id}`}
    >
      <header className="manuscript-leaf-header">
        <div>
          <span className="leaf-kicker">Generated beat</span>
          <h2>{beatTitle(result.beat_name)}</h2>
        </div>
        <div className="leaf-meta">
          <span>{result.mode}</span>
          <span>{canonStatusLabel(result)}</span>
        </div>
      </header>

      {result.message && (
        <p className={result.incomplete ? "result-warning" : "result-message"}>
          {result.message}
        </p>
      )}
      {result.save_error && (
        <p className="result-warning">
          Scene save warning: {result.save_error}
          {result.canon_write_outcome === "unknown" &&
            " The write may have completed; inspect the scene index before saving again."}
        </p>
      )}
      {result.capability_warnings?.map((warning) => (
        <p className="result-warning" key={warning}>
          {warning}
        </p>
      ))}

      {result.beat_text !== "" && (
        <div className="manuscript-prose">
          <BodyText text={result.beat_text} />
        </div>
      )}

      {result.validation && (
        <details className="inline-disclosure">
          <summary>
            Validation ·{" "}
            {result.validation.issues.length === 0
              ? "clean"
              : `${result.validation.issues.length} issues`}
          </summary>
          <p>{result.validation.summary}</p>
          {result.validation.issues.length > 0 && (
            <ul className="result-list">
              {result.validation.issues.map(
                (issue: ValidationReport["issues"][number], index: number) => (
                  <li key={`${issue.rule}-${index}`}>
                    <span className="issue-severity">{issue.severity}</span>{" "}
                    {issue.rule}: {issue.violating_text}
                    <div className="issue-text">{issue.explanation}</div>
                  </li>
                ),
              )}
            </ul>
          )}
        </details>
      )}
      {result.validation_error && (
        <p className="result-warning">
          Validation failed: {result.validation_error}
        </p>
      )}

      <footer className="leaf-footer">
        <span>Run {result.run_id.slice(0, 8)}</span>
        {result.group_turns !== undefined && (
          <span>
            {result.group_turns} group turn
            {result.group_turns === 1 ? "" : "s"}
          </span>
        )}
        {result.memory_id && (
          <Link
            to={`/stories/${storyId}/entities/${result.memory_id}`}
            className="inline-link"
          >
            Open saved scene
          </Link>
        )}
      </footer>
    </article>
  );
}

function RunErrorBanner({
  error,
  submittedDirection,
}: {
  error: Error;
  submittedDirection?: string;
}) {
  const body = error instanceof ApiError ? error.body : undefined;
  const retryUnsafe = body?.retry_safe === false;
  const retrySafe = body?.retry_safe === true;

  return (
    <div
      className={`run-error${retryUnsafe ? " is-uncertain" : ""}`}
      role="alert"
    >
      <strong>
        {retryUnsafe ? "Run outcome uncertain" : "Beat generation stopped"}
      </strong>
      <p>{body?.message ?? error.message}</p>
      {retryUnsafe && (
        <>
          <p>
            Do not submit this direction again yet. The companion may have
            received it, changed its conversation, or charged the provider.
            Inspect the companion conversation and scene index before deciding
            what to do next.
          </p>
          {body?.provider_charge_possible && (
            <span className="run-error-flag">Provider charge possible</span>
          )}
          {body?.external_conversation_mutation_possible && (
            <span className="run-error-flag">
              Companion conversation may have changed
            </span>
          )}
          {submittedDirection && (
            <details className="inline-disclosure">
              <summary>Submitted direction</summary>
              <blockquote>{submittedDirection}</blockquote>
            </details>
          )}
        </>
      )}
      {retrySafe && (
        <p>The server confirmed this direction is safe to submit again.</p>
      )}
    </div>
  );
}

function PaneEmpty({
  title,
  children,
  mark,
}: {
  title: string;
  children: ReactNode;
  mark: string;
}) {
  return (
    <div className="pane-empty">
      <div className="pane-empty-mark" aria-hidden="true">
        {mark}
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export default function ContinueScenePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const [entitiesRevision, setEntitiesRevision] = useState(0);
  const storyState = useApi(() => getStory(storyId!), [storyId]);
  const entitiesState = useApi(
    () => listEntities(storyId!, {}),
    [storyId, entitiesRevision],
  );
  const capsState = useApi(() => getCapabilities(), []);
  const genCaps =
    capsState.status === "ready" ? capsState.data.generator : undefined;

  const [entityCache, setEntityCache] = useState<{
    storyId?: string;
    entities: EntitySummary[];
  }>({ entities: [] });
  const entityRecords = useMemo(() => {
    if (entitiesState.status === "ready") {
      return entitiesState.data.entities;
    }
    return entityCache.storyId === storyId ? entityCache.entities : [];
  }, [entitiesState, entityCache, storyId]);

  const scenes = useMemo(() => {
    return entityRecords
      .filter((entity) => entity.type === "scene")
      .sort(
        (left, right) =>
          sortableDate(right.created_at) - sortableDate(left.created_at),
      );
  }, [entityRecords]);

  const characters = useMemo(() => {
    return entityRecords
      .filter((entity) => entity.type === "character")
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [entityRecords]);

  const [selectedSceneId, setSelectedSceneId] = useState<string>();
  const [openPanes, setOpenPanes] = useState<PaneId[]>(["scenes", "cast"]);
  const [focusedPane, setFocusedPane] = useState<PaneId | null>(null);
  const [direction, setDirection] = useState("");
  const [mode, setMode] = useState<Mode>("director");
  const [strategy, setStrategy] = useState<
    SceneContextStrategy | "server-default"
  >("server-default");
  const [fallbackStrategy, setFallbackStrategy] = useState<
    SceneContextStrategy | "server-default"
  >("server-default");
  const [validate, setValidate] = useState(false);
  const [allowUser, setAllowUser] = useState(false);
  const [groupMaxTurns, setGroupMaxTurns] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [temperature, setTemperature] = useState("");
  const [model, setModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ContinueResponse[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [unsafeDirection, setUnsafeDirection] = useState<string>();
  const [navigationNotice, setNavigationNotice] = useState(false);
  const directionRef = useRef<HTMLTextAreaElement>(null);
  const latestResult = results[results.length - 1] ?? null;
  const blocker = useBlocker(submitting);

  useEffect(() => {
    if (entitiesState.status === "ready") {
      setEntityCache({
        storyId,
        entities: entitiesState.data.entities,
      });
    }
  }, [entitiesState, storyId]);

  useEffect(() => {
    setSelectedSceneId(undefined);
    setResults([]);
    setError(null);
    setUnsafeDirection(undefined);
    setDirection("");
  }, [storyId]);

  useEffect(() => {
    setSelectedSceneId((current) => {
      if (current && scenes.some((scene) => scene.memory_id === current)) {
        return current;
      }
      return scenes[0]?.memory_id;
    });
  }, [scenes]);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    setNavigationNotice(true);
    blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!submitting) setNavigationNotice(false);
  }, [submitting]);

  useEffect(() => {
    if (!submitting) return;
    const guardReload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guardReload);
    return () => window.removeEventListener("beforeunload", guardReload);
  }, [submitting]);

  const story = storyState.status === "ready" ? storyState.data.story : null;
  const storyName = story?.name ?? "Opening story…";
  const isKindroidGroup =
    genCaps?.provider === "kindroid" && Boolean(story?.kindroid_group_id);
  const companionModeCaveat =
    genCaps?.system_prompt_channel === "none" &&
    (genCaps.provider === "kindroid" || genCaps.provider === "botify");

  const showRange = (cap: RangeCapability | undefined): boolean =>
    cap === undefined || cap === "unknown" || cap.supported;
  const unknownHint = (cap: RangeCapability | undefined): string | null =>
    cap === "unknown"
      ? "Support depends on the selected model; an unsupported model rejects it."
      : null;

  const disabled = direction.trim().length === 0 || submitting;

  function showPane(pane: PaneId) {
    setOpenPanes((current) =>
      current.includes(pane) ? current : [...current, pane],
    );
    setFocusedPane(null);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`pane-${pane}`)?.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      });
    });
  }

  function closePane(pane: PaneId) {
    setOpenPanes((current) => current.filter((item) => item !== pane));
    if (focusedPane === pane) setFocusedPane(null);
    window.requestAnimationFrame(() => {
      document.getElementById(`spine-${pane}`)?.focus();
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId || direction.trim().length === 0 || submitting) return;

    const submittedDirection = direction.trim();
    setSubmitting(true);
    setError(null);
    setUnsafeDirection(undefined);

    try {
      const payload = buildContinueRequest({
        direction: submittedDirection,
        mode,
        validate,
        strategy,
        fallbackStrategy,
        maxTokens,
        temperature,
        model,
        kindroidGroup: isKindroidGroup,
        allowUser,
        groupMaxTurns,
      });
      const response = await continueStory(storyId, payload);
      setResults((current) => [...current, response]);
      if (response.memory_id || response.canon_write_outcome === "unknown") {
        setEntitiesRevision((current) => current + 1);
      }
      if (!response.incomplete) {
        setDirection("");
        window.requestAnimationFrame(() => directionRef.current?.focus());
      }
    } catch (err) {
      const failure =
        err instanceof Error ? err : new Error("Unknown generation failure");
      setError(failure);
      if (failure instanceof ApiError && failure.body?.retry_safe === false) {
        setUnsafeDirection(submittedDirection);
        setDirection("");
        window.requestAnimationFrame(() => directionRef.current?.focus());
      }
    } finally {
      setSubmitting(false);
    }
  }

  function paneContent(pane: PaneId): ReactNode {
    if (pane === "scenes") {
      if (entitiesState.status === "loading") {
        return <Loading label="Indexing scenes…" />;
      }
      if (entitiesState.status === "error") {
        return (
          <PaneEmpty title="Scene index unavailable" mark="S">
            The entity request failed. The manuscript alert has the archive
            error details.
          </PaneEmpty>
        );
      }
      if (scenes.length === 0) {
        return (
          <PaneEmpty title="No saved scenes" mark="S">
            Generate a first beat below. It will appear in the manuscript now
            and in this index after the archive refreshes.
          </PaneEmpty>
        );
      }
      return (
        <div className="scene-index">
          {scenes.map((scene, index) => (
            <button
              key={scene.memory_id}
              type="button"
              className={`scene-index-item${
                selectedSceneId === scene.memory_id ? " is-active" : ""
              }`}
              aria-pressed={selectedSceneId === scene.memory_id}
              onClick={() => setSelectedSceneId(scene.memory_id)}
            >
              <span className="scene-index-number">
                {String(scenes.length - index).padStart(2, "0")}
              </span>
              <span>
                <strong>{sceneTitle(scene)}</strong>
                <small>{formatDate(scene.created_at)}</small>
              </span>
            </button>
          ))}
        </div>
      );
    }

    if (pane === "cast") {
      if (entitiesState.status === "loading") {
        return <Loading label="Gathering the cast…" />;
      }
      if (entitiesState.status === "error") {
        return (
          <PaneEmpty title="Cast unavailable" mark="C">
            The entity request failed. The manuscript alert has the archive
            error details.
          </PaneEmpty>
        );
      }
      if (characters.length === 0) {
        return (
          <PaneEmpty title="No characters yet" mark="C">
            Add character entities to the canon before staging a cast.
          </PaneEmpty>
        );
      }
      return (
        <div className="cast-list">
          {characters.map((character) => (
            <Link
              key={character.memory_id}
              className="cast-member"
              to={`/stories/${storyId}/entities/${character.memory_id}`}
            >
              <span
                className="character-portrait"
                data-portrait="fallback"
                aria-hidden="true"
              >
                {initials(character.name)}
              </span>
              <span>
                <strong>{character.name}</strong>
                <small>
                  {character.pinned ? "Pinned character" : "Character"}
                </small>
              </span>
            </Link>
          ))}
        </div>
      );
    }

    if (pane === "assembly") {
      if (!latestResult) {
        return (
          <PaneEmpty title="No completed beat" mark="A">
            Generate a beat to inspect its admitted context, token estimate,
            timings, provider usage, and validation result.
          </PaneEmpty>
        );
      }

      const plan = latestResult.context_plan;
      const estimatedTokens = plan
        ? plan.est_fixed_tokens +
          plan.est_direction_tokens +
          Object.values(plan.sections).reduce(
            (sum, section) => sum + (section?.est_tokens ?? 0),
            0,
          )
        : undefined;
      const generatorUsage = latestResult.usage?.generator;
      const gatheredEntities = contextEntityCount(latestResult);

      return (
        <div className="assembly-gauge">
          <div className="assembly-headline">
            <strong>{gatheredEntities ?? "—"}</strong>
            <span>
              {gatheredEntities === undefined
                ? "gathering unreported"
                : "entities gathered"}
            </span>
          </div>
          <dl className="instrument-grid">
            <div>
              <dt>Admission</dt>
              <dd>{plan?.verdict ?? "unreported"}</dd>
            </div>
            <div>
              <dt>Estimated input</dt>
              <dd>{estimatedTokens?.toLocaleString() ?? "unknown"}</dd>
            </div>
            <div>
              <dt>Window</dt>
              <dd>{plan?.input_budget?.toLocaleString() ?? "unknown"}</dd>
            </div>
            <div>
              <dt>Dropped</dt>
              <dd>{plan?.dropped_entries.length ?? 0}</dd>
            </div>
          </dl>
          {latestResult.context_summary && (
            <div className="context-bars">
              {Object.entries(latestResult.context_summary).map(
                ([label, count]) => (
                  <div className="context-bar" key={label}>
                    <span>{label}</span>
                    <span className="context-bar-track" aria-hidden="true">
                      <span
                        style={{
                          width: `${Math.max(
                            6,
                            (count / Math.max(1, gatheredEntities ?? 0)) * 100,
                          )}%`,
                        }}
                      />
                    </span>
                    <strong>{count}</strong>
                  </div>
                ),
              )}
            </div>
          )}
          <dl className="instrument-list">
            <div>
              <dt>Provider</dt>
              <dd>{generatorUsage?.provider ?? plan?.provider ?? "unknown"}</dd>
            </div>
            <div>
              <dt>Reported tokens</dt>
              <dd>
                {generatorUsage?.total_tokens?.toLocaleString() ??
                  "not reported"}
              </dd>
            </div>
            <div>
              <dt>Gather / generate / save</dt>
              <dd>
                {latestResult.stages_ms.gather_ms} /{" "}
                {latestResult.stages_ms.generate_ms} /{" "}
                {latestResult.stages_ms.save_ms} ms
              </dd>
            </div>
            {plan?.companion_selection && (
              <div>
                <dt>Companion matches</dt>
                <dd>{plan.companion_selection.length}</dd>
              </div>
            )}
          </dl>
        </div>
      );
    }

    if (pane === "media") {
      return (
        <PaneEmpty title="Media bridge not connected" mark="M">
          This workspace has a real place for beat-linked images and video, but
          Mnemosyne does not yet expose a safe asset manifest or media endpoint.
          No image is being fabricated here.
        </PaneEmpty>
      );
    }

    return (
      <PaneEmpty title="Watch-along not enabled" mark="W">
        The Watch Companion bridge is a reviewed proposal, not a running WebUI
        integration. Live status, chat, and canon promotion will appear here
        only after its dedicated replay-safe API ships.
      </PaneEmpty>
    );
  }

  const dock = (
    <div className={`studio-dock${focusedPane ? " has-focused-pane" : ""}`}>
      <div className="story-spine" role="group" aria-label="Story panes">
        {(Object.keys(PANE_COPY) as PaneId[]).map((pane) => {
          const isOpen = openPanes.includes(pane);
          const isVisible = isOpen && (!focusedPane || focusedPane === pane);
          return (
            <button
              key={pane}
              id={`spine-${pane}`}
              type="button"
              className={`spine-marker${isOpen ? " is-open" : ""}`}
              aria-expanded={isVisible}
              aria-controls={isVisible ? `pane-${pane}` : undefined}
              aria-label={`${isOpen ? "Show" : "Open"} ${PANE_COPY[pane].title}`}
              onClick={() => showPane(pane)}
            >
              <span aria-hidden="true">{PANE_COPY[pane].short}</span>
              <span className="spine-tooltip">{PANE_COPY[pane].title}</span>
            </button>
          );
        })}
      </div>
      <div className="pane-stack">
        {openPanes.map((pane) => {
          if (focusedPane && focusedPane !== pane) return null;
          const copy = PANE_COPY[pane];
          return (
            <WorkspacePane
              key={pane}
              paneId={pane}
              title={copy.title}
              eyebrow={copy.eyebrow}
              focused={focusedPane === pane}
              onFocus={() =>
                setFocusedPane((current) => (current === pane ? null : pane))
              }
              onClose={() => closePane(pane)}
            >
              {paneContent(pane)}
            </WorkspacePane>
          );
        })}
        {openPanes.length === 0 && (
          <div className="pane-shelf-empty">
            Open a pane from the story spine.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <WorkspaceShell
      storyId={storyId}
      storyName={storyName}
      active="continue"
      eyebrow="Story studio"
      title={storyName}
      mode={mode}
      dock={dock}
      headerActions={
        <div className="studio-header-actions">
          <ModeSwitcher value={mode} onChange={setMode} />
          <span className="provider-badge">
            {genCaps?.provider ?? "provider"}
          </span>
        </div>
      }
    >
      <div className="studio-canvas">
        <header className="manuscript-heading">
          <div>
            <span className="manuscript-overline">Current manuscript</span>
            <h1>{storyName}</h1>
            <p>{MODE_COPY[mode].description}</p>
          </div>
          <div className="manuscript-status">
            <span>{scenes.length} saved scenes</span>
            {isKindroidGroup && <span>Kindroid group bound</span>}
          </div>
        </header>

        {storyState.status === "loading" && <Loading label="Opening story…" />}
        {storyState.status === "error" && (
          <ErrorBanner error={storyState.error} />
        )}
        {entitiesState.status === "error" && (
          <ErrorBanner error={entitiesState.error} />
        )}

        <div className="manuscript-flow">
          {selectedSceneId ? (
            <SceneDocument storyId={storyId!} memoryId={selectedSceneId} />
          ) : entitiesState.status === "ready" && scenes.length === 0 ? (
            <div className="manuscript-empty">
              <span className="leaf-kicker">A blank page</span>
              <h2>Set the first scene</h2>
              <p>
                Give the generator a location, who is present, and the pressure
                already in the room. The completed beat becomes the story’s
                first saved scene.
              </p>
            </div>
          ) : null}
          {results.map((runResult) => (
            <ResultBeat
              key={runResult.run_id}
              result={runResult}
              storyId={storyId!}
            />
          ))}
        </div>

        {companionModeCaveat && (
          <div className="mode-caveat" role="note">
            This companion provider has no native system-prompt channel. The
            posture changes the workspace now, but does not yet change how the
            companion performs the beat.
          </div>
        )}

        {error && (
          <RunErrorBanner error={error} submittedDirection={unsafeDirection} />
        )}

        <p className="sr-only" role="status">
          {latestResult ? resultAnnouncement(latestResult) : ""}
        </p>

        <form
          className="story-composer"
          onSubmit={onSubmit}
          aria-busy={submitting}
        >
          <div className="composer-main">
            <label className="sr-only" htmlFor="direction">
              Direction for the next beat
            </label>
            <textarea
              ref={directionRef}
              id="direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              rows={3}
              className="composer-textarea"
              placeholder={
                mode === "participant"
                  ? "What do you say or do?"
                  : mode === "audience"
                    ? "Offer a light nudge, or ask the story to continue…"
                    : "Stage the next beat…"
              }
              required
            />
            <button type="submit" className="composer-send" disabled={disabled}>
              {submitting ? "Generating…" : "Generate beat"}
            </button>
          </div>

          <div className="composer-meta-row">
            <span>Next beat · {mode}</span>
            {submitting && (
              <span className="composer-running" role="status">
                {navigationNotice
                  ? "Navigation stayed here so this run’s outcome is not lost."
                  : "Run in progress. Navigation is locked until its outcome is known."}
              </span>
            )}
            <details className="composer-settings">
              <summary>Generation settings</summary>
              <div className="settings-panel">
                <div className="field-grid">
                  <div>
                    <label className="field-label" htmlFor="strategy">
                      Scene context
                    </label>
                    <select
                      id="strategy"
                      value={strategy}
                      onChange={(event) =>
                        setStrategy(
                          event.target.value as
                            SceneContextStrategy | "server-default",
                        )
                      }
                      className="select"
                    >
                      <option value="server-default">Server default</option>
                      {SCENE_CONTEXT_STRATEGIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label" htmlFor="fallbackStrategy">
                      Fallback context
                    </label>
                    <select
                      id="fallbackStrategy"
                      value={fallbackStrategy}
                      onChange={(event) =>
                        setFallbackStrategy(
                          event.target.value as
                            SceneContextStrategy | "server-default",
                        )
                      }
                      className="select"
                    >
                      <option value="server-default">Server default</option>
                      {SCENE_CONTEXT_STRATEGIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  {showRange(genCaps?.max_tokens) && (
                    <div>
                      <label className="field-label" htmlFor="max_tokens">
                        Max tokens
                      </label>
                      <input
                        id="max_tokens"
                        type="number"
                        min="1"
                        max="8192"
                        step="1"
                        value={maxTokens}
                        onChange={(event) => setMaxTokens(event.target.value)}
                        className="input"
                        placeholder="Provider default"
                        aria-describedby="max-tokens-hint"
                      />
                      <span id="max-tokens-hint" className="field-hint">
                        {unknownHint(genCaps?.max_tokens) ??
                          "Blank preserves the provider default."}
                      </span>
                    </div>
                  )}

                  {showRange(genCaps?.temperature) && (
                    <div>
                      <label className="field-label" htmlFor="temperature">
                        Temperature
                      </label>
                      <input
                        id="temperature"
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={temperature}
                        onChange={(event) => setTemperature(event.target.value)}
                        className="input"
                        placeholder="Provider default"
                        aria-describedby="temp-hint"
                      />
                      <span id="temp-hint" className="field-hint">
                        {unknownHint(genCaps?.temperature) ??
                          "Blank preserves the provider default."}
                      </span>
                    </div>
                  )}

                  {(genCaps === undefined ||
                    genCaps.per_call_model_override) && (
                    <div>
                      <label className="field-label" htmlFor="model">
                        Model
                      </label>
                      <input
                        id="model"
                        type="text"
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        className="input"
                        placeholder="Configured model"
                      />
                    </div>
                  )}

                  {isKindroidGroup && (
                    <div>
                      <label className="field-label" htmlFor="group-max-turns">
                        Group turns
                      </label>
                      <input
                        id="group-max-turns"
                        type="number"
                        min="1"
                        max="8"
                        step="1"
                        value={groupMaxTurns}
                        onChange={(event) =>
                          setGroupMaxTurns(event.target.value)
                        }
                        className="input"
                        placeholder="Server default"
                        aria-describedby="group-turns-hint"
                      />
                      <span id="group-turns-hint" className="field-hint">
                        Blank preserves the configured group limit.
                      </span>
                    </div>
                  )}
                </div>

                <div className="settings-checks">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={validate}
                      onChange={(event) => setValidate(event.target.checked)}
                    />
                    Validate after generation
                  </label>
                  {isKindroidGroup && (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={allowUser}
                        onChange={(event) => setAllowUser(event.target.checked)}
                      />
                      Let the group hand the floor back to me
                    </label>
                  )}
                </div>
              </div>
            </details>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}
