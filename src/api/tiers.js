import { apiGet, apiPut } from './client';

/** Fetch all tiers (public) */
export function fetchTiers() {
  return apiGet('/api/tiers');
}

/** Update a tier (admin only) */
export function updateTier(token, id, data) {
  return apiPut(`/api/tiers/${id}`, data, token);
}
