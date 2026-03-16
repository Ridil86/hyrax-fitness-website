import { apiGet, apiPut } from './client';

export function fetchUsers({ limit, paginationToken, filter } = {}, authToken) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (paginationToken) params.set('token', paginationToken);
  if (filter) params.set('filter', filter);

  const query = params.toString();
  return apiGet(`/api/users${query ? `?${query}` : ''}`, authToken);
}

export function fetchUserGroups(username, token) {
  return apiGet(`/api/users/${encodeURIComponent(username)}/groups`, token);
}

export function updateUserGroups(username, groups, token) {
  return apiPut(
    `/api/users/${encodeURIComponent(username)}/groups`,
    { groups },
    token
  );
}
