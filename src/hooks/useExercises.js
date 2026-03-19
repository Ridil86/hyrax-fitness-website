import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchExercises } from '../api/exercises';

const cache = { data: null, ts: 0 };
const CACHE_TTL = 60_000;

export function useExercises(getIdToken) {
  const [exercises, setExercises] = useState(cache.data || []);
  const [loading, setLoading] = useState(!cache.data);
  const [error, setError] = useState(null);
  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;

  const load = useCallback(async () => {
    if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
      setExercises(cache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = getIdTokenRef.current ? await getIdTokenRef.current() : undefined;
      const data = await fetchExercises(token);
      cache.data = data;
      cache.ts = Date.now();
      setExercises(data);
    } catch (err) {
      setError(err.message || 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    cache.data = null;
    cache.ts = 0;
    return load();
  }, [load]);

  return { exercises, loading, error, refresh };
}
