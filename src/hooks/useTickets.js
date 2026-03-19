import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTickets } from '../api/support';

const cache = { data: null, ts: 0, params: null };
const CACHE_TTL = 20_000; // 20 seconds

export function useTickets(getIdToken, params = {}) {
  const [tickets, setTickets] = useState(cache.data || []);
  const [loading, setLoading] = useState(!cache.data);
  const [error, setError] = useState(null);

  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const load = useCallback(async () => {
    const paramsKey = JSON.stringify(paramsRef.current);
    if (cache.data && cache.params === paramsKey && Date.now() - cache.ts < CACHE_TTL) {
      setTickets(cache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = getIdTokenRef.current ? await getIdTokenRef.current() : undefined;
      const data = await fetchTickets(paramsRef.current, token);
      cache.data = data;
      cache.ts = Date.now();
      cache.params = paramsKey;
      setTickets(data);
    } catch (err) {
      setError(err.message || 'Failed to load tickets');
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

  return { tickets, loading, error, refresh };
}
