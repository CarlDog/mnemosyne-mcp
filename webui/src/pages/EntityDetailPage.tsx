import { Link, useParams } from "react-router";
import { useApi } from "../hooks/useApi";
import { getEntity } from "../api/client";
import Loading from "../components/Loading";
import ErrorBanner from "../components/ErrorBanner";
import BodyText from "../components/BodyText";

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

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          Mnemosyne
        </div>
      </header>
      <main className="content">
        <Link to={`/stories/${storyId}`} className="back-link">
          ← Back to the roster
        </Link>
        {state.status === "loading" && <Loading label="Pulling the card…" />}
        {state.status === "error" && <ErrorBanner error={state.error} />}
        {state.status === "ready" && (
          <>
            <header className="detail-header">
              <div className="detail-type">
                {state.data.entity.pinned && (
                  <span className="pinned-mark">★</span>
                )}
                {state.data.entity.type}
              </div>
              <h1 className="detail-title">{state.data.entity.name}</h1>
              <div className="detail-meta">
                <span>Recorded {formatDate(state.data.entity.created_at)}</span>
                {state.data.entity.updated_at && (
                  <span>
                    Revised {formatDate(state.data.entity.updated_at)}
                  </span>
                )}
                {state.data.entity.tags
                  .filter(
                    (t) =>
                      !["mnemosyne", "story", state.data.entity.type].includes(
                        t,
                      ),
                  )
                  .map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
              </div>
            </header>
            <div className="detail-body">
              <BodyText text={state.data.entity.body} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
