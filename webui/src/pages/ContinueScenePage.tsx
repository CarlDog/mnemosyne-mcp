import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useApi } from "../hooks/useApi";
import {
  continueStory,
  getStory,
  type ContinueResponse,
} from "../api/client";
import {
  MODES,
  SCENE_CONTEXT_STRATEGIES,
  type Mode,
  type SceneContextStrategy,
  type ContinueRequest,
  type ValidationReport,
} from "../api/types";
import type { ApiError } from "../api/client";
import Loading from "../components/Loading";
import ErrorBanner from "../components/ErrorBanner";
import BodyText from "../components/BodyText";

export default function ContinueScenePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const storyState = useApi(() => getStory(storyId!), [storyId]);
  const [direction, setDirection] = useState("");
  const [mode, setMode] = useState<Mode>("director");
  const [strategy, setStrategy] = useState<SceneContextStrategy>("recency-first");
  const [fallbackStrategy, setFallbackStrategy] = useState<
    SceneContextStrategy | "none"
  >("none");
  const [validate, setValidate] = useState(false);
  const [maxTokens, setMaxTokens] = useState("");
  const [temperature, setTemperature] = useState("");
  const [model, setModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ContinueResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const storyName = storyState.status === "ready" ? storyState.data.story.name : "…";

  const disabled = direction.trim().length === 0 || submitting;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId || direction.trim().length === 0 || submitting) return;

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload: ContinueRequest = {
        direction: direction.trim(),
        mode,
        scene_context_strategy: strategy,
        validate,
      };
      if (fallbackStrategy !== "none") {
        payload.scene_context_fallback_strategy = fallbackStrategy;
      }
      if (maxTokens.trim() !== "") payload.max_tokens = Number(maxTokens);
      if (temperature.trim() !== "") payload.temperature = Number(temperature);
      if (model.trim() !== "") payload.model = model.trim();
      const response = await continueStory(storyId, payload);
      setResult(response);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          Mnemosyne
        </div>
        <nav className="crumbs">
          <Link to="/">Stories</Link>
          <span className="crumb-sep">/</span>
          <Link to={`/stories/${storyId}`}>{storyName}</Link>
          <span className="crumb-sep">/</span>
          <span>Continue</span>
        </nav>
      </header>
      <main className="content">
        {storyState.status === "loading" && <Loading label="Opening story…" />}
        {storyState.status === "error" && <ErrorBanner error={storyState.error} />}
        <form className="continue-form card" onSubmit={onSubmit}>
          <div className="panel-heading">
            <h1 className="panel-title">Continue Scene</h1>
            <p className="panel-subtitle">
              Ask the generator for the next beat and save it as a new scene.
            </p>
          </div>

          <label className="field-label" htmlFor="direction">
            Direction
          </label>
          <textarea
            id="direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            rows={4}
            className="textarea"
            placeholder="What happens next?"
            required
          />

          <div className="field-pair">
            <label className="field-label" htmlFor="mode">
              Mode
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as Mode)}
              className="select"
            >
              {MODES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="field-pair">
            <label className="field-label" htmlFor="strategy">
              Scene context strategy
            </label>
            <select
              id="strategy"
              value={strategy}
              onChange={(event) =>
                setStrategy(event.target.value as SceneContextStrategy)
              }
              className="select"
            >
              {SCENE_CONTEXT_STRATEGIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="field-pair">
            <label className="field-label" htmlFor="fallbackStrategy">
              Fallback scene context strategy
            </label>
            <select
              id="fallbackStrategy"
              value={fallbackStrategy}
              onChange={(event) =>
                setFallbackStrategy(
                  event.target.value as SceneContextStrategy | "none",
                )
              }
              className="select"
            >
              <option value="none">None</option>
              {SCENE_CONTEXT_STRATEGIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="field-grid">
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
                placeholder="default"
                aria-describedby="max-tokens-hint"
              />
              <span id="max-tokens-hint" className="field-hint">
                Leave blank to use provider default.
              </span>
            </div>
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
                placeholder="default"
                aria-describedby="temp-hint"
              />
              <span id="temp-hint" className="field-hint">
                Leave blank to preserve generator default.
              </span>
            </div>
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
                placeholder="Use default model"
                aria-describedby="model-hint"
              />
              <span id="model-hint" className="field-hint">
                Optional model override for this call.
              </span>
            </div>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={validate}
              onChange={(event) => setValidate(event.target.checked)}
            />
            Validate scene after generation
          </label>

          <div className="field-row">
            <button type="submit" className="button primary" disabled={disabled}>
              {submitting ? "Generating…" : "Generate beat"}
            </button>
            <Link to={`/stories/${storyId}`} className="button muted">
              Back to roster
            </Link>
          </div>
        </form>

        {error && <ErrorBanner error={error} />}

        {result && (
          <section className="result-panel card">
            <h2 className="panel-title">Result</h2>
            {result.yielded_to_user && (
              <p className="result-message">{result.message}</p>
            )}
            {result.save_error && (
              <p className="result-warning">
                Scene auto-save warning: {result.save_error}
              </p>
            )}
            <div className="result-meta">
              <span>Mode: {result.mode}</span>
              <span>Scene strategy: {strategy}</span>
              {fallbackStrategy !== "none" && (
                <span>Fallback strategy: {fallbackStrategy}</span>
              )}
              <span>
                Gather / generate / save / validate: {result.stages_ms.gather_ms}ms /{" "}
                {result.stages_ms.generate_ms}ms / {result.stages_ms.save_ms}ms /{" "}
                {result.stages_ms.validate_ms}ms
              </span>
            </div>
            {result.beat_text !== "" && <BodyText text={result.beat_text} />}
            {result.context_summary && (
              <>
                <h3 className="result-subhead">Context summary</h3>
                <dl className="mini-dl">
                  <div>
                    <dt>rules</dt>
                    <dd>{result.context_summary.rules}</dd>
                  </div>
                  <div>
                    <dt>style</dt>
                    <dd>{result.context_summary.style}</dd>
                  </div>
                  <div>
                    <dt>characters</dt>
                    <dd>{result.context_summary.characters}</dd>
                  </div>
                  <div>
                    <dt>locations</dt>
                    <dd>{result.context_summary.locations}</dd>
                  </div>
                  <div>
                    <dt>scenes</dt>
                    <dd>{result.context_summary.scenes}</dd>
                  </div>
                  <div>
                    <dt>lore</dt>
                    <dd>{result.context_summary.lore}</dd>
                  </div>
                  <div>
                    <dt>worldbuilding</dt>
                    <dd>{result.context_summary.worldbuilding}</dd>
                  </div>
                </dl>
              </>
            )}
            {result.memory_id && (
              <p>
                <Link
                  to={`/stories/${storyId}/entities/${result.memory_id}`}
                  className="inline-link"
                >
                  Open saved scene
                </Link>
              </p>
            )}
            {result.validation && (
              <>
                <h3 className="result-subhead">Validation</h3>
                <p>{result.validation.summary}</p>
                {result.validation.issues.length > 0 && (
                  <ul className="result-list">
                    {result.validation.issues.map(
                      (
                        issue: ValidationReport["issues"][number],
                        index: number,
                      ) => (
                        <li key={`${issue.rule}-${index}`}>
                          <span className="issue-severity">
                            {issue.severity}
                          </span>{" "}
                          {issue.rule}: {issue.violating_text}
                          <div className="issue-text">
                            {issue.explanation}
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </>
            )}
            {result.validation_error && (
              <p className="result-warning">Validation failed: {result.validation_error}</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
