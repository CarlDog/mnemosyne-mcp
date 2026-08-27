import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useApi } from "../hooks/useApi";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { getStory, listEntities } from "../api/client";
import type { EntityType } from "../api/types";
import Loading from "../components/Loading";
import ErrorBanner from "../components/ErrorBanner";
import EntityCard from "../components/EntityCard";
import EntityTypeFilter from "../components/EntityTypeFilter";
import SearchInput from "../components/SearchInput";

export default function EntityRosterPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const [type, setType] = useState<EntityType | undefined>(undefined);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  const storyState = useApi(() => getStory(storyId!), [storyId]);

  // Unfiltered, fetched once per story -- purely to compute the rail's
  // per-type counts. Cheap: the roster route already strips body, and the
  // largest current story is well under 200 entities.
  const allState = useApi(() => listEntities(storyId!, {}), [storyId]);

  const filteredState = useApi(
    () => listEntities(storyId!, { type, q: debouncedQuery || undefined }),
    [storyId, type, debouncedQuery],
  );

  const counts = useMemo(() => {
    if (allState.status !== "ready") return {};
    const out: Record<string, number> = {};
    for (const e of allState.data.entities) {
      out[e.type] = (out[e.type] ?? 0) + 1;
    }
    return out;
  }, [allState]);

  const storyName =
    storyState.status === "ready" ? storyState.data.story.name : "…";

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
          <span>{storyName}</span>
          <span className="crumb-sep">/</span>
          <Link to={`/stories/${storyId}/continue`} className="crumb-link">
            Continue
          </Link>
        </nav>
      </header>
      <main className="content">
        {storyState.status === "error" && (
          <ErrorBanner error={storyState.error} />
        )}
        <div className="roster-layout">
          <EntityTypeFilter active={type} counts={counts} onSelect={setType} />
          <div>
            <SearchInput value={query} onChange={setQuery} />
            {filteredState.status === "loading" && (
              <Loading label="Searching the shelves…" />
            )}
            {filteredState.status === "error" && (
              <ErrorBanner error={filteredState.error} />
            )}
            {filteredState.status === "ready" &&
              (filteredState.data.entities.length === 0 ? (
                <div className="empty-block">Nothing matches.</div>
              ) : (
                <div className="card-grid">
                  {filteredState.data.entities.map((entity) => (
                    <EntityCard
                      key={entity.memory_id}
                      entity={entity}
                      storyId={storyId!}
                    />
                  ))}
                </div>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
