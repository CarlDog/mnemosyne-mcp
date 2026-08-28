export default function Loading({
  label = "Reading the archive…",
}: {
  label?: string;
}) {
  // role="status" announces politely -- a load finishing should not interrupt
  // whatever the user is reading.
  return (
    <div className="state-block" role="status">
      {label}
    </div>
  );
}
