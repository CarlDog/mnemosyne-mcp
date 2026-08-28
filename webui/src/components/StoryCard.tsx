import { Link } from "react-router";
import type { StorySummary } from "../api/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function StoryCard({ story }: { story: StorySummary }) {
  const bound = story.kindroid_kin
    ? "Kindroid AI"
    : story.kindroid_group_id
      ? "Kindroid group"
      : null;

  return (
    <article className="card story-card">
      <Link
        to={`/stories/${story.id}`}
        className="story-card-main card-title-link"
      >
        <div className="card-type">Story</div>
        <h2 className="card-name">{story.name}</h2>
        <div className="card-meta">
          <span>Opened {formatDate(story.created_at)}</span>
          {bound && <span className="tag">{bound} bound</span>}
        </div>
      </Link>
      <div className="story-card-actions">
        <Link to={`/stories/${story.id}`} className="story-card-action">
          Open roster
        </Link>
        <Link
          to={`/stories/${story.id}/continue`}
          className="story-card-action"
        >
          Continue
        </Link>
      </div>
    </article>
  );
}
