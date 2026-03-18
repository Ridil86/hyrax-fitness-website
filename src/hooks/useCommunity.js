import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchThreads } from '../api/community';

const cache = { data: null, ts: 0, params: null };
const CACHE_TTL = 30_000; // 30 seconds (community content changes more frequently)

export function useCommunity(getIdToken, params = {}) {
  const [threads, setThreads] = useState(cache.data || []);
  const [loading, setLoading] = useState(!cache.data);
  const [error, setError] = useState(null);

  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const load = useCallback(async () => {
    const paramsKey = JSON.stringify(paramsRef.current);
    if (cache.data && cache.params === paramsKey && Date.now() - cache.ts < CACHE_TTL) {
      setThreads(cache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = getIdTokenRef.current ? await getIdTokenRef.current() : undefined;
      const data = await fetchThreads(paramsRef.current, token);
      cache.data = data;
      cache.ts = Date.now();
      cache.params = paramsKey;
      setThreads(data);
    } catch (err) {
      setError(err.message || 'Failed to load community threads');
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
    cache.params = null;
    return load();
  }, [load]);

  return { threads, loading, error, refresh };
}
