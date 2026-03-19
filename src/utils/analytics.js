/**
 * GA4 Analytics utility
 * Wraps gtag() calls with typed event helpers.
 * Events only fire if GA4 is loaded (VITE_GA4_MEASUREMENT_ID is set).
 */

function gtag() {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...arguments);
  }
}

// ── Core ──

export function trackPageView(path, title) {
  gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
  });
}

export function trackEvent(name, params = {}) {
  gtag('event', name, params);
}

// ── Video Events ──

export function trackVideoStart(videoId, videoTitle, category) {
  trackEvent('video_start', { video_id: videoId, video_title: videoTitle, category });
}

export function trackVideoProgress(videoId, percent) {
  trackEvent('video_progress', { video_id: videoId, percent });
}

export function trackVideoComplete(videoId, durationWatched, totalDuration) {
  trackEvent('video_complete', {
    video_id: videoId,
    duration_watched: durationWatched,
    total_duration: totalDuration,
  });
}

// ── Workout Events ──

export function trackWorkoutView(workoutId, workoutTitle, difficulty) {
  trackEvent('workout_view', {
    workout_id: workoutId,
    workout_title: workoutTitle,
    difficulty,
  });
}

export function trackWorkoutComplete(workoutId, exerciseCount, difficulty) {
  trackEvent('workout_complete', {
    workout_id: workoutId,
    exercise_count: exerciseCount,
    difficulty,
  });
}

export function trackExerciseComplete(exerciseId, exerciseName, difficulty, rpe) {
  trackEvent('exercise_complete', {
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    difficulty,
    rpe,
  });
}

export function trackDifficultyChange(workoutId, fromDifficulty, toDifficulty) {
  trackEvent('difficulty_change', {
    workout_id: workoutId,
    from_difficulty: fromDifficulty,
    to_difficulty: toDifficulty,
  });
}

// ── Subscription Events ──

export function trackSubscriptionUpgrade(fromTier, toTier) {
  trackEvent('subscription_upgrade', { from_tier: fromTier, to_tier: toTier });
}

// ── Community Events ──

export function trackCommunityPost(category) {
  trackEvent('community_post', { category });
}

// ── Support Events ──

export function trackSupportTicket(category) {
  trackEvent('support_ticket', { category });
}

// ── Auth Events ──

export function trackSignup(method) {
  trackEvent('sign_up', { method });
}
