import { apiGet, apiPost } from './client';

/**
 * Log a consent/compliance event (public, no auth required).
 */
export function logConsentEvent(data) {
  return apiPost('/api/audit', data);
}

/**
 * Fetch paginated audit log entries (admin only).
 */
export function fetchAuditLogs({ limit, nextToken, eventType } = {}, token) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (nextToken) params.set('nextToken', nextToken);
  if (eventType) params.set('eventType', eventType);
  const query = params.toString();
  return apiGet(`/api/audit${query ? `?${query}` : ''}`, token);
}

/**
 * Fetch audit summary statistics (admin only).
 */
export function fetchAuditStats(token) {
  return apiGet('/api/audit/stats', token);
}
