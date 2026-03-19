import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchUserLogs, fetchLogStats } from '../api/completionLog';

const cache = { data: null, stats: null, ts: 0 };
const CACHE_TTL = 30_000; // 30 seconds (shorter than other hooks since this changes often)

export function useCompletionLogs(getIdToken, params) {
  const [logs, setLogs] = useState(cache.data || []);
  const [stats, setStats] = useState(cache.stats || null);
  const [loading, setLoading] = useState(!cache.data);
  const [error, setError] = useState(null);
  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const load = useCallback(async () => {
    if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
      setLogs(cache.data);
      setStats(cache.stats);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = getIdTokenRef.current ? await getIdTokenRef.current() : undefined;
      const [logsData, statsData] = await Promise.allSettled([
        fetchUserLogs(paramsRef.current, token),
        fetchLogStats(token),
      ]);

      const resolvedLogs = logsData.status === 'fulfilled' ? logsData.value : [];
      const resolvedStats = statsData.status === 'fulfilled' ? statsData.value : null;

      cache.data = resolvedLogs;
      cache.stats = resolvedStats;
      cache.ts = Date.now();
      setLogs(resolvedLogs);
      setStats(resolvedStats);
    } catch (err) {
      setError(err.message || 'Failed to load completion logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    cache.data = null;
    cache.stats = null;
    cache.ts = 0;
    return load();
  }, [load]);

  return { logs, stats, loading, error, refresh };
}
