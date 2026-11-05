import { useCallback, useEffect, useRef, useState } from "react";

/** After `start()`, `cooling` is true for `ms`: keeps a button from being hammered. */
export function useCooldown(ms: number) {
  const [cooling, setCooling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const start = useCallback(() => {
    setCooling(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCooling(false), ms);
  }, [ms]);
  return { cooling, start };
}
