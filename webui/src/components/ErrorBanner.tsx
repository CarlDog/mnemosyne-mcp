import { ApiError } from "../api/client";

export default function ErrorBanner({ error }: { error: Error }) {
  const message =
    error instanceof ApiError
      ? (error.body?.message ?? error.message)
      : error.message;
  return (
    // role="alert" interrupts: a failed action is worth interrupting for.
    <div className="state-block error" role="alert">
      Couldn't reach the archive — {message}
    </div>
  );
}
