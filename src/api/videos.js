import { apiGet, apiPost, apiPut, apiDelete } from './client';

/**
 * List all videos (published only for public, all for admin)
 */
export function fetchVideos(token) {
  return apiGet('/api/videos', token);
}

/**
 * Get a single video by ID
 */
export function fetchVideo(id, token) {
  return apiGet(`/api/videos/${id}`, token);
}

/**
 * Create a new video (admin only)
 */
export function createVideo(data, token) {
  return apiPost('/api/videos', data, token);
}

/**
 * Update a video (admin only)
 */
export function updateVideo(id, data, token) {
  return apiPut(`/api/videos/${id}`, data, token);
}

/**
 * Delete a video (admin only)
 */
export function deleteVideoApi(id, token) {
  return apiDelete(`/api/videos/${id}`, token);
}
