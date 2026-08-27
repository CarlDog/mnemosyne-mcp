import { Link } from "react-router";
import type { EntitySummary } from "../api/types";

// Tags beyond the base ["mnemosyne", "story", <type>] triplet are the
// operator's own sub-categorization (e.g. "primary" vs "npc") -- those are
// the only ones worth surfacing on a card; the base three are implied by
// the type badge already shown.
const BASE_TAGS = new Set(["mnemosyne", "story"]);

export default function EntityCard({
  entity,
  storyId,
}: {
  entity: EntitySummary;
  storyId: string;
}) {
  const extraTags = entity.tags.filter(
    (t) => !BASE_TAGS.has(t) && t !== entity.type,
  );

  return (
    <article className="card">
      <Link
        to={`/stories/${storyId}/entities/${entity.memory_id}`}
        className="card-title-link"
      >
        <div className="card-type">
          {entity.pinned && <span className="pinned-mark">★</span>}
          {entity.type}
        </div>
        <h3 className="card-name">{entity.name}</h3>
        {extraTags.length > 0 && (
          <div className="card-meta">
            {extraTags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>
      <div className="card-actions">
        <Link
          to={`/stories/${storyId}/entities/${entity.memory_id}`}
          className="card-action"
        >
          Open
        </Link>
        {entity.type === "scene" && (
          <Link to={`/stories/${storyId}/continue`} className="card-action">
            Continue
          </Link>
        )}
      </div>
    </article>
  );
}
