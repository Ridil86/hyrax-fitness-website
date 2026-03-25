const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TRIAL_TIER = 'Iron Dassie';

/** Check if user's free trial is still active */
export function isTrialActive(profile: any): boolean {
  if (!profile?.trialEndsAt) return false;
  return new Date(profile.trialEndsAt).getTime() > Date.now();
}

/** Get effective tier considering active trial. During trial, always Iron Dassie. */
export function getEffectiveTier(profile: any): string {
  if (isTrialActive(profile)) return TRIAL_TIER;
  return profile?.tier || 'Pup';
}

/** Build trial timestamp fields for new profile creation */
export function buildTrialFields(): { trialStartedAt: string; trialEndsAt: string } {
  const now = new Date();
  return {
    trialStartedAt: now.toISOString(),
    trialEndsAt: new Date(now.getTime() + TRIAL_DURATION_MS).toISOString(),
  };
}
