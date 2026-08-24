import { ApiError } from "../api/client";

export default function ErrorBanner({ error }: { error: Error }) {
  const message =
    error instanceof ApiError
      ? (error.body?.message ?? error.message)
      : error.message;
  return (
    <div className="state-block error">
      Couldn't reach the archive — {message}
    </div>
  );
}
