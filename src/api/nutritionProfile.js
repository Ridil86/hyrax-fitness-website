import { apiGet, apiPut } from './client';

/**
 * Fetch the current user's nutrition profile questionnaire data.
 * @param {string} token - Cognito ID token
 */
export function fetchNutritionProfile(token) {
  return apiGet('/api/profile/nutrition', token);
}

/**
 * Save/update the current user's nutrition profile questionnaire data.
 * @param {string} token - Cognito ID token
 * @param {object} data - Nutrition profile fields
 */
export function updateNutritionProfile(token, data) {
  return apiPut('/api/profile/nutrition', data, token);
}
