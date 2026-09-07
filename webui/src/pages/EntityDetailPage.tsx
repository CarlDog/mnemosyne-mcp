import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useApi } from "../hooks/useApi";
import { ApiError, deleteEntity, editEntity, getEntity } from "../api/client";
import Loading from "../components/Loading";
import ErrorBanner from "../components/ErrorBanner";
import BodyText from "../components/BodyText";
import WorkspaceShell from "../components/WorkspaceShell";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Shown when a PATCH is refused for matching instruction-shaped text
 * (src/injection-scan.ts on the server). Quotes every matched excerpt
 * verbatim -- never paraphrased -- so the reviewer can judge a false
 * positive without re-reading the whole body, then offers the one
 * explicit resubmit that carries override_flagged_content. */
function FlaggedContentBanner({
  error,
  onOverride,
  overriding,
}: {
  error: ApiError;
  onOverride: () => void;
  overriding: boolean;
}) {
  const signals = error.body?.signals ?? [];
  return (
    <div className="run-error is-uncertain" role="alert">
      <strong>Content flagged</strong>
      <p>{error.body?.message ?? error.message}</p>
      {signals.length > 0 && (
        <details className="inline-disclosure" open>
          <summary>Matched text</summary>
          <ul className="result-list">
            {signals.map((signal, index) => (
              <li key={`${signal.label}-${index}`}>
                <span className="issue-severity">{signal.label}</span>
                <blockquote>{signal.excerpt}</blockquote>
              </li>
            ))}
          </ul>
        </details>
      )}
      <button
        type="button"
        className="composer-send"
        onClick={onOverride}
        disabled={overriding}
      >
        {overriding ? "Saving…" : "Save anyway"}
      </button>
    </div>
  );
}

export default function EntityDetailPage() {
  const { storyId, memoryId } = useParams<{
    storyId: string;
    memoryId: string;
  }>();
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const state = useApi(
    () => getEntity(storyId!, memoryId!),
    [storyId, memoryId, revision],
  );
  const entity = state.status === "ready" ? state.data.entity : null;
  const recordName =
    entity?.name ??
    (state.status === "error" ? "Record unavailable" : "Opening record…");

  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [editPinned, setEditPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<Error | null>(null);

  // A different record loaded (navigated to a new entity) -- close out any
  // in-progress edit/delete state from the previous one rather than
  // silently carrying it over.
  useEffect(() => {
    setIsEditing(false);
    setSaveError(null);
    setConfirmingDelete(false);
    setDeleteError(null);
  }, [storyId, memoryId]);

  function startEditing() {
    if (!entity) return;
    setEditBody(entity.body);
    setEditPinned(entity.pinned);
    setSaveError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setSaveError(null);
  }

  async function submitEdit(overrideFlaggedContent: boolean) {
    if (!storyId || !memoryId || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await editEntity(storyId, memoryId, {
        body: editBody,
        pinned: editPinned,
        ...(overrideFlaggedContent && { override_flagged_content: true }),
      });
      setIsEditing(false);
      setRevision((current) => current + 1);
    } catch (err) {
      setSaveError(err instanceof Error ? err : new Error("Save failed"));
    } finally {
      setSaving(false);
    }
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitEdit(false);
  }

  async function confirmDelete() {
    if (!storyId || !memoryId || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEntity(storyId, memoryId);
      navigate(`/stories/${storyId}`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err : new Error("Delete failed"));
      setDeleting(false);
    }
  }

  const flaggedError =
    saveError instanceof ApiError && saveError.body?.error === "flagged_content"
      ? saveError
      : null;

  return (
    <WorkspaceShell
      storyId={storyId}
      active="library"
      eyebrow="Canon record"
      title={recordName}
      headerActions={
        <div className="workspace-quick-actions">
          <Link to={`/stories/${storyId}`} className="crumb-link">
            ← Back to library
          </Link>
          <Link to={`/stories/${storyId}/continue`} className="crumb-link">
            Continue scene →
          </Link>
          {entity && !isEditing && (
            <button type="button" className="crumb-link" onClick={startEditing}>
              Edit
            </button>
          )}
        </div>
      }
    >
      <div className="detail-page">
        <header className="detail-header">
          {entity && (
            <div className="detail-type">
              {entity.pinned && (
                <>
                  <span className="pinned-mark" aria-hidden="true">
                    ★
                  </span>
                  <span className="sr-only">Pinned </span>
                </>
              )}
              {entity.type}
            </div>
          )}
          <h1 className="detail-title">{recordName}</h1>
          {entity && (
            <div className="detail-meta">
              <span>Recorded {formatDate(entity.created_at)}</span>
              {entity.updated_at && (
                <span>Revised {formatDate(entity.updated_at)}</span>
              )}
              {entity.tags
                .filter(
                  (tag) => !["mnemosyne", "story", entity.type].includes(tag),
                )
                .map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
            </div>
          )}
        </header>
        {state.status === "loading" && <Loading label="Pulling the card…" />}
        {state.status === "error" && <ErrorBanner error={state.error} />}

        {entity && isEditing && (
          <form
            className="detail-edit-form"
            onSubmit={onFormSubmit}
            aria-busy={saving}
          >
            <label className="field-label" htmlFor="edit-body">
              Body
            </label>
            <textarea
              id="edit-body"
              className="composer-textarea"
              rows={12}
              value={editBody}
              onChange={(event) => setEditBody(event.target.value)}
              required
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editPinned}
                onChange={(event) => setEditPinned(event.target.checked)}
              />
              Pinned
            </label>
            <div className="detail-edit-actions">
              <button type="submit" className="composer-send" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="crumb-link"
                onClick={cancelEditing}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
            {saveError && !flaggedError && <ErrorBanner error={saveError} />}
            {flaggedError && (
              <FlaggedContentBanner
                error={flaggedError}
                overriding={saving}
                onOverride={() => void submitEdit(true)}
              />
            )}
          </form>
        )}

        {entity && !isEditing && (
          <div className="detail-body">
            <BodyText text={entity.body} />
          </div>
        )}

        {entity && !isEditing && (
          <footer className="detail-footer">
            {!confirmingDelete ? (
              <button
                type="button"
                className="detail-delete-trigger"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete entity
              </button>
            ) : (
              <div className="detail-delete-confirm" role="alert">
                <p>Delete “{entity.name}”? This cannot be undone.</p>
                <button
                  type="button"
                  className="detail-delete-confirm-yes"
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  className="crumb-link"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
              </div>
            )}
            {deleteError && <ErrorBanner error={deleteError} />}
          </footer>
        )}
      </div>
    </WorkspaceShell>
  );
}
