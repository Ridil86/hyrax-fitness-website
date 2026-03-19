import { apiGet, apiPost, apiPut } from './client';

// ── Tickets ──
export function fetchTickets(params, token) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.priority) qs.set('priority', params.priority);
  if (params?.category) qs.set('category', params.category);
  if (params?.assignedTo) qs.set('assignedTo', params.assignedTo);
  const query = qs.toString();
  return apiGet(`/api/support/tickets${query ? `?${query}` : ''}`, token);
}

export function fetchTicket(id, token) {
  return apiGet(`/api/support/tickets/${id}`, token);
}

export function createTicket(data, token) {
  return apiPost('/api/support/tickets', data, token);
}

export function updateTicket(id, data, token) {
  return apiPut(`/api/support/tickets/${id}`, data, token);
}

// ── Messages ──
export function addTicketMessage(ticketId, data, token) {
  return apiPost(`/api/support/tickets/${ticketId}/messages`, data, token);
}

// ── Admin ──
export function assignTicket(id, data, token) {
  return apiPut(`/api/support/admin/assign/${id}`, data, token);
}

export function fetchSupportStats(token) {
  return apiGet('/api/support/stats', token);
}
