import { useApi } from "../hooks/useApi";
import { listStories } from "../api/client";
import Loading from "../components/Loading";
import ErrorBanner from "../components/ErrorBanner";
import StoryCard from "../components/StoryCard";

export default function StoryListPage() {
  const state = useApi(listStories, []);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          Mnemosyne
        </div>
      </header>
      <main className="content">
        {state.status === "loading" && <Loading label="Opening the archive…" />}
        {state.status === "error" && <ErrorBanner error={state.error} />}
        {state.status === "ready" &&
          (state.data.stories.length === 0 ? (
            <div className="empty-block">No stories yet.</div>
          ) : (
            <div className="card-grid">
              {state.data.stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          ))}
      </main>
    </div>
  );
}
