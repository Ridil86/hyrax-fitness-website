import { apiGet, apiPost, apiPut, apiDelete } from './client';

export function fetchFaqs() {
  return apiGet('/api/faq');
}

export function createFaq(data, token) {
  return apiPost('/api/faq', data, token);
}

export function updateFaq(id, data, token) {
  return apiPut(`/api/faq/${id}`, data, token);
}

export function deleteFaq(id, token) {
  return apiDelete(`/api/faq/${id}`, token);
}

export function reorderFaqs(items, token) {
  return apiPut('/api/faq/reorder', { items }, token);
}
