import { apiGet, apiPost } from './client';

/** Fetch all tiers (public, no auth needed) */
export function fetchTiers() {
  return apiGet('/api/tiers');
}

/** Fetch current user's subscription */
export function fetchSubscription(token) {
  return apiGet('/api/stripe/subscription', token);
}

/** Create a Stripe Checkout session for a tier */
export function createCheckoutSession(token, tierId) {
  return apiPost('/api/stripe/create-checkout-session', { tierId }, token);
}

/** Create a Stripe Customer Portal session */
export function createPortalSession(token) {
  return apiPost('/api/stripe/create-portal-session', {}, token);
}

/** Cancel the current subscription at period end */
export function cancelSubscription(token) {
  return apiPost('/api/stripe/cancel-subscription', {}, token);
}

/** Get Stripe publishable key */
export function fetchStripeConfig() {
  return apiGet('/api/stripe/config');
}
