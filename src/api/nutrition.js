import { apiGet, apiPost } from './client';

/** Get the user's local date as YYYY-MM-DD */
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Generate today's AI-powered daily nutrition plan.
 * Kicks off async generation and polls until ready.
 * @param {string} token - Cognito ID token
 * @param {(status: string) => void} [onStatusChange] - Optional callback for status updates
 * @returns {Promise<object>} The generated nutrition plan
 */
export async function generateDailyNutrition(token, onStatusChange) {
  const today = localDate();
  const initial = await apiPost('/api/nutrition/generate', { clientDate: today }, token);

  if (initial.status !== 'generating') {
    return initial;
  }

  if (onStatusChange) onStatusChange('generating');

  // Poll GET /api/nutrition/today every 3 seconds until ready
  const MAX_POLLS = 30; // 90 seconds max
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const result = await apiGet(`/api/nutrition/today?date=${today}`, token);
      if (result.status === 'generating') continue;
      if (result.status === 'error') {
        throw new Error(result.error || 'Nutrition plan generation failed');
      }
      return result;
    } catch (err) {
      if (err.status === 404) continue;
      throw err;
    }
  }

  throw new Error('Nutrition plan generation timed out. Please refresh the page to check again.');
}

/**
 * Fetch today's generated nutrition plan (if any).
 * @param {string} token - Cognito ID token
 */
export function fetchTodayNutrition(token) {
  return apiGet(`/api/nutrition/today?date=${localDate()}`, token);
}

/**
 * Fetch past daily nutrition plan history.
 * @param {string} token - Cognito ID token
 */
export function fetchNutritionHistory(token) {
  return apiGet('/api/nutrition/history', token);
}

/**
 * Fetch a specific date's nutrition plan.
 * @param {string} token - Cognito ID token
 * @param {string} date - YYYY-MM-DD format
 */
export function fetchNutritionByDate(token, date) {
  return apiGet(`/api/nutrition/${date}`, token);
}

/**
 * Preview the nutrition prompts (admin only).
 * @param {string} token - Cognito ID token
 */
export function previewNutritionPrompts(token) {
  return apiPost('/api/nutrition/preview', {}, token);
}
