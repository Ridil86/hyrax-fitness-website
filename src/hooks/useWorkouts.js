import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWorkouts } from '../api/workouts';

const cache = { data: null, ts: 0 };
const CACHE_TTL = 60_000; // 1 minute

/**
 * Fetch workout library with in-memory cache.
 * Pass a token for admin to see draft items.
 */
export function useWorkouts(token) {
  const [workouts, setWorkouts] = useState(cache.data || []);
  const [loading, setLoading] = useState(!cache.data);
  const [error, setError] = useState(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const load = useCallback(async () => {
    // Use cache if fresh
    if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
      setWorkouts(cache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkouts(tokenRef.current);
      cache.data = data;
      cache.ts = Date.now();
      setWorkouts(data);
    } catch (err) {
      setError(err.message || 'Failed to load workouts');
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

  return { workouts, loading, error, refresh };
}
