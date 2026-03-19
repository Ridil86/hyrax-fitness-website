import { apiGet } from './client';

export function fetchAnalyticsOverview(token) {
  return apiGet('/api/admin/analytics/overview', token);
}

export function fetchAnalyticsTrends(token) {
  return apiGet('/api/admin/analytics/trends', token);
}
