import { apiGet, apiPost, apiDelete } from './client';

/**
 * Log a single meal (planned or ad-hoc).
 */
export function createMealLog(data, token) {
  return apiPost('/api/meal-logs', data, token);
}

/**
 * Batch log multiple meals from a plan.
 */
export function createMealPlanLog(data, token) {
  return apiPost('/api/meal-logs/plan', data, token);
}

/**
 * Fetch meal logs, optionally filtered by date.
 * @param {object} params - { date?, from?, to?, limit? }
 */
export function fetchMealLogs(params, token) {
  const qs = new URLSearchParams();
  if (params.date) qs.set('date', params.date);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiGet(`/api/meal-logs${query ? '?' + query : ''}`, token);
}

/**
 * Get aggregated meal log stats (today, month, streak).
 */
export function fetchMealLogStats(token) {
  return apiGet('/api/meal-logs/stats', token);
}

/**
 * Delete a meal log entry.
 */
export function deleteMealLog(id, token) {
  return apiDelete(`/api/meal-logs/${id}`, token);
}
