import { apiGet, apiPut } from './client';

/**
 * Fetch the current user's fitness profile questionnaire data.
 * @param {string} token - Cognito ID token
 */
export function fetchFitnessProfile(token) {
  return apiGet('/api/profile/fitness', token);
}

/**
 * Save/update the current user's fitness profile questionnaire data.
 * @param {string} token - Cognito ID token
 * @param {object} data - Fitness profile fields
 */
export function updateFitnessProfile(token, data) {
  return apiPut('/api/profile/fitness', data, token);
}
