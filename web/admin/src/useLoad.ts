import { useCallback, useEffect, useState } from 'react';

/** Loads data on mount and whenever deps change; reload() fetches again. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .then(result => {
        if (!alive) return;
        setData(result);
        setError(null);
      })
      .catch(e => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { data, error, loading, reload };
}
