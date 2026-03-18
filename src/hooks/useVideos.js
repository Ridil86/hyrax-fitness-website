import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchVideos } from '../api/videos';

const cache = { data: null, ts: 0 };
const CACHE_TTL = 60_000; // 1 minute

/**
 * Fetch video library with in-memory cache.
 * Pass getIdToken (async function) to authenticate requests.
 */
export function useVideos(getIdToken) {
  const [videos, setVideos] = useState(cache.data || []);
  const [loading, setLoading] = useState(!cache.data);
  const [error, setError] = useState(null);
  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;

  const load = useCallback(async () => {
    // Use cache if fresh
    if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
      setVideos(cache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = getIdTokenRef.current ? await getIdTokenRef.current() : undefined;
      const data = await fetchVideos(token);
      cache.data = data;
      cache.ts = Date.now();
      setVideos(data);
    } catch (err) {
      setError(err.message || 'Failed to load videos');
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

  return { videos, loading, error, refresh };
}
