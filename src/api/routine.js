import { apiGet, apiPost } from './client';

/**
 * Generate today's AI-powered daily workout.
 * Returns the generated workout, or the existing one if already generated today.
 * @param {string} token - Cognito ID token
 */
export function generateDailyWorkout(token) {
  return apiPost('/api/routine/generate', {}, token);
}

/**
 * Swap today's workout for a different one.
 * @param {string} token - Cognito ID token
 * @param {{ avoidFocus?: string[], preferFocus?: string[] }} options
 */
export function swapDailyWorkout(token, options = {}) {
  return apiPost('/api/routine/swap', options, token);
}

/**
 * Preview the prompts that would be sent to Bedrock (admin-only debug).
 * @param {string} token - Cognito ID token
 */
export function previewRoutinePrompts(token) {
  return apiPost('/api/routine/preview', {}, token);
}

/**
 * Fetch today's generated workout (if any).
 * @param {string} token - Cognito ID token
 */
export function fetchTodayWorkout(token) {
  return apiGet('/api/routine/today', token);
}

/**
 * Fetch past daily workout history.
 * @param {string} token - Cognito ID token
 */
export function fetchWorkoutHistory(token) {
  return apiGet('/api/routine/history', token);
}

/**
 * Fetch a specific date's workout.
 * @param {string} token - Cognito ID token
 * @param {string} date - YYYY-MM-DD format
 */
export function fetchWorkoutByDate(token, date) {
  return apiGet(`/api/routine/${date}`, token);
}
