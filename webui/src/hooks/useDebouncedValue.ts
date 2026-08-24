import { useEffect, useState } from "react";

/** Returns `value`, delayed by `delayMs` after it stops changing. Used to
 * keep the roster search box from firing an API call on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
