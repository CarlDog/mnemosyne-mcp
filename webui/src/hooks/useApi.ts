import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

export type ApiState<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiError | Error }
  | { status: "ready"; data: T };

/**
 * Runs `fetchFn` whenever `deps` changes, exposing a loading/error/ready
 * triad. Guards against a stale response landing after a newer request
 * already started (e.g. a fast search keystroke) by ignoring any resolve
 * that isn't from the most recent call.
 */
export function useApi<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList,
): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ status: "loading" });
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    setState({ status: "loading" });
    fetchFn().then(
      (data) => {
        if (requestId.current === id) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (requestId.current === id) {
          setState({
            status: "error",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export { ApiError };
