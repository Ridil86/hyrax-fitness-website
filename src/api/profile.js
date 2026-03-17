import { apiGet, apiPost } from './client';

/**
 * Fetch the current user's profile from DynamoDB (authenticated).
 * @param {string} token - Cognito ID token
 */
export function fetchProfile(token) {
  return apiGet('/api/profile', token);
}

/**
 * Create a profile for a Google-authenticated user (authenticated).
 * Called after the user accepts Terms of Use and Privacy Policy.
 * @param {string} token - Cognito ID token
 * @param {{ termsAccepted: boolean, privacyAccepted: boolean }} data
 */
export function createProfile(token, data) {
  return apiPost('/api/profile', data, token);
}
