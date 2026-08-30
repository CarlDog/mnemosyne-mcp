import { Link, useParams } from "react-router";
import { useApi } from "../hooks/useApi";
import { getEntity } from "../api/client";
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

export default function EntityDetailPage() {
  const { storyId, memoryId } = useParams<{
    storyId: string;
    memoryId: string;
  }>();
  const state = useApi(
    () => getEntity(storyId!, memoryId!),
    [storyId, memoryId],
  );
  const entity = state.status === "ready" ? state.data.entity : null;
  const recordName =
    entity?.name ??
    (state.status === "error" ? "Record unavailable" : "Opening record…");

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
        {entity && (
          <div className="detail-body">
            <BodyText text={entity.body} />
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
