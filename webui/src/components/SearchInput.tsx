export default function SearchInput({
  value,
  onChange,
  placeholder = "Search names and prose…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-field">
      <span className="glyph" aria-hidden="true">
        ⌕
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search entities"
      />
    </div>
  );
}
