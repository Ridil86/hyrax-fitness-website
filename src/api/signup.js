import { apiPost } from './client';

/**
 * Create a new user account via the intake wizard (public, no auth).
 * @param {{ givenName: string, familyName: string, email: string, termsAccepted: boolean, privacyAccepted: boolean }} data
 */
export function createAccount(data) {
  return apiPost('/api/signup', data);
}
