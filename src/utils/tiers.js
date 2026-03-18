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
