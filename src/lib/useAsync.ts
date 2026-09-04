import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
}

/**
 * Načte data z funkce a hlídá, že odpověď z předchozího (už neplatného)
 * dotazu nepřepíše ten aktuální.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);
  const runId = useRef(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const id = ++runId.current;
    setLoading(true);
    setError(undefined);
    fn()
      .then((result) => {
        if (id === runId.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (id === runId.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  return { data, error, loading, reload };
}

/** Odloží změnu hodnoty — používá se u našeptávačů, ať se neposílá dotaz na každé písmeno. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
