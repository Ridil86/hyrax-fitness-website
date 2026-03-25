import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchFitnessProfile } from '../../api/fitnessProfile';
import { fetchTodayWorkout, generateDailyWorkout, swapDailyWorkout } from '../../api/routine';
import { createWorkoutLog, fetchUserLogs } from '../../api/completionLog';
import { hasTierAccess } from '../../utils/tiers';
import { downloadRoutinePdf } from '../../utils/routinePdf';
import { fetchProfile } from '../../api/profile';
import TrialBanner from '../../components/TrialBanner';
import './my-routine.css';

function formatFocus(tags) {
  if (!tags || tags.length === 0) return '';
  return tags.map(t => t.replace(/[-_]/g, ' ')).join(', ');
}

/** Strip em-dashes and emojis from AI output */
function sanitize(text) {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2013\u2012]/g, '-')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .trim();
}

export default function MyRoutine() {
  const { getIdToken, effectiveTier } = useAuth();
  const [fitnessProfile, setFitnessProfile] = useState(null);
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logFormData, setLogFormData] = useState([]);
  const [logging, setLogging] = useState(false);
  const [logMessage, setLogMessage] = useState(null);
  const [workoutRating, setWorkoutRating] = useState(null);
  const [swapping, setSwapping] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const hasAccess = hasTierAccess(effectiveTier, 'Rock Runner');

  // Poll for workout when generation is in progress
  const pollForWorkout = useCallback(async (token) => {
    const MAX_POLLS = 30;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const result = await fetchTodayWorkout(token);
        if (result.status === 'generating') continue;
        if (result.status === 'error') throw new Error(result.error || 'Generation failed');
        return result;
      } catch (err) {
        if (err.status === 404) continue;
        throw err;
      }
    }
    throw new Error('Generation timed out. Please refresh.');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getIdToken();
        const today = new Date().toISOString().slice(0, 10);
        const [fpData, todayData, logsData, profileData] = await Promise.all([
          fetchFitnessProfile(token).catch(() => null),
          fetchTodayWorkout(token).catch(() => null),
          fetchUserLogs({ from: today, to: today + 'T23:59:59Z', limit: 50 }, token).catch(() => []),
          fetchProfile(token).catch(() => null),
        ]);
        if (cancelled) return;
        if (fpData?.fitnessProfile) setFitnessProfile(fpData.fitnessProfile);
        if (profileData) setUserProfile(profileData);
        // If workout is still generating, start polling
        if (todayData?.status === 'generating') {
          setGenerating(true);
          pollForWorkout(token).then(result => {
            if (!cancelled) { setWorkout(result); setGenerating(false); }
          }).catch(() => { if (!cancelled) setGenerating(false); });
        } else if (todayData && !todayData.error) {
          setWorkout(todayData);
        }
        // Check if today's AI routine was already logged
        const logs = Array.isArray(logsData) ? logsData : logsData?.logs || [];
        if (logs.some(l => l.source === 'ai-routine' && l.sourceId === today)) {
          setCompleted(true);
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (hasAccess) load();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [getIdToken, hasAccess, pollForWorkout]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const token = await getIdToken();
      const result = await generateDailyWorkout(token);
      if (result.status === 'generating') {
        // Poll until ready
        const final = await pollForWorkout(token);
        setWorkout(final);
      } else {
        setWorkout(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate workout. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [getIdToken, pollForWorkout]);

  const handleOpenLogForm = useCallback(() => {
    if (!workout?.exercises) return;
    setLogFormData(
      workout.exercises.map((ex) => ({
        checked: true,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        sets: ex.sets || '',
        reps: ex.reps || '',
        difficulty: ex.modificationLevel || 'intermediate',
        rpe: '',
        notes: '',
      }))
    );
    setShowLogForm(true);
    setLogMessage(null);
  }, [workout]);

  const handleLogFormChange = (idx, field, value) => {
    setLogFormData((prev) => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmitLog = useCallback(async () => {
    const checked = logFormData.filter((ex) => ex.checked);
    if (checked.length === 0) return;
    setLogging(true);
    setLogMessage(null);
    try {
      const token = await getIdToken();
      const today = new Date().toISOString().slice(0, 10);
      await createWorkoutLog({
        exercises: checked.map((ex) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          sets: Number(ex.sets) || 1,
          reps: Number(ex.reps) || 0,
          difficulty: ex.difficulty,
          rpe: ex.rpe ? Number(ex.rpe) : undefined,
          notes: ex.notes || undefined,
        })),
        workoutId: today,
        workoutTitle: workout?.title || 'AI Routine',
        source: 'ai-routine',
        sourceId: today,
        rating: workoutRating || undefined,
      }, token);
      setCompleted(true);
      setShowLogForm(false);
      setLogMessage({ type: 'success', text: 'Workout logged successfully!' });
    } catch (err) {
      setLogMessage({ type: 'error', text: err.message || 'Failed to log workout.' });
    } finally {
      setLogging(false);
    }
  }, [logFormData, getIdToken, workout, workoutRating]);

  const handleSwap = useCallback(async () => {
    setSwapping(true);
    setError(null);
    try {
      const token = await getIdToken();
      const result = await swapDailyWorkout(token, {
        avoidFocus: workout?.focus || [],
      });
      if (result.status === 'generating') {
        const final = await pollForWorkout(token);
        setWorkout(final);
      } else {
        setWorkout(result);
      }
      setCompleted(false);
      setShowLogForm(false);
      setWorkoutRating(null);
    } catch (err) {
      setError(err.message || 'Failed to swap workout.');
    } finally {
      setSwapping(false);
    }
  }, [getIdToken, workout, pollForWorkout]);

  const toggleExercise = (idx) => {
    setExpandedExercise(expandedExercise === idx ? null : idx);
  };

  if (loading) {
    return (
      <div className="routine-loading">
        <div className="section-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  // Tier gate
  if (!hasAccess) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>My Routine</h1>
          <p>AI-powered personalized daily workouts</p>
        </div>
        <div className="routine-gate">
          <div className="routine-gate-icon">&#x1F512;</div>
          <h2>Upgrade to Unlock</h2>
          <p>Personalized AI-generated workout routines are available for Rock Runner and Iron Dassie members.</p>
          <Link to="/portal/subscription" className="btn primary">View Plans</Link>
        </div>
      </div>
    );
  }

  // No fitness profile yet
  if (!fitnessProfile) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>My Routine</h1>
          <p>AI-powered personalized daily workouts</p>
        </div>
        <TrialBanner compact featureName="AI Routines" />
        <div className="routine-gate">
          <div className="routine-gate-icon">&#x1F4CB;</div>
          <h2>Complete Your Fitness Profile</h2>
          <p>Before we can generate personalized workouts, we need to know about your goals, equipment, and preferences.</p>
          <Link to="/portal/questionnaire" className="btn primary">Start Questionnaire</Link>
        </div>
      </div>
    );
  }

  // No workout generated yet today
  if (!workout) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>My Routine</h1>
          <p>AI-powered personalized daily workouts</p>
        </div>
        <TrialBanner compact featureName="AI Routines" />
        <div className="routine-generate-cta">
          <div className="routine-gate-icon">&#x1F3CB;</div>
          <h2>Ready for Today&rsquo;s Workout?</h2>
          <p>Your AI training assistant will create a personalized workout based on your profile, recent activity, and recovery needs.</p>
          {error && <div className="routine-error">{error}</div>}
          <button
            className="btn primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Today\u2019s Workout'}
          </button>
          <div className="routine-profile-summary">
            <span><strong>Level:</strong> {fitnessProfile.experienceLevel}</span>
            <span><strong>Days:</strong> {fitnessProfile.daysPerWeek}/week</span>
            <span><strong>Duration:</strong> {fitnessProfile.preferredDuration} min</span>
          </div>
          <Link to="/portal/questionnaire" className="routine-edit-link">Edit Fitness Profile</Link>
        </div>
      </div>
    );
  }

  // Display today's workout
  const isRest = workout.type === 'rest' || workout.type === 'active_recovery';

  return (
    <div>
      <div className="admin-page-header">
        <h1>My Routine</h1>
        <p>AI-powered personalized daily workouts</p>
      </div>

      <TrialBanner compact featureName="AI Routines" />

      {/* Workout header card */}
      <div className="routine-card routine-header-card">
        <div className="routine-header-top">
          <div>
            <span className={`routine-type-badge ${workout.type || 'training'}`}>
              {workout.type === 'rest' ? 'Rest Day' : workout.type === 'active_recovery' ? 'Active Recovery' : 'Training'}
            </span>
            <h2 className="routine-title">{sanitize(workout.title) || "Today's Workout"}</h2>
          </div>
          <div className="routine-meta">
            {workout.duration && <span className="routine-meta-item">{sanitize(workout.duration)}</span>}
            {workout.focus?.length > 0 && (
              <span className="routine-meta-item">{formatFocus(workout.focus)}</span>
            )}
          </div>
        </div>
        <div className="routine-header-actions">
          {completed && (
            <span className="routine-logged-badge">&#x2713; Logged{workoutRating ? ` (${workoutRating}/5)` : ''}</span>
          )}
          <button
            type="button"
            className="btn small routine-pdf-btn"
            onClick={() => downloadRoutinePdf(workout, { userProfile, userTier: effectiveTier })}
          >
            Download Print-Ready PDF
          </button>
        </div>
        {workout.coachingNotes && (
          <p className="routine-coaching">{sanitize(workout.coachingNotes)}</p>
        )}
      </div>

      {/* Warm-up */}
      {workout.warmUp && !isRest && (
        <div className="routine-card routine-section-card">
          <h3>Warm-Up {workout.warmUp.duration && <span className="routine-section-duration">({sanitize(workout.warmUp.duration)})</span>}</h3>
          <p className="routine-section-desc">{sanitize(workout.warmUp.description)}</p>
        </div>
      )}

      {/* Exercises */}
      {!isRest && workout.exercises?.length > 0 && (
        <div className="routine-card">
          <h3>Exercises ({workout.exercises.length})</h3>
          <div className="routine-exercise-list">
            {workout.exercises.map((ex, idx) => (
              <div
                key={idx}
                className={`routine-exercise ${expandedExercise === idx ? 'expanded' : ''}`}
              >
                <button
                  type="button"
                  className="routine-exercise-header"
                  onClick={() => toggleExercise(idx)}
                >
                  <span className="routine-exercise-num">{idx + 1}</span>
                  <div className="routine-exercise-info">
                    <span className="routine-exercise-name">
                      {ex.exerciseName || 'Exercise'}
                    </span>
                    <span className="routine-exercise-prescription">
                      {ex.sets && ex.reps ? `${ex.sets} x ${ex.reps}` : ''}
                      {ex.duration && !ex.reps ? ex.duration : ''}
                      {ex.rest ? ` \u00B7 ${ex.rest} rest` : ''}
                    </span>
                  </div>
                  <span className="routine-exercise-chevron">{expandedExercise === idx ? '\u25B2' : '\u25BC'}</span>
                </button>

                {expandedExercise === idx && (
                  <div className="routine-exercise-details">
                    {ex.modificationName && (
                      <div className="routine-exercise-mod">
                        <span className="routine-mod-level">{ex.modificationLevel}</span>
                        <span className="routine-mod-name">{ex.modificationName}</span>
                      </div>
                    )}
                    {ex.modificationDescription && (
                      <p className="routine-mod-desc">{sanitize(ex.modificationDescription)}</p>
                    )}
                    {ex.equipment?.length > 0 && (
                      <div className="routine-equipment">
                        {ex.equipment.map((eq, eqIdx) => (
                          <span key={eqIdx} className="routine-equipment-tag">{eq.equipmentName}</span>
                        ))}
                      </div>
                    )}
                    {ex.notes && <p className="routine-exercise-notes">{sanitize(ex.notes)}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bask (cooldown) */}
      {workout.bask && !isRest && (
        <div className="routine-card routine-section-card">
          <h3>Bask (Cooldown) {workout.bask.duration && <span className="routine-section-duration">({sanitize(workout.bask.duration)})</span>}</h3>
          <p className="routine-section-desc">{sanitize(workout.bask.description)}</p>
        </div>
      )}

      {/* Rest day content */}
      {isRest && (
        <div className="routine-card routine-section-card">
          <h3>{workout.type === 'active_recovery' ? 'Active Recovery' : 'Rest Day'}</h3>
          <p className="routine-section-desc">
            {workout.coachingNotes || 'Take today to recover. Light stretching, walking, or foam rolling are encouraged.'}
          </p>
        </div>
      )}

      {/* Log Completion */}
      {!isRest && !completed && !showLogForm && (
        <div className="routine-card" style={{ textAlign: 'center' }}>
          <button className="btn primary" onClick={handleOpenLogForm}>
            Log This Workout
          </button>
        </div>
      )}

      {logMessage && (
        <div className={`routine-log-msg ${logMessage.type}`}>{logMessage.text}</div>
      )}

      {showLogForm && (
        <div className="routine-card routine-log-form">
          <h3>&#x2705; Log Completion</h3>
          <p className="routine-log-hint">Uncheck exercises you skipped. Adjust sets/reps if needed.</p>
          <div className="routine-log-list">
            {logFormData.map((ex, idx) => (
              <div key={idx} className={`routine-log-item ${ex.checked ? '' : 'skipped'}`}>
                <label className="routine-log-check">
                  <input
                    type="checkbox"
                    checked={ex.checked}
                    onChange={(e) => handleLogFormChange(idx, 'checked', e.target.checked)}
                  />
                  <span>{ex.exerciseName}</span>
                </label>
                {ex.checked && (
                  <div className="routine-log-fields">
                    <input
                      type="number"
                      value={ex.sets}
                      onChange={(e) => handleLogFormChange(idx, 'sets', e.target.value)}
                      placeholder="Sets"
                      className="routine-log-input"
                      min={0}
                    />
                    <span className="routine-log-x">&times;</span>
                    <input
                      type="number"
                      value={ex.reps}
                      onChange={(e) => handleLogFormChange(idx, 'reps', e.target.value)}
                      placeholder="Reps"
                      className="routine-log-input"
                      min={0}
                    />
                    <input
                      type="number"
                      value={ex.rpe}
                      onChange={(e) => handleLogFormChange(idx, 'rpe', e.target.value)}
                      placeholder="RPE"
                      className="routine-log-input routine-log-rpe"
                      min={1}
                      max={10}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="routine-rating-section">
            <label>How did this workout feel?</label>
            <div className="routine-rating-buttons">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`routine-rating-btn ${workoutRating === n ? 'selected' : ''}`}
                  onClick={() => setWorkoutRating(workoutRating === n ? null : n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="routine-rating-labels">
              <span>Too easy</span>
              <span>Just right</span>
              <span>Too hard</span>
            </div>
          </div>
          <div className="routine-log-actions">
            <button className="btn" onClick={() => setShowLogForm(false)} disabled={logging}>Cancel</button>
            <button className="btn primary" onClick={handleSubmitLog} disabled={logging}>
              {logging ? 'Logging...' : 'Log Workout'}
            </button>
          </div>
        </div>
      )}

      {/* Progression + next day */}
      {(workout.progressionContext || workout.nextDayHint) && (
        <div className="routine-card routine-insights-card">
          {workout.progressionContext && (
            <div className="routine-insight">
              <strong>&#x1F4C8; Progression</strong>
              <p>{workout.progressionContext}</p>
            </div>
          )}
          {workout.nextDayHint && (
            <div className="routine-insight">
              <strong>&#x27A1; Tomorrow</strong>
              <p>{workout.nextDayHint}</p>
            </div>
          )}
        </div>
      )}

      {/* Swap button */}
      {!isRest && !completed && (
        <div className="routine-card" style={{ textAlign: 'center' }}>
          <button
            className="btn routine-swap-btn"
            onClick={handleSwap}
            disabled={swapping}
          >
            {swapping ? 'Swapping...' : 'Not feeling this? Swap workout'}
          </button>
          {error && <div className="routine-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {/* Footer links */}
      <div className="routine-footer">
        <Link to="/portal/routine/history" className="routine-footer-link">View Past Workouts &rarr;</Link>
        <Link to="/portal/questionnaire" className="routine-footer-link">Edit Fitness Profile</Link>
      </div>
    </div>
  );
}
