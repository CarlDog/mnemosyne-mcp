import { useApi } from "../hooks/useApi";
import { listStories } from "../api/client";
import Loading from "../components/Loading";
import ErrorBanner from "../components/ErrorBanner";
import StoryCard from "../components/StoryCard";
import WorkspaceShell from "../components/WorkspaceShell";

export default function StoryListPage() {
  const state = useApi(listStories, []);

  return (
    <WorkspaceShell
      active="stories"
      eyebrow="Private story archive"
      title="Story desk"
    >
      <div className="library-page">
        <header className="library-intro">
          <span className="manuscript-overline">Long-form story memory</span>
          <h1>Choose a story to open</h1>
          <p>
            Read the living canon, continue the current scene, or keep a
            reference pane open beside the manuscript.
          </p>
        </header>
        {state.status === "loading" && <Loading label="Opening the archive…" />}
        {state.status === "error" && <ErrorBanner error={state.error} />}
        {state.status === "ready" &&
          (state.data.stories.length === 0 ? (
            <div className="empty-block">
              <strong>No stories yet.</strong>
              <span>Create or import a story through Mnemosyne to begin.</span>
            </div>
          ) : (
            <div className="card-grid story-grid">
              {state.data.stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          ))}
      </div>
    </WorkspaceShell>
  );
}
