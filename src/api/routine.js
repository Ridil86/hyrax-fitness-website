import { apiGet, apiPost } from './client';

/**
 * Generate today's AI-powered daily workout.
 * Kicks off async generation and polls until ready.
 * @param {string} token - Cognito ID token
 * @param {(status: string) => void} [onStatusChange] - Optional callback for status updates
 * @returns {Promise<object>} The generated workout
 */
export async function generateDailyWorkout(token, onStatusChange) {
  // Kick off generation (returns 202 with { status: 'generating' })
  const initial = await apiPost('/api/routine/generate', {}, token);

  // If the workout already existed and was returned directly, return it
  if (initial.status !== 'generating') {
    return initial;
  }

  if (onStatusChange) onStatusChange('generating');

  // Poll GET /api/routine/today every 3 seconds until ready
  const MAX_POLLS = 30; // 90 seconds max
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const result = await apiGet('/api/routine/today', token);
      if (result.status === 'generating') continue;
      if (result.status === 'error') {
        throw new Error(result.error || 'Workout generation failed');
      }
      return result;
    } catch (err) {
      // 404 means not ready yet — keep polling
      if (err.status === 404) continue;
      throw err;
    }
  }

  throw new Error('Workout generation timed out. Please refresh the page to check again.');
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
