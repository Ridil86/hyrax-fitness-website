import { apiGet } from './client';

/** Fetch aggregate billing stats (admin) */
export function fetchBillingStats(token) {
  return apiGet('/api/admin/billing/stats', token);
}

/** Fetch paginated list of subscriptions (admin) */
export function fetchSubscriptions(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiGet(`/api/admin/billing/subscriptions${qs ? `?${qs}` : ''}`, token);
}

/** Fetch paginated list of all payments (admin) */
export function fetchPayments(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiGet(`/api/admin/billing/payments${qs ? `?${qs}` : ''}`, token);
}

/** Fetch payment history for a specific user (admin) */
export function fetchUserPayments(token, userSub) {
  return apiGet(`/api/admin/billing/payments/${userSub}`, token);
}
