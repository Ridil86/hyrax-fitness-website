const TIER_RANK = { 'Pup': 1, 'Rock Runner': 2, 'Iron Dassie': 3 };

export const TIERS = [
  { value: 'Pup', label: 'Pup', price: 'Free' },
  { value: 'Rock Runner', label: 'Rock Runner', price: '$5/mo' },
  { value: 'Iron Dassie', label: 'Iron Dassie', price: '$20/mo' },
];

/** Returns tier rank number (1, 2, or 3). Defaults to 1. */
export function tierRank(tier) {
  return TIER_RANK[tier] || 1;
}

/** Check if userTier meets the requiredTier */
export function hasTierAccess(userTier, requiredTier) {
  return tierRank(userTier) >= tierRank(requiredTier || 'Pup');
}

/** Get tier info object for the given tier name */
export function getRequiredTierInfo(requiredTier) {
  return TIERS.find((t) => t.value === requiredTier) || TIERS[0];
}

const TRIAL_TIER = 'Iron Dassie';

/** Check if user's free trial is still active */
export function isTrialActive(profile) {
  if (!profile?.trialEndsAt) return false;
  return new Date(profile.trialEndsAt).getTime() > Date.now();
}

/** Get effective tier considering active trial. During trial, always Iron Dassie. */
export function getEffectiveTier(profile) {
  if (isTrialActive(profile)) return TRIAL_TIER;
  return profile?.tier || 'Pup';
}

/** Get remaining trial days (0 if expired or no trial) */
export function trialDaysRemaining(profile) {
  if (!profile?.trialEndsAt) return 0;
  const ms = new Date(profile.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
