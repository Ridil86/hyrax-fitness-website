import { apiGet, apiPut } from './client';

export function fetchContent(section) {
  return apiGet(`/api/content/${section}`);
}

export function updateContent(section, data, token) {
  return apiPut(`/api/content/${section}`, { data }, token);
}
