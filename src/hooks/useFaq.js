import { useState, useEffect, useCallback } from 'react';
import { fetchFaqs } from '../api/faq';

// Simple in-memory cache
let faqCache = null;

export function useFaq() {
  const [faqs, setFaqs] = useState(faqCache || []);
  const [loading, setLoading] = useState(!faqCache);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFaqs();
      const items = Array.isArray(result) ? result : [];
      faqCache = items;
      setFaqs(items);
    } catch (err) {
      console.error('Failed to load FAQ:', err);
      setError(err.message || 'Failed to load FAQ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!faqCache) {
      load();
    }
  }, [load]);

  const refresh = useCallback(() => {
    faqCache = null;
    return load();
  }, [load]);

  return { faqs, loading, error, refresh };
}
