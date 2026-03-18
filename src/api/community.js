import { apiGet, apiPost, apiPut, apiDelete } from './client';

// ── Threads ──
export function fetchThreads(params, token) {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.search) qs.set('search', params.search);
  const query = qs.toString();
  return apiGet(`/api/community/threads${query ? `?${query}` : ''}`, token);
}

export function fetchThread(id, token) {
  return apiGet(`/api/community/threads/${id}`, token);
}

export function createThread(data, token) {
  return apiPost('/api/community/threads', data, token);
}

export function updateThread(id, data, token) {
  return apiPut(`/api/community/threads/${id}`, data, token);
}

export function deleteThreadApi(id, token) {
  return apiDelete(`/api/community/threads/${id}`, token);
}

// ── Replies ──
export function createReply(threadId, data, token) {
  return apiPost(`/api/community/threads/${threadId}/replies`, data, token);
}

export function updateReply(id, data, token) {
  return apiPut(`/api/community/replies/${id}`, data, token);
}

export function deleteReplyApi(id, threadId, token) {
  return apiDelete(`/api/community/replies/${id}?threadId=${threadId}`, token);
}

// ── Reactions ──
export function toggleReaction(data, token) {
  return apiPost('/api/community/reactions', data, token);
}

// ── Reports ──
export function createReport(data, token) {
  return apiPost('/api/community/reports', data, token);
}

// ── Admin ──
export function fetchAdminQueue(token) {
  return apiGet('/api/community/admin/queue', token);
}

export function moderateThread(id, data, token) {
  return apiPut(`/api/community/admin/moderate/${id}`, data, token);
}

export function resolveReport(id, data, token) {
  return apiPut(`/api/community/admin/reports/${id}`, data, token);
}

export function togglePin(id, token) {
  return apiPut(`/api/community/admin/pin/${id}`, {}, token);
}

export function fetchCommunityStats(token) {
  return apiGet('/api/community/stats', token);
}
