import { useState, useEffect, useCallback } from 'react';
import { fetchTiers } from '../api/subscription';
import { TIERS as FALLBACK_TIERS } from '../utils/tiers';

// Simple in-memory cache
let tiersCache = null;
let comparisonCache = null;

export function useTiers() {
  const [tiers, setTiers] = useState(tiersCache || []);
  const [comparisonFeatures, setComparisonFeatures] = useState(comparisonCache || []);
  const [loading, setLoading] = useState(!tiersCache);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTiers();
      // Handle both new shape { tiers, comparisonFeatures } and legacy flat array
      const items = Array.isArray(result) ? result : result.tiers || result.Items || [];
      const comparison = Array.isArray(result) ? [] : result.comparisonFeatures || [];
      tiersCache = items;
      comparisonCache = comparison;
      setTiers(items);
      setComparisonFeatures(comparison);
    } catch (err) {
      console.error('Failed to load tiers:', err);
      setError(err.message || 'Failed to load tiers');
      // Fall back to hardcoded tiers if cache is empty
      if (!tiersCache) {
        setTiers(
          FALLBACK_TIERS.map((t, i) => ({
            id: String(i + 1),
            name: t.value,
            level: i + 1,
            price: t.price,
            priceInCents: t.price === 'Free' ? 0 : parseInt(t.price.replace(/\D/g, '')) * 100,
            features: [],
            sortOrder: i + 1,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tiersCache) {
      load();
    }
  }, [load]);

  const refresh = useCallback(() => {
    tiersCache = null;
    comparisonCache = null;
    return load();
  }, [load]);

  return { tiers, comparisonFeatures, loading, error, refresh };
}
