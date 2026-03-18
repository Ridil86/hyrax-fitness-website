import { apiGet, apiPut } from './client';

/** Fetch all tiers (public) */
export function fetchTiers() {
  return apiGet('/api/tiers');
}

/** Update a tier (admin only) */
export function updateTier(token, id, data) {
  return apiPut(`/api/tiers/${id}`, data, token);
}

/** Update comparison features (admin only) */
export function updateComparisonFeatures(token, comparisonFeatures) {
  return apiPut('/api/tiers/comparison', { comparisonFeatures }, token);
}
