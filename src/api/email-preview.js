import { apiGet, apiPost } from './client';

export function fetchEmailPreview(type, token) {
  return apiGet(`/api/admin/email-preview?type=${encodeURIComponent(type)}`, token);
}

export function sendTestEmail(type, recipientEmail, token) {
  return apiPost('/api/admin/email-preview', { type, recipientEmail }, token);
}
