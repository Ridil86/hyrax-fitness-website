import { apiGet } from './client';

/**
 * Fetch the current user's profile from DynamoDB (authenticated).
 * @param {string} token - Cognito ID token
 */
export function fetchProfile(token) {
  return apiGet('/api/profile', token);
}
