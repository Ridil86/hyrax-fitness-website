import { useState, useEffect, useCallback } from 'react';
import { fetchContent } from '../api/content';

// Simple in-memory cache for content sections
const cache = {};

export function useContent(section) {
  const [data, setData] = useState(cache[section]?.data || null);
  const [loading, setLoading] = useState(!cache[section]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchContent(section);
      const content = result.data || result;
      cache[section] = { data: content };
      setData(content);
    } catch (err) {
      console.error(`Failed to load content: ${section}`, err);
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    if (!cache[section]) {
      load();
    }
  }, [section, load]);

  const refresh = useCallback(() => {
    delete cache[section];
    return load();
  }, [section, load]);

  return { data, loading, error, refresh };
}
