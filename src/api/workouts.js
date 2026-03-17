import { apiGet, apiPost, apiPut, apiDelete } from './client';

/**
 * List all workouts (published only for public, all for admin)
 */
export function fetchWorkouts(token) {
  return apiGet('/api/workouts', token);
}

/**
 * Get a single workout by ID
 */
export function fetchWorkout(id, token) {
  return apiGet(`/api/workouts/${id}`, token);
}

/**
 * Create a new workout (admin only)
 */
export function createWorkout(data, token) {
  return apiPost('/api/workouts', data, token);
}

/**
 * Update a workout (admin only)
 */
export function updateWorkout(id, data, token) {
  return apiPut(`/api/workouts/${id}`, data, token);
}

/**
 * Delete a workout (admin only)
 */
export function deleteWorkoutApi(id, token) {
  return apiDelete(`/api/workouts/${id}`, token);
}
