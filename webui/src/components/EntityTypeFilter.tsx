import { ENTITY_TYPES, type EntityType } from "../api/types";

export default function EntityTypeFilter({
  active,
  counts,
  onSelect,
}: {
  active: EntityType | undefined;
  counts: Record<string, number>;
  onSelect: (type: EntityType | undefined) => void;
}) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <nav className="rail" aria-label="Filter by entity type">
      <div className="rail-label">The Roster</div>
      <button
        type="button"
        className={`rail-tab${active === undefined ? " active" : ""}`}
        onClick={() => onSelect(undefined)}
      >
        All <span className="rail-count">{total}</span>
      </button>
      {ENTITY_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={`rail-tab${active === type ? " active" : ""}`}
          onClick={() => onSelect(type)}
        >
          {type} <span className="rail-count">{counts[type] ?? 0}</span>
        </button>
      ))}
    </nav>
  );
}
