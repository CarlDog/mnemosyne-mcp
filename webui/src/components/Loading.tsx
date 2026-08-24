export default function Loading({
  label = "Reading the archive…",
}: {
  label?: string;
}) {
  return <div className="state-block">{label}</div>;
}
